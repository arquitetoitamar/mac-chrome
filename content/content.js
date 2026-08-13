// Marketplace Connect — Análise de Produtos: content script
// Somente leitura: gauges de qualidade injetados na página, diagnóstico de
// título e descrição, posição na busca e calculadora de margem.
// A extensão não altera nenhum anúncio, nem o do próprio usuário.
(() => {
  const MCSPY_CSS = `
    .mcspy-wrap{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif}
    .mcspy-fab{width:52px;height:52px;border-radius:50%;border:none;cursor:pointer;background:#2968c8;color:#fff;font-size:22px;box-shadow:0 4px 14px rgba(0,0,0,.25)}
    .mcspy-fab:hover{background:#1f4f9c}
    .mcspy-panel{position:absolute;bottom:62px;right:0;width:360px;max-height:70vh;overflow-y:auto;background:#fff;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.25);color:#222}
    .mcspy-hidden{display:none}
    .mcspy-header{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#2968c8;color:#fff;border-radius:12px 12px 0 0;font-weight:600}
    .mcspy-header button{background:none;border:none;color:#fff;cursor:pointer;font-size:14px}
    .mcspy-body{padding:12px 14px;font-size:13px}
    .mcspy-title{font-weight:600;margin-bottom:8px;line-height:1.3}
    .mcspy-row{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dashed #eee}
    .mcspy-row span{color:#666}
    .mcspy-badge{margin-top:8px;padding:6px 8px;border-radius:6px;font-size:12px}
    .mcspy-badge-own{background:#e6f4ea;color:#1e7e34}
    .mcspy-actions{display:flex;flex-direction:column;gap:6px;margin-top:10px}
    .mcspy-btn{padding:8px 10px;border-radius:8px;border:1px solid #ddd;background:#f7f7f7;cursor:pointer;font-size:13px;text-align:left}
    .mcspy-btn:hover{background:#efefef}
    .mcspy-btn-primary{background:#2968c8;color:#fff;border-color:#2968c8;font-weight:600}
    .mcspy-btn-primary:hover{background:#1f4f9c}
    .mcspy-btn-active{background:#fff3cd;border-color:#ffe08a}
    .mcspy-hint{margin-top:10px;font-size:11px;color:#888}
    .mcspy-result{margin-top:10px}
    .mcspy-muted{color:#888;font-size:12px}
    .mcspy-toast{position:absolute;bottom:62px;right:0;background:#222;color:#fff;padding:8px 12px;border-radius:8px;font-size:12px;white-space:nowrap}
    .mcspy-empty{padding:20px;text-align:center;color:#888;font-size:13px}
    .mcspy-tabs{display:flex;gap:0;margin-bottom:12px;border-bottom:2px solid #eee}
    .mcspy-tab{padding:6px 14px;border:none;background:none;cursor:pointer;font-size:13px;color:#666;border-bottom:2px solid transparent;margin-bottom:-2px}
    .mcspy-tab.active{color:#2968c8;border-bottom-color:#2968c8;font-weight:600}
    .mcspy-panel-tab{display:none}
    .mcspy-panel-tab.active{display:block}
    .mcspy-edit-field{margin-bottom:10px}
    .mcspy-edit-field label{display:block;font-size:12px;color:#666;margin-bottom:4px;font-weight:600}
    .mcspy-edit-field textarea,.mcspy-edit-field input{width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;font-size:13px;font-family:inherit;box-sizing:border-box}
    .mcspy-edit-field textarea:focus,.mcspy-edit-field input:focus{outline:none;border-color:#2968c8}
    .mcspy-score-header{display:flex;align-items:center;gap:12px;margin-bottom:14px;padding:10px;background:#f8f9fa;border-radius:8px}
    .mcspy-score-circle{width:56px;height:56px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:700;color:#fff;flex-shrink:0}
    .mcspy-score-circle.green{background:#1e7e34}.mcspy-score-circle.yellow{background:#e6a817}.mcspy-score-circle.red{background:#c0392b}
    .mcspy-score-value{font-size:20px;line-height:1}.mcspy-score-label{font-size:9px;text-transform:uppercase}
    .mcspy-score-subtitle{font-size:12px;color:#666;flex:1}
    .mcspy-credit-badge{font-size:11px;color:#2968c8;font-weight:600;background:#e8f0fe;padding:4px 10px;border-radius:12px}
    .mcspy-gauges{display:grid;grid-template-columns:1fr 1fr;gap:6px 10px;margin-bottom:12px}
    .mcspy-gauge{font-size:11px}
    .mcspy-gauge-bar-bg{height:6px;background:#e9ecef;border-radius:3px;overflow:hidden;margin-bottom:2px}
    .mcspy-gauge-bar-fill{height:100%;border-radius:3px;transition:width 0.5s}
    .mcspy-gauge-bar-fill.green{background:#1e7e34}.mcspy-gauge-bar-fill.yellow{background:#e6a817}.mcspy-gauge-bar-fill.red{background:#c0392b}
    .mcspy-gauge-label{display:flex;justify-content:space-between;color:#666}
    .mcspy-seo h3{margin:0 0 8px 0;font-size:14px}
    .mcspy-seo-preview{font-size:12px;line-height:1.4;padding:8px;background:#f8f9fa;border-radius:6px;word-break:break-word}
    .mcspy-seo-cut{color:#bbb}
    .mcspy-seo-item{display:flex;gap:8px;align-items:flex-start;font-size:12px;padding:3px 0;line-height:1.35}
    .mcspy-seo-item b{flex-shrink:0;width:12px}
  `;

  const PANEL_ID = "mcspy-root-host";
  const GAUGE_HOST_ID = "mcspy-gauge-host";

  // ========== HELPERS ==========
  function text(sel, root = document) {
    const el = root.querySelector(sel);
    return el ? el.textContent.trim().replace(/\s+/g, " ") : null;
  }
  function firstText(sels, root = document) {
    for (const s of sels) { const t = text(s, root); if (t) return t; }
    return null;
  }
  function parseSoldQuantity(str) {
    if (!str) return null;
    const m = str.match(/([\d.,]+)\s*(mil)?\s*vendid/i);
    if (!m) return null;
    let n = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
    if (m[2]) n *= 1000;
    return Math.round(n);
  }
  function parsePriceFromDom(root = document) {
    const container = root.querySelector(".ui-pdp-price__main-container") || root.querySelector(".ui-pdp-price") || root;
    const fraction = text(".andes-money-amount__fraction", container);
    const cents = text(".andes-money-amount__cents", container);
    if (!fraction) return null;
    const intPart = fraction.replace(/\./g, "").replace(/[^\d]/g, "");
    return Number.isFinite(Number(intPart) + (cents ? Number(cents) / 100 : 0))
      ? Number(intPart) + (cents ? Number(cents) / 100 : 0) : null;
  }
  function parseLdJsonProduct() {
    for (const s of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
      try {
        const data = JSON.parse(s.textContent);
        const obj = Array.isArray(data) ? data.find((d) => d["@type"] === "Product") : data;
        if (obj && (obj["@type"] === "Product" || obj.offers)) return obj;
      } catch (_) {}
    }
    return null;
  }
  function extractItemId() {
    const urlMatch = location.pathname.match(/(MLB\d+)/i);
    if (urlMatch) return urlMatch[1].toUpperCase();
    const scriptsText = Array.from(document.scripts).map((s) => s.textContent || "").join("\n");
    const m = scriptsText.match(/"item_id"\s*:\s*"(MLB\d+)"/);
    if (m) return m[1];
    const canonical = document.querySelector('link[rel="canonical"]')?.href || "";
    const m2 = canonical.match(/(MLB\d+)/i);
    if (m2) return m2[1].toUpperCase();
    const catalogMatch = location.pathname.match(/(MLBU\d+)/i);
    if (catalogMatch) return catalogMatch[1].toUpperCase();
    return null;
  }
  function extractSpecs() {
    const rows = Array.from(document.querySelectorAll(".ui-vpp-highlighted-specs__striped-specs tr, .andes-table tr, .ui-pdp-specs__table tr"));
    const specs = {};
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll("th, td")).map((c) => c.textContent.trim().replace(/\s+/g, " "));
      if (cells.length >= 2 && cells[0] && cells[1] && cells[0] !== cells[1]) specs[cells[0]] = cells[1];
    }
    return specs;
  }
  function extractDescription() {
    const el = document.querySelector(".ui-pdp-description__content, .ui-pdp-description p, [data-testid='content'] p");
    if (el) return el.textContent.trim();
    return null;
  }
  function extractImages() {
    const imgs = Array.from(document.querySelectorAll(".ui-pdp-gallery__figure img, .ui-pdp-image, figure.ui-pdp-gallery__figure img"));
    const urls = new Set();
    for (const img of imgs) {
      const src = img.getAttribute("data-zoom") || img.getAttribute("data-src") || img.src;
      if (src && !src.startsWith("data:")) {
        // Only keep product images, not logos/svgs
        if (/svgs?|logos|payment|storage/.test(src)) continue;
        // Normalize to highest resolution
        const clean = src.replace(/-[A-Z]\.(jpg|webp|png)$/i, "-F.$1").replace(/\/2X_/, "/");
        urls.add(clean);
      }
    }
    return Array.from(urls).slice(0, 15);
  }

  let cachedAd = null;
  function scrapeCurrentAd() {
    if (cachedAd && Date.now() - cachedAd.scrapedAt < 5000) return cachedAd;
    const ld = parseLdJsonProduct();
    const subtitle = firstText([".ui-pdp-subtitle", '[class*="subtitle"]']);
    const title = firstText(["h1.ui-pdp-title", "h1"]) || ld?.name || document.title;
    const price = parsePriceFromDom() ?? ld?.offers?.price ?? null;
    const soldQuantityApprox = parseSoldQuantity(subtitle);
    const rating = firstText([".ui-pdp-review__rating", '[class*="review__rating"]']);
    const reviewsCountRaw = firstText([".ui-pdp-review__amount", '[class*="review__amount"]']);
    const reviewsCount = reviewsCountRaw ? Number(reviewsCountRaw.replace(/[^\d]/g, "")) : null;
    const seller = firstText([".ui-pdp-seller__link-trigger-button", ".ui-box-component-pdp__visible a", '[class*="seller"] a']);
    const stockText = firstText([".ui-pdp-stock-information", '[class*="stock-information"]']);
    const breadcrumb = Array.from(document.querySelectorAll(".andes-breadcrumb__item")).map((e) => e.textContent.trim());
    const isOfficialStore = /Loja Oficial/i.test(document.body.innerText);
    cachedAd = {
      itemId: extractItemId(), url: location.href.split("#")[0], title, description: extractDescription() || ld?.description || null,
      price, currency: ld?.offers?.priceCurrency || "BRL", soldQuantityApprox,
      revenueApprox: price && soldQuantityApprox ? Math.round(price * soldQuantityApprox) : null,
      rating: rating ? Number(rating.replace(",", ".")) : null, reviewsCount, seller, stockText,
      category: breadcrumb.join(" > ") || null, isOfficialStore, images: extractImages(), specs: extractSpecs(), scrapedAt: Date.now(),
    };
    return cachedAd;
  }
  function isProductPage() {
    const url = location.href;
    // Só ativa em página de detalhe do produto (/MLB ou /up/MLBU)
    // Ignora: listagem (/lista/), busca (/search), vendedor (/_CustId_), carrinho (/gz/cart)
    if (/\/gz\//.test(url) || /\/jm\//.test(url) || /\/_CustId_/.test(url) || /\/myaccount\//.test(url)) return false;
    if (/\/lista\./.test(url) && !/\/MLB\d+/.test(url)) return false;
    return /\/MLB\d+|\/p\/MLB|\/up\/MLBU/.test(url) && !!(document.querySelector("h1") && (parsePriceFromDom() || parseLdJsonProduct()));
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }

  // ========== STATE & CREDITS ==========
  let storeCache = null;
  async function getStore() {
    if (storeCache) return storeCache;
    storeCache = await chrome.runtime.sendMessage({ type: "GET_ALL" });
    return storeCache;
  }
  // Só o saldo de créditos de integração. O saldo de IA saiu junto com a
  // geração de mídia — a extensão não consome crédito de IA em lugar nenhum.
  async function refreshCredits() {
    const store = await getStore();
    if (!store.apiKey) return { credits: "?" };
    const r = await chrome.runtime.sendMessage({ type: "CALL_MCP", action: "credits_status", params: {} });
    storeCache = await chrome.runtime.sendMessage({ type: "GET_ALL" });
    return { credits: r.ok ? (r.data?.paid_credits_balance ?? r.data?.credits_balance ?? "?") : "?" };
  }

  // ========== SCORING ==========
  function scoreColor(v) { return v >= 80 ? "green" : v >= 50 ? "yellow" : "red"; }
  function renderGauge(label, value) {
    const pct = Math.max(0, Math.min(100, value));
    return `<div class="mcspy-gauge"><div class="mcspy-gauge-bar-bg"><div class="mcspy-gauge-bar-fill ${scoreColor(pct)}" style="width:${pct}%"></div></div><div class="mcspy-gauge-label"><span>${label}</span><span>${pct}%</span></div></div>`;
  }
  function scoreAd(ad) {
    const title = ad.title || "", desc = ad.description || "", imgs = ad.images || [], specs = ad.specs || {};
    const st = t => { let s = t.length >= 30 && t.length <= 70 ? 50 : t.length >= 20 ? 30 : 10; if (/marca|modelo|cor|tamanho|kit|original|novo|garantia/i.test(t)) s += 30; if (!/[🛑🔴🚀🔥💥]/.test(t)) s += 10; if (t.toUpperCase() !== t) s += 10; return Math.min(100, s); };
    const sd = d => { if (!d) return 0; let s = 30; if (d.length >= 300) s += 25; if (d.length >= 600) s += 15; s += Math.min(20, d.split(/\n\n|\r\n\r\n/).length * 10); return Math.max(0, Math.min(100, s)); };
    const si = i => i.length >= 7 ? 100 : i.length >= 5 ? 85 : i.length >= 3 ? 70 : i.length ? i.length * 15 : 10;
    const ss = s => { const n = Object.keys(s).length; return n >= 10 ? 100 : n >= 6 ? 85 : n >= 3 ? 60 : n ? n * 15 : 10; };
    const sb = d => { if (!d) return 0; return Math.min(100, (d.match(/\b(benefício|vantagem|economia|conforto|praticidade|qualidade|segurança|garantia)\b/gi) || []).length * 15 + 20); };
    const se = d => { if (!d) return 0; let s = 20; if (/[•\-\*]/.test(d)) s += 30; if (d.includes("\n\n")) s += 25; if (d.length > 500) s += 25; return Math.min(100, s); };
    const sinc = d => { if (!d) return 0; return /inclui|contém|acompanha|kit|vem com|incluso/i.test(d) ? 70 : 20; };
    const sco = (t, d) => { let s = 30; const tx = (t + " " + d).toLowerCase(); if (/frete grátis|entrega rápida/i.test(tx)) s += 25; if (/nota fiscal|garantia/i.test(tx)) s += 25; if (/loja|desde \d{4}|anos de mercado/i.test(tx)) s += 20; return Math.min(100, s); };
    return {
      geral: Math.round((st(title) + sd(desc) + si(imgs) + ss(specs) + sb(desc) + se(desc) + sinc(desc) + sco(title, desc)) / 8),
      descricao: sd(desc), imagens: si(imgs), seo: st(title), especificacoes: ss(specs),
      beneficios: sb(desc), estrutura: se(desc), inclusos: sinc(desc), confianca: sco(title, desc),
    };
  }

  // ========== GAUGES INLINE ==========
  function injectPageGauges(ad, attempt = 0) {
    if (document.getElementById(GAUGE_HOST_ID)) return;
    const diag = scoreAd(ad);
    const anchor = document.querySelector(".ui-pdp-price__main-container") || document.querySelector(".ui-pdp-price") || document.querySelector("h1.ui-pdp-title") || document.querySelector("h1");
    if (!anchor) {
      // Máx. 5 tentativas — sem cap, páginas sem anchor viravam loop infinito
      if (attempt < 5) setTimeout(() => injectPageGauges(scrapeCurrentAd(), attempt + 1), 1500);
      return;
    }
    const host = document.createElement("div");
    host.id = GAUGE_HOST_ID;
    const metrics = [
      { label: "Descrição", val: diag.descricao }, { label: "Imagens", val: diag.imagens },
      { label: "SEO", val: diag.seo }, { label: "Especificações", val: diag.especificacoes },
      { label: "Benefícios", val: diag.beneficios }, { label: "Estrutura", val: diag.estrutura },
      { label: "Inclusos", val: diag.inclusos }, { label: "Confiança", val: diag.confianca },
    ];
    const circles = metrics.map(m => {
      const clr = scoreColor(m.val);
      const radius = 22, circumference = 2 * Math.PI * radius, offset = circumference - (m.val / 100) * circumference;
      return `<div class="mcspy-gc" title="${m.label}: ${m.val}%" role="meter" aria-valuenow="${m.val}" aria-valuemin="0" aria-valuemax="100" aria-label="${m.label} ${m.val}%"><svg width="52" height="52" aria-hidden="true"><circle cx="26" cy="26" r="${radius}" fill="none" stroke="#e9ecef" stroke-width="4"/><circle cx="26" cy="26" r="${radius}" fill="none" stroke="${clr==='green'?'#1e7e34':clr==='yellow'?'#e6a817':'#c0392b'}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" transform="rotate(-90 26 26)" style="transition:stroke-dashoffset 0.6s"/><text x="26" y="29" text-anchor="middle" font-size="13" font-weight="700" fill="#333">${m.val}</text></svg><span class="mcspy-gc-label">${m.label}</span></div>`;
    }).join("");
    const shipping = extractShipping();
    // Check if own listing (async, resolve later)
    const actionsHtml = '';
    host.innerHTML = `<div class="mcspy-page-gauge"><div class="mcspy-page-gauge-header"><div class="mcspy-page-score ${scoreColor(diag.geral)}"><span class="mcspy-page-score-val">${diag.geral}</span></div><div class="mcspy-page-title">Score do Anúncio${shipping ? `<span style="display:block;font-size:11px;color:#666;font-weight:500;margin-top:2px">${escapeHtml(shipping)}</span>` : ''}<span style="display:block;font-size:10px;color:#aaa;font-weight:400">Marketplace Connect</span></div></div><div class="mcspy-page-circles">${circles}</div>${actionsHtml}</div>`;
    if (anchor.nextSibling) anchor.parentNode.insertBefore(host, anchor.nextSibling);
    else anchor.parentNode.appendChild(host);
    const style = document.createElement("style");
    style.textContent = `.mcspy-page-gauge{margin:10px 0;padding:14px 16px;background:#fff;border:1px solid #e5e5e5;border-radius:12px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;display:block;box-shadow:0 1px 4px rgba(0,0,0,.04)}.mcspy-page-gauge-header{display:flex;align-items:center;gap:12px;margin-bottom:14px}.mcspy-page-score{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:18px;flex-shrink:0}.mcspy-page-score.green{background:#1e7e34}.mcspy-page-score.yellow{background:#e6a817}.mcspy-page-score.red{background:#c0392b}.mcspy-page-title{font-size:14px;font-weight:600;color:#333}.mcspy-page-circles{display:flex;gap:14px;flex-wrap:wrap;justify-content:flex-start}.mcspy-gc{display:flex;flex-direction:column;align-items:center;gap:3px}.mcspy-gc svg{display:block}.mcspy-gc-label{font-size:10px;color:#666;text-align:center;max-width:52px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mcspy-page-actions{display:flex;gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid #eee;justify-content:center}.mcspy-page-btn{padding:8px 16px;border-radius:8px;border:1px solid #2968c8;background:#fff;color:#2968c8;cursor:pointer;font-size:13px;font-weight:600;font-family:inherit}.mcspy-page-btn:hover{background:#2968c8;color:#fff}`;
    host.appendChild(style);
  }

  // ========== FLOATING PANEL ==========
  let shadowRoot = null, panelBody = null;
  function injectPanel() {
    if (document.getElementById(PANEL_ID)) return;
    const host = document.createElement("div");
    host.id = PANEL_ID;
    Object.assign(host.style, { position: "fixed", zIndex: "2147483000", bottom: "20px", right: "20px" });
    document.documentElement.appendChild(host);
    shadowRoot = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = MCSPY_CSS;
    shadowRoot.appendChild(style);
    const wrap = document.createElement("div");
    wrap.className = "mcspy-wrap";
    wrap.innerHTML = `<button class="mcspy-fab" title="Análise de Produtos">🔍</button><div class="mcspy-panel mcspy-hidden"><div class="mcspy-header"><span>Análise de Produtos</span><button class="mcspy-close">✕</button></div><div class="mcspy-body">Carregando…</div></div>`;
    shadowRoot.appendChild(wrap);
    shadowRoot.querySelector(".mcspy-fab").addEventListener("click", () => {
      const p = shadowRoot.querySelector(".mcspy-panel");
      p.classList.toggle("mcspy-hidden");
      if (!p.classList.contains("mcspy-hidden")) renderPanel();
    });
    shadowRoot.querySelector(".mcspy-close").addEventListener("click", () => shadowRoot.querySelector(".mcspy-panel").classList.add("mcspy-hidden"));
    panelBody = shadowRoot.querySelector(".mcspy-body");
  }
  function toast(msg) {
    if (!shadowRoot) return;
    const t = document.createElement("div"); t.className = "mcspy-toast"; t.textContent = msg;
    shadowRoot.querySelector(".mcspy-wrap").appendChild(t);
    setTimeout(() => t.remove(), 2400);
  }

  // ========== RENDER PANEL ==========
  async function renderPanel() {
    if (!isProductPage()) { panelBody.innerHTML = `<p class="mcspy-muted">Nenhum anúncio detectado.</p>`; return; }
    const ad = scrapeCurrentAd();
    const state = await new Promise(r => chrome.runtime.sendMessage({ type: "GET_STATE_FOR_ITEM", itemId: ad.itemId }, r));
    const hasKey = state?.hasApiKey || false;
    let isOwn = state?.isOwn || false;
    const tracked = state?.tracked || false;
    const diag = scoreAd(ad);
    const creds = hasKey ? await refreshCredits() : null;

    // Renderiza HTML base
    panelBody.innerHTML = `
      <div class="mcspy-tabs">
        <button class="mcspy-tab active" data-panel="panel-main">Info</button>
        <button class="mcspy-tab" data-panel="panel-seo">🔤 SEO</button>
        <button class="mcspy-tab" data-panel="panel-calc">💰 Calculadora</button>
      </div>
      <div id="panel-main" class="mcspy-panel-tab active">
        <div class="mcspy-score-header">
          <div class="mcspy-score-circle ${scoreColor(diag.geral)}"><span class="mcspy-score-value">${diag.geral}</span><span class="mcspy-score-label">Score</span></div>
          <div class="mcspy-score-subtitle">Diagnóstico</div>
          ${creds ? `<div class="mcspy-credit-badge">🪙 ${creds.credits}</div>` : ''}
        </div>
        <div class="mcspy-gauges">${renderGauge("Descrição",diag.descricao)}${renderGauge("Imagens",diag.imagens)}${renderGauge("SEO",diag.seo)}${renderGauge("Especificações",diag.especificacoes)}${renderGauge("Benefícios",diag.beneficios)}${renderGauge("Estrutura",diag.estrutura)}${renderGauge("Inclusos",diag.inclusos)}${renderGauge("Confiança",diag.confianca)}</div>
        <div class="mcspy-card">
          <div class="mcspy-title">${escapeHtml(ad.title || "")}</div>
          <div class="mcspy-row"><span>Preço</span><b>${ad.price ? "R$ " + ad.price.toFixed(2) : "—"}</b></div>
          <div class="mcspy-row"><span>Vendidos</span><b>${ad.soldQuantityApprox ?? "—"}</b></div>
          <div class="mcspy-row"><span>Avaliação</span><b>${ad.rating ?? "—"} (${ad.reviewsCount ?? 0})</b></div>
          <div class="mcspy-row"><span>Vendedor</span><b>${escapeHtml(ad.seller || "—")}</b></div>
        </div>
        <div class="mcspy-actions">
          <button class="mcspy-btn" id="mcspy-analyze">🔎 Analisar</button>
          <button class="mcspy-btn" id="mcspy-copy">📋 Estratégia</button>
          <button class="mcspy-btn ${tracked?'mcspy-btn-active':''}" id="mcspy-track">${tracked?'★ Monitorando':'☆ Monitorar'}</button>
        </div>
        ${!hasKey ? `<div class="mcspy-hint">Configure sua API key nas opções para desbloquear tudo.</div>` : ''}
        <div class="mcspy-result" id="mcspy-result"></div>
      </div>
      <div id="panel-seo" class="mcspy-panel-tab"></div>
      <div id="panel-calc" class="mcspy-panel-tab"></div>
    `;

    // Tab switching
    panelBody.querySelectorAll(".mcspy-tab").forEach(tab => tab.addEventListener("click", () => {
      panelBody.querySelectorAll(".mcspy-tab,.mcspy-panel-tab").forEach(e => e.classList.remove("active"));
      tab.classList.add("active");
      panelBody.querySelector(`#${tab.dataset.panel}`)?.classList.add("active");
    }));

    const resultBox = panelBody.querySelector("#mcspy-result");

    // Estratégia — copia prompt otimizado
    panelBody.querySelector("#mcspy-copy").addEventListener("click", async () => {
      const specLines = Object.entries(ad.specs || {}).map(([k,v]) => `- ${k}: ${v}`).join("\n") || "(nenhuma)";
      const prompt = [
        `Escreva um anúncio autoral para o MEU produto. Os dados abaixo são referência de mercado — servem para entender categoria, faixa de preço e quais atributos os compradores esperam ver. O texto final precisa ser original, escrito do zero.`,
        `\n=== REFERÊNCIA DE MERCADO ===`,
        `Produto de referência: ${ad.title}`,
        `Preço praticado: ${ad.price ? "R$ " + ad.price.toFixed(2) : "N/D"}`,
        `Categoria: ${ad.category}`,
        `Atributos técnicos esperados na categoria:\n${specLines}`,
        `\n=== MEU PRODUTO (preencha) ===`,
        `Meu título: [ESCREVA AQUI]`,
        `Minha marca: [SUA MARCA]`,
        `Diferenciais do meu produto: [O QUE O SEU TEM DE DIFERENTE]`,
        `Meu preço alvo: R$ ${ad.price ? (ad.price * 0.95).toFixed(2).replace(".", ",") : "[VALOR]"} (referência de mercado -5%)`,
        `Estoque: [QUANTIDADE]`,
        `Fotos: use fotos do seu próprio produto — não reutilize imagem de outro vendedor.`,
      ].join("\n");
      try { await navigator.clipboard.writeText(prompt); toast("Estratégia copiada!"); } catch (_) { resultBox.innerHTML = `<pre style="font-size:10px;white-space:pre-wrap">${escapeHtml(prompt)}</pre>`; }
    });

    // Monitorar
    panelBody.querySelector("#mcspy-track").addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: tracked ? "UNTRACK_COMPETITOR" : "TRACK_COMPETITOR", ad }, () => {
        storeCache = null; // estado mudou no background; invalida cache local
        toast(tracked ? "Removido." : "Monitorando!");
        renderPanel();
      });
    });

    // Analisar (chama API + detecta isOwn + clips)
    panelBody.querySelector("#mcspy-analyze").addEventListener("click", async () => {
      resultBox.innerHTML = `<p class="mcspy-muted">Analisando com Marketplace Connect...</p>`;
      const res = await new Promise(r => chrome.runtime.sendMessage({ type: "ANALYZE_AD", ad }, r));
      if (!res || res.error) { resultBox.innerHTML = `<p class="mcspy-muted">${escapeHtml(res?.error || "Erro.")}</p>`; return; }

      // Anúncio próprio: só sinaliza. A extensão não escreve em nada.
      if (res.isOwn && hasKey && !panelBody.querySelector(".mcspy-badge-own")) {
        const badge = document.createElement("div");
        badge.className = "mcspy-badge mcspy-badge-own";
        badge.textContent = "✅ Seu anúncio (verificado)";
        panelBody.querySelector(".mcspy-card")?.appendChild(badge);
      }

      // Renderiza resultado
      const parts = [];
      if (res.priceBenchmark) {
        parts.push(`<div class="mcspy-row"><span>Preço médio catálogo</span><b>R$ ${res.priceBenchmark.avg.toFixed(2)}</b></div>`);
        parts.push(`<div class="mcspy-row"><span>Faixa</span><b>R$ ${res.priceBenchmark.min.toFixed(2)} – R$ ${res.priceBenchmark.max.toFixed(2)}</b></div>`);
        parts.push(`<div class="mcspy-row"><span>Vendedores</span><b>${res.priceBenchmark.sellersCount}</b></div>`);
      }
      if (res.similarCount != null) parts.push(`<div class="mcspy-row"><span>Similares</span><b>${res.similarCount}</b></div>`);
      if (res.hasClips) parts.push(`<div class="mcspy-row"><span>🎬 Clips</span><b>${res.clipsCount} vídeo(s) — ✅ ATIVO</b></div>`);
      else parts.push(`<div class="mcspy-row"><span>🎬 Clips</span><b style="color:#c0392b">OFF</b></div>`);
      if (res.note) parts.push(`<p class="mcspy-muted">${escapeHtml(res.note)}</p>`);
      resultBox.innerHTML = parts.join("") || `<p class="mcspy-muted">Sem dados.</p>`;
    });


    // SEO panel (diagnóstico local; a posição na busca é sob clique)
    const seoPanel = panelBody.querySelector("#panel-seo");
    seoPanel.innerHTML = renderSeoPanel(ad);
    setupSeoHandlers(seoPanel, ad);

    // Calculadora panel (sempre visível)
    const calcPanel = panelBody.querySelector("#panel-calc");
    calcPanel.innerHTML = renderCalculatorPanel(ad, creds);
    setupCalculatorHandlers(calcPanel, ad, creds);
  }

  // ========== SEO / DESCRIÇÃO / RANKING ==========

  // Leitura apenas. O diagnóstico de título e descrição roda local, sem rede.
  // A posição na busca é a única parte que chama a API, e só sob clique.

  const STOPWORDS = new Set(["de","da","do","das","dos","e","com","para","por","em","no","na","a","o","as","os","um","uma","pra","sem","kit","novo","nova","original","promocao","promoção","frete","gratis","grátis","envio","imediato","oferta","barato"]);

  // Consulta sugerida: o que sobra do título depois de tirar conectivo e
  // palavra de vitrine. É sugestão — o campo fica editável porque posição só
  // significa alguma coisa junto do termo que a produziu.
  function sugerirConsulta(title) {
    return (title || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOPWORDS.has(w))
      .slice(0, 5)
      .join(" ");
  }

  function diagnosticarTitulo(title) {
    const t = title || "";
    const achados = [];
    const n = t.length;

    if (n < 20) achados.push({ nivel: "ruim", txt: `${n} caracteres — curto demais para descrever o produto` });
    else if (n < 40) achados.push({ nivel: "meio", txt: `${n} caracteres — cabe mais atributo de busca` });
    else if (n <= 60) achados.push({ nivel: "bom", txt: `${n} caracteres — dentro do que aparece inteiro na busca` });
    else achados.push({ nivel: "meio", txt: `${n} caracteres — o que passa de 60 costuma ser cortado na listagem` });

    if (t === t.toUpperCase() && /[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(t)) achados.push({ nivel: "ruim", txt: "Tudo em maiúscula — o ML penaliza e o comprador lê pior" });
    if (/[🛑🔴🚀🔥💥⭐✅❗️★☆]/.test(t)) achados.push({ nivel: "ruim", txt: "Emoji ou símbolo no título — não é indexado e ocupa espaço" });
    if (/\b(promo(ção|cao)|frete gr[áa]tis|imperd[íi]vel|oferta|barato|melhor pre[çc]o)\b/i.test(t)) achados.push({ nivel: "meio", txt: "Palavra de vitrine no título — não é termo de busca, gasta caractere" });

    const palavras = t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/\w{3,}/g) || [];
    const repetida = palavras.find((w, i) => palavras.indexOf(w) !== i && !STOPWORDS.has(w));
    if (repetida) achados.push({ nivel: "meio", txt: `"${repetida}" aparece mais de uma vez — repetição não melhora ranking` });

    if (!/\d/.test(t)) achados.push({ nivel: "meio", txt: "Sem número — modelo, medida, capacidade ou quantidade ajudam quem busca por especificação" });

    if (achados.every(a => a.nivel === "bom")) achados.push({ nivel: "bom", txt: "Nenhum problema estrutural encontrado" });
    return achados;
  }

  function diagnosticarDescricao(desc, title) {
    const d = desc || "";
    const achados = [];
    if (!d) return [{ nivel: "ruim", txt: "Sem descrição — é o campo que mais pesa depois do título" }];

    const n = d.length;
    if (n < 300) achados.push({ nivel: "ruim", txt: `${n} caracteres — curta; 600+ costuma converter melhor` });
    else if (n < 600) achados.push({ nivel: "meio", txt: `${n} caracteres — aceitável, dá para desenvolver mais` });
    else achados.push({ nivel: "bom", txt: `${n} caracteres` });

    const paragrafos = d.split(/\n\s*\n/).filter(p => p.trim()).length;
    if (paragrafos <= 1) achados.push({ nivel: "ruim", txt: "Bloco único de texto — quebrar em parágrafos aumenta a leitura até o fim" });
    else achados.push({ nivel: "bom", txt: `${paragrafos} parágrafos` });

    if (!/[•\-\*]\s/.test(d)) achados.push({ nivel: "meio", txt: "Sem lista — comprador varre bullet, não lê parágrafo corrido" });
    if (!/(inclui|cont[ée]m|acompanha|vem com|incluso)/i.test(d)) achados.push({ nivel: "meio", txt: "Não diz o que vem na caixa — origem comum de pergunta e de reclamação" });
    if (!/(garantia|nota fiscal)/i.test(d)) achados.push({ nivel: "meio", txt: "Sem menção a garantia ou nota fiscal" });

    // Descrição que só repete o título não acrescenta termo novo à indexação
    const tTermos = new Set((title || "").toLowerCase().match(/\w{4,}/g) || []);
    const dTermos = new Set((d.toLowerCase().match(/\w{4,}/g) || []));
    const novos = [...dTermos].filter(w => !tTermos.has(w));
    if (novos.length < 15) achados.push({ nivel: "meio", txt: `Só ${novos.length} termos que não estão no título — a descrição é onde entram as variações de busca` });
    else achados.push({ nivel: "bom", txt: `${novos.length} termos além dos do título` });

    return achados;
  }

  function renderAchados(lista) {
    const cor = { bom: "#1e7e34", meio: "#e6a817", ruim: "#c0392b" };
    const icone = { bom: "✓", meio: "!", ruim: "✕" };
    return lista.map(a => `<div class="mcspy-seo-item"><b style="color:${cor[a.nivel]}">${icone[a.nivel]}</b><span>${escapeHtml(a.txt)}</span></div>`).join("");
  }

  function renderSeoPanel(ad) {
    const t = ad.title || "";
    const visivel = escapeHtml(t.slice(0, 60));
    const cortado = escapeHtml(t.slice(60));
    return `<div class="mcspy-seo">
      <h3>🔤 Título</h3>
      <div class="mcspy-seo-preview">${visivel}${cortado ? `<span class="mcspy-seo-cut">${cortado}</span>` : ""}</div>
      <p class="mcspy-muted" style="margin:2px 0 8px">${cortado ? "O trecho esmaecido é o que costuma ser cortado na listagem de busca." : "Cabe inteiro na listagem de busca."}</p>
      ${renderAchados(diagnosticarTitulo(t))}

      <h3 style="margin-top:14px">📄 Descrição</h3>
      ${renderAchados(diagnosticarDescricao(ad.description, t))}

      <h3 style="margin-top:14px">📊 Posição na busca</h3>
      <p class="mcspy-muted" style="margin:0 0 6px">Procura este anúncio nos primeiros 200 resultados do termo abaixo. Posição só significa algo junto do termo que a produziu — ajuste antes de consultar.</p>
      <div class="mcspy-edit-field"><input type="text" id="seo-query" value="${escapeHtml(sugerirConsulta(t))}"/></div>
      <button class="mcspy-btn mcspy-btn-primary" id="btn-seo-rank" style="width:100%">Ver posição</button>
      <div class="mcspy-result" id="seo-rank-result"></div>
    </div>`;
  }

  function setupSeoHandlers(container, ad) {
    container.querySelector("#btn-seo-rank")?.addEventListener("click", async () => {
      const box = container.querySelector("#seo-rank-result");
      const q = container.querySelector("#seo-query")?.value.trim();
      if (!q) { box.innerHTML = `<p class="mcspy-muted">Informe um termo.</p>`; return; }
      if (!ad.itemId) { box.innerHTML = `<p class="mcspy-muted">Não identifiquei o ID deste anúncio.</p>`; return; }

      const store = await getStore();
      if (!store.apiKey) { box.innerHTML = `<p class="mcspy-muted">Precisa da API key nas opções para consultar a busca.</p>`; return; }

      const PAGINA = 50, MAX = 200;
      let total = null;
      for (let offset = 0; offset < MAX; offset += PAGINA) {
        box.innerHTML = `<p class="mcspy-muted">Procurando… ${offset + 1}–${offset + PAGINA}</p>`;
        const r = await chrome.runtime.sendMessage({ type: "CALL_MCP", action: "search", params: { q, limit: PAGINA, offset } });
        if (!r?.ok) { box.innerHTML = `<p class="mcspy-muted">❌ ${escapeHtml(r?.error || "Falha na busca")}</p>`; return; }
        const results = r.data?.results || [];
        if (total == null) total = r.data?.paging?.total ?? null;
        const i = results.findIndex(x => String(x.id).toUpperCase() === ad.itemId.toUpperCase());
        if (i >= 0) {
          const pos = offset + i + 1;
          const pagina = Math.ceil(pos / 50);
          box.innerHTML = `
            <div class="mcspy-row"><span>Posição</span><b style="color:#1e7e34;font-size:16px">${pos}º</b></div>
            <div class="mcspy-row"><span>Página da busca</span><b>${pagina}</b></div>
            ${total != null ? `<div class="mcspy-row"><span>Anúncios no termo</span><b>${total.toLocaleString("pt-BR")}</b></div>` : ""}
            <p class="mcspy-muted" style="margin-top:6px">Para "${escapeHtml(q)}", sem filtro e sem personalização. O que você vê logado na sua conta pode diferir.</p>`;
          return;
        }
        if (results.length < PAGINA) break; // acabaram os resultados antes do teto
      }
      box.innerHTML = `<p class="mcspy-muted">Não apareceu nos primeiros ${MAX} resultados de "${escapeHtml(q)}"${total != null ? ` (${total.toLocaleString("pt-BR")} anúncios no termo)` : ""}.</p>
        <p class="mcspy-muted" style="font-size:10px">Termo muito genérico costuma dar isso. Tente algo mais próximo do que o comprador digitaria para achar este produto especificamente.</p>`;
    });
  }

  // ========== CALCULATOR PANEL ==========
  function renderCalculatorPanel(ad, creds) {
    const price = ad.price || 0;
    const cat = (ad.category || "").split(">").pop()?.trim() || "";
    return `<div class="mcspy-calc"><h3>💰 Calculadora de Margem</h3>
      <div class="mcspy-edit-field"><label>Custo do produto (R$)</label><input type="text" id="calc-cost" value="" placeholder="Quanto você pagou?" inputmode="decimal"/></div>
      <div class="mcspy-edit-field"><label>Margem desejada (%)</label><input type="text" id="calc-margin" value="30" placeholder="30" inputmode="decimal"/></div>
      <div class="mcspy-edit-field"><label>Preço do concorrente</label><input type="text" id="calc-competitor-price" value="${price ? price.toFixed(2) : ''}" placeholder="R$ 29,99" inputmode="decimal"/></div>
      <div class="mcspy-edit-field"><label>Categoria estimada</label><input type="text" id="calc-category" value="${escapeHtml(cat)}" placeholder="MLB438524" readonly style="background:#f5f5f5"/></div>
      <div class="mcspy-edit-field"><label>Comissão ML (%)</label><input type="text" id="calc-commission" value="12" placeholder="12" inputmode="decimal"/></div>
      <div class="mcspy-edit-field"><label>Frete (R$)</label><input type="text" id="calc-freight" value="14" placeholder="14" inputmode="decimal"/></div>
      <div class="mcspy-edit-field"><label>Imposto (%)</label><input type="text" id="calc-tax" value="5" placeholder="5" inputmode="decimal"/></div>
      <button class="mcspy-btn mcspy-btn-primary" id="btn-calc-profit" style="width:100%">📊 Calcular preço ideal</button>
      <div class="mcspy-result" id="calc-result" style="margin-top:10px"></div>
      <p class="mcspy-muted" style="margin-top:8px">Taxa fixa de R$ 5,50 para produtos abaixo de R$ 79. Cálculo: (custo × (1+margem) + frete + taxa fixa) ÷ (1−comissão−imposto)</p>
    </div>`;
  }
  function setupCalculatorHandlers(container, ad, creds) {
    container.querySelector("#btn-calc-profit")?.addEventListener("click", () => {
      const cost = parseFloat(String(container.querySelector("#calc-cost")?.value||"0").replace(",","."));
      const marginPct = parseFloat(String(container.querySelector("#calc-margin")?.value||"30").replace(",",".")) / 100;
      const commissionPct = parseFloat(String(container.querySelector("#calc-commission")?.value||"12").replace(",",".")) / 100;
      const freight = parseFloat(String(container.querySelector("#calc-freight")?.value||"14").replace(",","."));
      const taxPct = parseFloat(String(container.querySelector("#calc-tax")?.value||"5").replace(",",".")) / 100;
      const competitorPrice = parseFloat(String(container.querySelector("#calc-competitor-price")?.value||"0").replace(",","."));
      if (!cost || cost <= 0) {
        container.querySelector("#calc-result").innerHTML = `<p class="mcspy-muted">❌ Informe o custo do produto.</p>`;
        return;
      }
      const divisor = 1 - commissionPct - taxPct;
      if (divisor <= 0) { container.querySelector("#calc-result").innerHTML = `<p class="mcspy-muted">❌ Comissão + imposto > 100%.</p>`; return; }
      // Taxa fixa entra no numerador (senão a margem desejada não fecha).
      // Se o preço sem taxa já passa de R$79, taxa não se aplica.
      const base = cost * (1 + marginPct) + freight;
      let sellingPrice = base / divisor;
      let fixedFee = 0;
      if (sellingPrice < 79) {
        fixedFee = 5.50;
        sellingPrice = (base + fixedFee) / divisor;
      }
      const profit = sellingPrice - cost - (sellingPrice * commissionPct) - freight - (sellingPrice * taxPct) - fixedFee;
      const marginReal = cost > 0 ? (profit / cost * 100) : 0;
      const diffFromCompetitor = competitorPrice > 0 ? ((sellingPrice - competitorPrice) / competitorPrice * 100) : null;
      container.querySelector("#calc-result").innerHTML = `
        <div class="mcspy-row"><span>💰 Preço de venda</span><b style="color:#1e7e34;font-size:16px">R$ ${sellingPrice.toFixed(2)}</b></div>
        <div class="mcspy-row"><span>📈 Lucro líquido</span><b style="color:#1e7e34">R$ ${profit.toFixed(2)}</b></div>
        <div class="mcspy-row"><span>📊 Margem real</span><b>${marginReal.toFixed(1)}%</b></div>
        <div class="mcspy-row"><span>🏷️ Comissão ML</span><b>R$ ${(sellingPrice * commissionPct).toFixed(2)}</b></div>
        <div class="mcspy-row"><span>🚚 Frete</span><b>R$ ${freight.toFixed(2)}</b></div>
        <div class="mcspy-row"><span>📋 Imposto</span><b>R$ ${(sellingPrice * taxPct).toFixed(2)}</b></div>
        ${fixedFee > 0 ? `<div class="mcspy-row"><span>🔒 Taxa fixa (&lt;R$79)</span><b>R$ ${fixedFee.toFixed(2)}</b></div>` : ''}
        ${diffFromCompetitor != null ? `<div class="mcspy-row"><span>⚡ vs Concorrente</span><b style="color:${diffFromCompetitor > 0 ? '#c0392b' : '#1e7e34'}">${diffFromCompetitor > 0 ? '+' : ''}${diffFromCompetitor.toFixed(1)}%</b></div>` : ''}
      `;
    });
  }

  // ========== SHIPPING EXTRACTION ==========
  function extractShipping() {
    const el = document.querySelector(".ui-pdp-container__row--shipping-summary .ui-pdp-media__title, .xprod-lib-shipping-promises__item--regular, [class*='shipping'] [class*='title']");
    if (!el) return null;
    let txt = el.textContent.trim().replace(/\s+/g, " ");
    txt = txt.replace(/ por[\s\S]+/g, "").replace("Chegará entre os dias ", "Chegará entre ").replace("Chegará entre ", "🗓️ ").replace(" e ", " a ");
    return txt;
  }

  // ========== BULK MONITOR (search page) ==========
  function isSearchPage() {
    return /\/mlb\/search\b/.test(location.pathname) || /\/lista\.mercadolivre\.com\.br\//.test(location.href);
  }
  let bulkFabInjected = false;
  function injectBulkMonitor() {
    if (!isSearchPage() || bulkFabInjected) return;
    bulkFabInjected = true;
    const fab = document.createElement("div");
    fab.id = "mcspy-bulk-fab";
    Object.assign(fab.style, { position:"fixed", zIndex:"2147482999", bottom:"80px", right:"20px" });
    fab.innerHTML = `<button style="width:52px;height:52px;border-radius:50%;border:none;cursor:pointer;background:#e6a817;color:#fff;font-size:20px;box-shadow:0 4px 14px rgba(0,0,0,.25);font-weight:700" title="Monitorar todos desta página">📊</button>`;
    document.documentElement.appendChild(fab);
    fab.querySelector("button").addEventListener("click", async () => {
      const links = Array.from(document.querySelectorAll("a.ui-search-link, a.ui-search-item__group__element, a[href*='/MLB']"));
      const ids = [...new Set(links.map(a => { const m = a.href.match(/MLB(\d+)/); return m ? `MLB${m[1]}` : null; }).filter(Boolean))];
      if (!ids.length) return;
      const btn = fab.querySelector("button");
      btn.textContent = "⏳"; btn.style.background = "#888";
      let done = 0;
      for (const id of ids) {
        try {
          const el = document.querySelector(`a[href*="${id}"]`);
          const title = el?.closest(".ui-search-layout__item")?.querySelector(".ui-search-item__title")?.textContent?.trim() || id;
          const priceEl = el?.closest(".ui-search-layout__item")?.querySelector(".andes-money-amount__fraction");
          const price = priceEl ? Number(priceEl.textContent.replace(/\./g,"")) : null;
          await new Promise(r => chrome.runtime.sendMessage({ type: "TRACK_COMPETITOR", ad: { itemId: id, url: `https://produto.mercadolivre.com.br/${id}`, title, price } }, r));
          done++;
          btn.textContent = `${done}/${ids.length}`;
        } catch(_) {}
      }
      btn.textContent = "✅"; btn.style.background = "#1e7e34";
      setTimeout(() => { btn.textContent = "📊"; btn.style.background = "#e6a817"; }, 3000);
    });
  }

  // ========== BOOTSTRAP ==========
  let lastUrl = location.href;
  function boot() {
    if (isProductPage()) {
      try { injectPageGauges(scrapeCurrentAd()); } catch(_) {}
      injectPanel();
      try { chrome.runtime.sendMessage({ type: "PASSIVE_SNAPSHOT", ad: scrapeCurrentAd() }); } catch(_) {}
    }
    if (isSearchPage()) {
      setTimeout(() => injectBulkMonitor(), 1200);
    }
  }
  boot();
  // ML muta o DOM constantemente; throttle evita rodar o check em toda mutação
  let urlCheckTimer = null;
  new MutationObserver(() => {
    if (urlCheckTimer) return;
    urlCheckTimer = setTimeout(() => {
      urlCheckTimer = null;
      if (location.href !== lastUrl) {
        lastUrl = location.href; cachedAd = null; storeCache = null;
        document.getElementById(PANEL_ID)?.remove();
        document.getElementById(GAUGE_HOST_ID)?.remove();
        setTimeout(boot, 800);
      }
    }, 300);
  }).observe(document.body, { childList: true, subtree: true });
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "SCRAPE_CURRENT_PAGE") { sendResponse(isProductPage() ? scrapeCurrentAd() : null); return true; }
  });

  
})();
