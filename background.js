import { callAction, validateApiKey } from "./lib/api.js";

const ALARM_NAME = "mcspy-poll";
const MAX_HISTORY_PER_ITEM = 250;
const OWNERSHIP_TTL_MS = 24 * 60 * 60 * 1000; // cache "é meu anúncio?" (positivo) por 24h
const OWNERSHIP_NEG_TTL_MS = 60 * 60 * 1000; // negativo só 1h — falso "não é meu" corrige rápido
const ACCOUNTS_TTL_MS = 24 * 60 * 60 * 1000; // cache list_accounts por 24h
const POLL_MAX_ERRORS = 3; // circuit breaker: pausa item após N falhas seguidas
const POLL_ERROR_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const HISTORY_COMPACT_AGE_MS = 30 * 24 * 60 * 60 * 1000; // >30d: 1 snapshot/dia

const DEFAULT_SETTINGS = {
  checkIntervalHours: 6,
  notifyPricePct: 5,
  notifySoldDelta: 5,
  notificationsEnabled: true,
};

// ---------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------

async function getStore() {
  const data = await chrome.storage.local.get([
    "apiKey",
    "settings",
    "competitors",
    "ownItemIds",
    "unreadAlerts",
    "meliUserId",
    "meliUserIds",
    "ownershipCache",
    "accountsFetchedAt",
  ]);
  return {
    apiKey: data.apiKey || null,
    settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) },
    competitors: data.competitors || {},
    ownItemIds: data.ownItemIds || [],
    unreadAlerts: data.unreadAlerts || 0,
    meliUserId: data.meliUserId || null,
    meliUserIds: data.meliUserIds || [],
    ownershipCache: data.ownershipCache || {},
    accountsFetchedAt: data.accountsFetchedAt || 0,
  };
}

async function setStore(partial) {
  await chrome.storage.local.set(partial);
}

// Mutex simples: serializa toda mutação read-modify-write no storage.
// chrome.storage não tem transação; sem isso, poll + snapshot passivo +
// track concorrentes se sobrescrevem (snapshots perdidos, contador errado).
let mutationLock = Promise.resolve();
function withLock(fn) {
  const run = mutationLock.then(fn, fn);
  mutationLock = run.then(
    () => {},
    () => {}
  );
  return run;
}

async function updateBadge() {
  const { unreadAlerts } = await getStore();
  await chrome.action.setBadgeBackgroundColor({ color: "#d9534f" });
  await chrome.action.setBadgeText({ text: unreadAlerts > 0 ? String(unreadAlerts) : "" });
}

// ---------------------------------------------------------------------
// Parsing de HTML cru (usado no polling em background, sem DOM disponível)
// ---------------------------------------------------------------------

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSoldQuantityFromText(str) {
  if (!str) return null;
  const m = str.match(/([\d.,]+)\s*(mil)?\s*vendid/i);
  if (!m) return null;
  let n = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
  if (m[2]) n *= 1000;
  return Math.round(n);
}

function parseSnapshotFromHtml(html) {
  let price = null;
  let currency = "BRL";
  const ldMatch = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/
  );
  if (ldMatch) {
    try {
      const obj = JSON.parse(ldMatch[1]);
      price = obj?.offers?.price ?? null;
      currency = obj?.offers?.priceCurrency ?? "BRL";
    } catch (_) {
      /* ignore */
    }
  }
  const plain = stripTags(html);
  if (price == null) {
    const priceMatch = plain.match(/R\$\s*([\d.,]+)/);
    if (priceMatch) price = Number(priceMatch[1].replace(/\./g, "").replace(",", "."));
  }
  const soldQuantityApprox = parseSoldQuantityFromText(plain);
  const ratingMatch = plain.match(/(\d[.,]\d)\s*\((\d+)\)/);
  const rating = ratingMatch ? Number(ratingMatch[1].replace(",", ".")) : null;
  const reviewsCount = ratingMatch ? Number(ratingMatch[2]) : null;
  const stockOut = /produto pausado|sem estoque|indispon[ií]vel/i.test(plain);

  return {
    ts: Date.now(),
    price,
    currency,
    soldQuantityApprox,
    rating,
    reviewsCount,
    stockText: stockOut ? "Indisponível" : "Estoque disponível",
  };
}

// ---------------------------------------------------------------------
// Competidores: tracking + snapshots + alertas
// ---------------------------------------------------------------------

// Roda DENTRO do lock de pushSnapshot — não pode chamar withLock aqui.
async function notifyChange(comp, prevSnap, newSnap, settings, store) {
  if (!settings.notificationsEnabled) return null;
  const messages = [];

  if (prevSnap?.price != null && newSnap.price != null && prevSnap.price > 0) {
    const pct = ((newSnap.price - prevSnap.price) / prevSnap.price) * 100;
    if (Math.abs(pct) >= settings.notifyPricePct) {
      const dir = pct > 0 ? "subiu" : "caiu";
      messages.push(`Preço ${dir} ${Math.abs(pct).toFixed(1)}% (R$ ${prevSnap.price.toFixed(2)} → R$ ${newSnap.price.toFixed(2)})`);
    }
  }
  if (
    prevSnap?.soldQuantityApprox != null &&
    newSnap.soldQuantityApprox != null &&
    newSnap.soldQuantityApprox - prevSnap.soldQuantityApprox >= settings.notifySoldDelta
  ) {
    messages.push(
      `+${newSnap.soldQuantityApprox - prevSnap.soldQuantityApprox} vendas novas (aprox.)`
    );
  }

  if (messages.length === 0) return null;

  try {
    chrome.notifications.create(`mcspy-${comp.itemId}-${Date.now()}`, {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: `Marketplace Connect: ${comp.title?.slice(0, 60) || comp.itemId}`,
      message: messages.join(" • "),
      priority: 1,
    });
  } catch (_) {
    /* notifications podem falhar em alguns ambientes; ignorar */
  }
  return (store.unreadAlerts || 0) + 1;
}

// Histórico: mantém tudo dos últimos 30 dias; mais velho vira 1 snapshot/dia.
// Evita estourar quota do chrome.storage.local com muitos itens monitorados.
function compactHistory(history) {
  const cutoff = Date.now() - HISTORY_COMPACT_AGE_MS;
  const out = [];
  let lastDay = null;
  for (const h of history) {
    if (h.ts >= cutoff) {
      out.push(h);
      continue;
    }
    const day = Math.floor(h.ts / 86400000);
    if (day !== lastDay) {
      out.push(h);
      lastDay = day;
    }
  }
  return out.slice(-MAX_HISTORY_PER_ITEM);
}

// trusted=true: snapshot veio do DOM real (content script) — confiável.
// trusted=false: veio de parse por regex do HTML cru (polling) — pode ser
// página de captcha/bloqueio; variação absurda de preço = provável lixo.
async function pushSnapshot(itemId, snapshot, { force = false, trusted = true } = {}) {
  return withLock(async () => {
    const store = await getStore();
    const comp = store.competitors[itemId];
    if (!comp) return;

    const last = comp.history[comp.history.length - 1];

    if (!trusted && last?.price != null && snapshot.price != null && last.price > 0) {
      const changePct = Math.abs((snapshot.price - last.price) / last.price) * 100;
      if (changePct > 80) {
        comp.lastError = "Variação de preço suspeita (possível página de bloqueio do ML) — snapshot descartado";
        comp.lastCheckedAt = Date.now();
        store.competitors[itemId] = comp;
        await setStore({ competitors: store.competitors });
        return;
      }
    }

    const isDuplicate =
      !force &&
      last &&
      last.price === snapshot.price &&
      last.soldQuantityApprox === snapshot.soldQuantityApprox &&
      Date.now() - last.ts < 1000 * 60 * 60 * 3; // não duplica dentro de 3h

    if (isDuplicate) return;

    comp.history.push(snapshot);
    comp.history = compactHistory(comp.history);
    comp.lastCheckedAt = Date.now();
    comp.lastError = null;
    comp.errorCount = 0;

    const newUnread = await notifyChange(comp, last, snapshot, store.settings, store);

    store.competitors[itemId] = comp;
    const partial = { competitors: store.competitors };
    if (newUnread != null) partial.unreadAlerts = newUnread;
    await setStore(partial);
    if (newUnread != null) await updateBadge();
  });
}

async function pollAllCompetitors() {
  const store = await getStore();
  const items = Object.values(store.competitors);
  for (const comp of items) {
    // Circuit breaker: item falhando repetidamente descansa 24h
    if (
      (comp.errorCount || 0) >= POLL_MAX_ERRORS &&
      comp.lastCheckedAt &&
      Date.now() - comp.lastCheckedAt < POLL_ERROR_COOLDOWN_MS
    ) {
      continue;
    }
    try {
      const res = await fetch(comp.url, { credentials: "omit" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const snapshot = parseSnapshotFromHtml(html);
      if (snapshot.price == null && snapshot.soldQuantityApprox == null) {
        throw new Error("Página sem dados (bloqueio/captcha do ML?)");
      }
      await pushSnapshot(comp.itemId, snapshot, { trusted: false });
    } catch (err) {
      await withLock(async () => {
        const s = await getStore();
        if (s.competitors[comp.itemId]) {
          s.competitors[comp.itemId].lastError = err?.message || "Falha ao verificar";
          s.competitors[comp.itemId].lastCheckedAt = Date.now();
          s.competitors[comp.itemId].errorCount = (s.competitors[comp.itemId].errorCount || 0) + 1;
          await setStore({ competitors: s.competitors });
        }
      });
    }
  }
}

async function ensureAlarm() {
  const { settings } = await getStore();
  const minutes = Math.max(30, (settings.checkIntervalHours || 6) * 60);
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: minutes });
}

chrome.runtime.onInstalled.addListener(async () => {
  const store = await getStore();
  // ownershipCache zera a cada update — lógica de detecção pode ter mudado
  await setStore({ settings: { ...DEFAULT_SETTINGS, ...store.settings }, ownershipCache: {} });
  await ensureAlarm();
});

chrome.runtime.onStartup?.addListener(() => {
  ensureAlarm();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) pollAllCompetitors();
});

// ---------------------------------------------------------------------
// Análise de concorrência via Marketplace Connect API
// ---------------------------------------------------------------------

function extractCatalogId(url) {
  const m = url.match(/\/up\/(MLBU\d+)/i);
  return m ? m[1].toUpperCase() : null;
}

function summarizePrices(list) {
  const prices = list
    .map((i) => Number(i.price ?? i.total_amount ?? i.base_price))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (prices.length === 0) return null;
  return {
    avg: prices.reduce((a, b) => a + b, 0) / prices.length,
    min: Math.min(...prices),
    max: Math.max(...prices),
    sellersCount: prices.length,
  };
}

async function analyzeAd(ad) {
  const { apiKey, meliUserId } = await getStore();
  const result = {};

  if (!apiKey) {
    result.note = "Conecte sua conta Marketplace Connect nas opções da extensão para ver benchmark de preço e concorrência (buy box) deste catálogo.";
    return result;
  }

  // 0. Verificar se anúncio é do próprio usuário
  if (ad.itemId) {
    try {
      const itemRes = await callAction(apiKey, "get_item", { item_id: ad.itemId });
      if (itemRes.ok) {
        const sellerId = itemRes.data?.seller_id;
        const myId = meliUserId || "";
        if (sellerId && myId && (String(sellerId) === String(myId) || String(sellerId) === String(myId).replace(/^email:|^shopee:/, ""))) {
          result.isOwn = true;
          result.ownItemData = {
            id: itemRes.data?.id || ad.itemId,
            title: itemRes.data?.title,
            price: itemRes.data?.price,
            status: itemRes.data?.status,
            available_quantity: itemRes.data?.available_quantity,
            condition: itemRes.data?.condition,
          };
        }
      }
    } catch(_) {}
  }

  const catalogId = extractCatalogId(ad.url);
  if (catalogId) {
    const r = await callAction(apiKey, "product_items", { product_id: catalogId });
    if (r.ok) {
      const list =
        r.data?.results || r.data?.items || r.data?.data?.results || (Array.isArray(r.data) ? r.data : null);
      if (Array.isArray(list) && list.length) {
        result.priceBenchmark = summarizePrices(list);
      }
    }
  }

  if (!result.priceBenchmark && ad.itemId) {
    const r = await callAction(apiKey, "find_similar", { item_id: ad.itemId });
    if (r.ok) {
      const list = r.data?.results || r.data?.items || (Array.isArray(r.data) ? r.data : []);
      result.similarCount = Array.isArray(list) ? list.length : r.data?.paging?.total ?? null;
    }
  }

  if (!result.priceBenchmark && !result.similarCount) {
    result.note = "Nenhum dado de concorrência retornado pela API para este item.";
  }

  // Verificar se o anúncio tem clips (vídeos)
  if (ad.itemId) {
    try {
      const clipsRes = await callAction(apiKey, "get_clips", {});
      if (clipsRes.ok) {
        const clips = clipsRes.data?.results || clipsRes.data || [];
        const itemClips = Array.isArray(clips) ? clips.filter(c => c.item_id === ad.itemId || c.id === ad.itemId) : [];
        result.hasClips = itemClips.length > 0;
        result.clipsCount = itemClips.length;
      }
    } catch(_) {}
  }

  return result;
}

async function getAccountSummary() {
  const { apiKey } = await getStore();
  if (!apiKey) return { error: "Nenhuma API key configurada." };

  const [credits, me, items, accounts] = await Promise.all([
    callAction(apiKey, "credits_status"),
    callAction(apiKey, "me"),
    callAction(apiKey, "list_items", { limit: 50 }),
    callAction(apiKey, "list_accounts", {}),
  ]);

  // Save meliUserId from list_accounts for isOwn detection
  if (accounts.ok) {
    const meliAcc = (accounts.data?.accounts || []).find(a => a.marketplace === "meli");
    if (meliAcc) await setStore({ meliUserId: meliAcc.external_id });
  }

  const itemsList =
    items.data?.results || items.data?.items || (Array.isArray(items.data) ? items.data : []);
  const ownItemIds = Array.isArray(itemsList)
    ? itemsList.map((i) => i.id || i.item_id).filter(Boolean)
    : [];
  if (ownItemIds.length) await setStore({ ownItemIds });

  return {
    credits: credits.ok ? credits.data : null,
    account: me.ok ? me.data : null,
    itemsCount: Array.isArray(itemsList) ? itemsList.length : null,
    itemsError: items.ok ? null : items.error,
    creditsError: credits.ok ? null : credits.error,
    accountError: me.ok ? null : me.error,
  };
}

// ---------------------------------------------------------------------
// Mensageria (content script + popup + options)
// ---------------------------------------------------------------------

// Resolve "esse anúncio é meu?" com cache de 24h — antes disso, cada
// pageview disparava list_accounts + get_item (queimava créditos navegando).
async function resolveOwnership(itemId) {
  const store = await getStore();
  let isOwn = store.ownItemIds.includes(itemId);
  let meliUserId = store.meliUserId || "";

  if (isOwn) return { isOwn, meliUserId };

  const cached = store.ownershipCache[itemId];
  const cacheTtl = cached?.isOwn ? OWNERSHIP_TTL_MS : OWNERSHIP_NEG_TTL_MS;
  if (cached && Date.now() - cached.ts < cacheTtl) {
    return { isOwn: cached.isOwn, meliUserId: cached.meliUserId || meliUserId };
  }

  if (!store.apiKey) return { isOwn: false, meliUserId };

  // list_accounts no máximo 1x por 24h
  let meliUserIds = store.meliUserIds || [];
  if (!meliUserId || Date.now() - store.accountsFetchedAt > ACCOUNTS_TTL_MS) {
    try {
      const accRes = await callAction(store.apiKey, "list_accounts", {});
      if (accRes.ok) {
        const accs = accRes.data?.accounts || [];
        const bestAcc =
          accs.find((a) => a.marketplace === "meli" && a.is_current) ||
          accs.find((a) => a.marketplace === "meli");
        if (bestAcc) meliUserId = bestAcc.external_id;
        meliUserIds = accs.filter((a) => a.marketplace === "meli").map((a) => a.external_id);
        await setStore({ meliUserId, meliUserIds, accountsFetchedAt: Date.now() });
      }
    } catch (_) {}
  }

  const allIds = [...new Set([meliUserId, ...meliUserIds])].filter(Boolean);
  let checkOk = false;
  if (allIds.length) {
    try {
      const r = await callAction(store.apiKey, "get_item", { item_id: itemId });
      if (r.ok) {
        checkOk = true;
        const sellerId = r.data?.seller_id ?? r.data?.item?.seller_id;
        const matchedId = allIds.find((id) => String(sellerId) === String(id));
        if (sellerId && matchedId) {
          isOwn = true;
          if (matchedId !== meliUserId) {
            meliUserId = matchedId;
            await setStore({ meliUserId: matchedId });
          }
          await setStore({ ownItemIds: [...new Set([...store.ownItemIds, itemId])] });
        }
      }
    } catch (_) {}
  }

  // Só cacheia resultado de verificação que de fato rodou — falha de rede/API
  // não pode virar "não é meu" persistido.
  if (checkOk) {
    const ownershipCache = { ...store.ownershipCache, [itemId]: { isOwn, meliUserId, ts: Date.now() } };
    // Limita cache a 200 entradas (remove as mais antigas)
    const entries = Object.entries(ownershipCache);
    if (entries.length > 200) {
      entries.sort((a, b) => b[1].ts - a[1].ts);
      await setStore({ ownershipCache: Object.fromEntries(entries.slice(0, 200)) });
    } else {
      await setStore({ ownershipCache });
    }
  }

  return { isOwn, meliUserId };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    switch (msg?.type) {
      case "GET_STATE_FOR_ITEM": {
        const store = await getStore();
        const { isOwn, meliUserId } = await resolveOwnership(msg.itemId);
        sendResponse({ tracked: !!store.competitors[msg.itemId], isOwn, hasApiKey: !!store.apiKey, meliUserId });
        return;
      }
      case "TRACK_COMPETITOR": {
        const ad = msg.ad;
        await withLock(async () => {
          const store = await getStore();
          store.competitors[ad.itemId] = store.competitors[ad.itemId] || {
            itemId: ad.itemId,
            url: ad.url,
            title: ad.title,
            seller: ad.seller,
            category: ad.category,
            addedAt: Date.now(),
            lastCheckedAt: null,
            lastError: null,
            errorCount: 0,
            history: [],
          };
          await setStore({ competitors: store.competitors });
        });
        await pushSnapshot(ad.itemId, {
          ts: Date.now(),
          price: ad.price,
          currency: ad.currency,
          soldQuantityApprox: ad.soldQuantityApprox,
          rating: ad.rating,
          reviewsCount: ad.reviewsCount,
          stockText: ad.stockText,
        }, { force: true });
        sendResponse({ ok: true });
        return;
      }
      case "UNTRACK_COMPETITOR": {
        await withLock(async () => {
          const store = await getStore();
          delete store.competitors[msg.ad.itemId];
          await setStore({ competitors: store.competitors });
        });
        sendResponse({ ok: true });
        return;
      }
      case "REMOVE_COMPETITOR": {
        await withLock(async () => {
          const store = await getStore();
          delete store.competitors[msg.itemId];
          await setStore({ competitors: store.competitors });
        });
        sendResponse({ ok: true });
        return;
      }
      case "PASSIVE_SNAPSHOT": {
        const store = await getStore();
        const ad = msg.ad;
        if (store.competitors[ad.itemId]) {
          await pushSnapshot(ad.itemId, {
            ts: Date.now(),
            price: ad.price,
            currency: ad.currency,
            soldQuantityApprox: ad.soldQuantityApprox,
            rating: ad.rating,
            reviewsCount: ad.reviewsCount,
            stockText: ad.stockText,
          });
        }
        sendResponse({ ok: true });
        return;
      }
      case "ANALYZE_AD": {
        const result = await analyzeAd(msg.ad);
        sendResponse(result);
        return;
      }
      case "GET_ALL": {
        const store = await getStore();
        await setStore({ unreadAlerts: 0 });
        await updateBadge();
        sendResponse(store);
        return;
      }
      case "GET_ACCOUNT_SUMMARY": {
        sendResponse(await getAccountSummary());
        return;
      }
      case "SAVE_API_KEY": {
        const check = await validateApiKey(msg.apiKey);
        // Fetch meliUserId from list_accounts (more reliable than 'me')
        let meliUserId = null;
        try {
          const accRes = await callAction(msg.apiKey, "list_accounts", {});
          if (accRes.ok) {
            const meliAcc = (accRes.data?.accounts || []).find(a => a.marketplace === "meli");
            if (meliAcc) meliUserId = meliAcc.external_id;
          }
        } catch (_) {}
        await setStore({ apiKey: msg.apiKey, meliUserId, ownItemIds: [], ownershipCache: {}, accountsFetchedAt: meliUserId ? Date.now() : 0 });
        sendResponse(check);
        return;
      }
      case "CLEAR_API_KEY": {
        await setStore({ apiKey: null, ownItemIds: [], meliUserId: null, meliUserIds: [], ownershipCache: {}, accountsFetchedAt: 0 });
        sendResponse({ ok: true });
        return;
      }
      case "VALIDATE_API_KEY": {
        sendResponse(await validateApiKey(msg.apiKey));
        return;
      }
      case "SET_SETTINGS": {
        const store = await getStore();
        const settings = { ...store.settings, ...msg.settings };
        await setStore({ settings });
        await ensureAlarm();
        sendResponse({ ok: true, settings });
        return;
      }
      case "POLL_NOW": {
        await pollAllCompetitors();
        sendResponse({ ok: true });
        return;
      }
      case "CALL_MCP": {
        const { apiKey } = await getStore();
        if (!apiKey) { sendResponse({ ok: false, error: "API key não configurada." }); return; }
        const r = await callAction(apiKey, msg.action, msg.params);
        sendResponse(r);
        return;
      }
      // Saldo de créditos de IA saiu junto com a geração de mídia: a extensão
      // não consome crédito de IA em lugar nenhum.
      default:
        sendResponse({ error: "unknown message type" });
    }
  })().catch((err) => {
    // Sem isso, exceção deixa o sendResponse pendente e o chamador trava
    try {
      sendResponse({ ok: false, error: err?.message || "Erro interno na extensão." });
    } catch (_) {}
  });
  return true; // resposta assíncrona
});
