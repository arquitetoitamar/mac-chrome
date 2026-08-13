function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

// toFixed(2) cru virava "R$ 57990.00" na receita estimada — ponto decimal e
// sem separador de milhar, que em tela pt-BR lê como erro.
function fmtMoney(n) {
  if (n == null) return "—";
  return `R$ ${Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(ts) {
  if (!ts) return "nunca";
  const d = new Date(ts);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function sparkline(values, width = 90, height = 24) {
  const nums = values.filter((v) => Number.isFinite(v));
  if (nums.length < 2) return "";
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;
  const step = width / (nums.length - 1);
  const points = nums
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`)
    .join(" ");
  const trendUp = nums[nums.length - 1] > nums[0];
  const color = trendUp ? "#c0392b" : "#1e7e34";
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><polyline fill="none" stroke="${color}" stroke-width="1.6" points="${points}" /></svg>`;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// ---------------- Tab: Este anúncio ----------------

async function renderCurrentTab() {
  const el = document.getElementById("tab-current");
  el.innerHTML = `<p class="mcspy-muted">Lendo página atual…</p>`;

  const tab = await getActiveTab();
  if (!tab?.url || !/mercado(livre|libre)\.com/.test(tab.url)) {
    el.innerHTML = `<div class="mcspy-empty">Abra um anúncio no Mercado Livre para ver os dados aqui.</div>`;
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type: "SCRAPE_CURRENT_PAGE" }, (ad) => {
    if (chrome.runtime.lastError || !ad) {
      el.innerHTML = `<div class="mcspy-empty">Nenhum anúncio detectado nesta aba.<br>Abra a página de um produto e reabra o popup.</div>`;
      return;
    }
    el.innerHTML = `
      <div class="mcspy-title">${escapeHtml(ad.title)}</div>
      <div class="mcspy-row"><span>Preço</span><b>${fmtMoney(ad.price)}</b></div>
      <div class="mcspy-row"><span>Vendidos (aprox.)</span><b>${ad.soldQuantityApprox ?? "—"}</b></div>
      <div class="mcspy-row"><span>Receita estimada</span><b>${ad.revenueApprox ? fmtMoney(ad.revenueApprox) : "—"}</b></div>
      <div class="mcspy-row"><span>Avaliação</span><b>${ad.rating ?? "—"} (${ad.reviewsCount ?? 0})</b></div>
      <div class="mcspy-row"><span>Vendedor</span><b>${escapeHtml(ad.seller || "—")}</b></div>
      <div class="mcspy-row"><span>Categoria</span><b style="text-align:right;font-size:11px;">${escapeHtml(ad.category || "—")}</b></div>
      <button class="mcspy-btn mcspy-btn-primary" id="btn-open-panel">Abrir painel completo na página</button>
    `;
    el.querySelector("#btn-open-panel").addEventListener("click", () => window.close());
  });
}

// ---------------- Tab: Concorrentes ----------------

async function renderCompetitorsTab() {
  const el = document.getElementById("tab-competitors");
  el.innerHTML = `<p class="mcspy-muted">Carregando…</p>`;

  const store = await chrome.runtime.sendMessage({ type: "GET_ALL" });
  const competitors = Object.values(store.competitors || {}).sort(
    (a, b) => (b.lastCheckedAt || b.addedAt) - (a.lastCheckedAt || a.addedAt)
  );

  if (competitors.length === 0) {
    el.innerHTML = `<div class="mcspy-empty">Nenhum concorrente monitorado ainda.<br>Use o botão "☆ Monitorar concorrente" no painel do anúncio.</div>`;
    return;
  }

  el.innerHTML =
    competitors.map((c) => {
      const prices = c.history.map((h) => h.price);
      const last = c.history[c.history.length - 1];
      const first = c.history[0];
      let deltaHtml = "";
      if (first && last && first.price && last.price && first !== last) {
        const pct = ((last.price - first.price) / first.price) * 100;
        const cls = pct > 0 ? "mcspy-delta-up" : "mcspy-delta-down";
        deltaHtml = `<span class="${cls}">${pct > 0 ? "▲" : "▼"} ${Math.abs(pct).toFixed(1)}%</span>`;
      }
      const safeUrl = /^https:\/\/[\w.-]+\.mercadoli[bv]re\.com/.test(c.url || "") ? escapeHtml(c.url) : "#";
      return `
        <div class="mcspy-comp-card" data-item="${escapeHtml(c.itemId)}">
          <a class="mcspy-comp-title" href="${safeUrl}" target="_blank" rel="noopener">${escapeHtml(c.title || c.itemId)}</a>
          <div class="mcspy-comp-meta">${escapeHtml(c.seller || "vendedor desconhecido")} · verificado ${fmtDate(c.lastCheckedAt)}${c.lastError ? ` · <span style="color:#c0392b">erro</span>` : ""}</div>
          <div class="mcspy-row"><span>Preço atual</span><b>${fmtMoney(last?.price)} ${deltaHtml}</b></div>
          <div class="mcspy-row"><span>Vendidos (aprox.)</span><b>${last?.soldQuantityApprox ?? "—"}</b></div>
          <div>${sparkline(prices)}</div>
          <div class="mcspy-comp-actions">
            <button data-action="remove" data-item="${escapeHtml(c.itemId)}">Remover</button>
          </div>
        </div>
      `;
    }).join("") +
    `<button class="mcspy-btn" id="btn-poll-now">🔄 Verificar preços agora</button>`;

  el.querySelectorAll('[data-action="remove"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      await chrome.runtime.sendMessage({ type: "REMOVE_COMPETITOR", itemId: btn.dataset.item });
      renderCompetitorsTab();
    });
  });
  el.querySelector("#btn-poll-now").addEventListener("click", async (e) => {
    e.target.textContent = "Verificando…";
    await chrome.runtime.sendMessage({ type: "POLL_NOW" });
    renderCompetitorsTab();
  });
}

// ---------------- Tab: Minha conta ----------------

async function renderAccountTab() {
  const el = document.getElementById("tab-account");
  const store = await chrome.runtime.sendMessage({ type: "GET_ALL" });

  if (!store.apiKey) {
    el.innerHTML = `
      <div class="mcspy-empty">
        Conecte sua conta Marketplace Connect para ver seus próprios anúncios, vendas e créditos aqui —
        e para comparar automaticamente com os concorrentes.
      </div>
      <button class="mcspy-btn mcspy-btn-primary" id="btn-connect">Conectar conta</button>
    `;
    el.querySelector("#btn-connect").addEventListener("click", () => chrome.runtime.openOptionsPage());
    return;
  }

  el.innerHTML = `<p class="mcspy-muted">Buscando dados da conta…</p>`;
  const summary = await chrome.runtime.sendMessage({ type: "GET_ACCOUNT_SUMMARY" });

  if (summary.error) {
    el.innerHTML = `<div class="mcspy-empty">${escapeHtml(summary.error)}</div>`;
    return;
  }

  const credits = summary.credits || {};
  const account = summary.account || {};
  const planType = credits.plan || credits.plan_type || credits.plan_name || "—";
  const planStatus = credits.plan_status || credits.status || "active";
  const creditsBalance = credits.credits ?? credits.balance ?? credits.credits_balance ?? credits.paid_credits_balance ?? "—";
  const accountName = account.nickname || account.name || account.email || store.meliUserId || "—";
  const aiCredits = credits.ai_credits_balance ?? credits.ai_credits ?? 0;

  el.innerHTML = `
    <div class="mcspy-row"><span>Conta</span><b>${escapeHtml(accountName)}</b></div>
    <div class="mcspy-row"><span>ML ID</span><b>${escapeHtml(account.meli_user_id || store.meliUserId || "—")}</b></div>
    <div class="mcspy-row"><span>Plano</span><b>${escapeHtml(planType)}${planStatus === "active" ? " ✅" : ""}</b></div>
    <div class="mcspy-row"><span>Créditos</span><b>${typeof creditsBalance === "number" ? creditsBalance.toLocaleString("pt-BR") : creditsBalance}</b></div>
    <div class="mcspy-row"><span>Créditos IA</span><b>${typeof aiCredits === "number" ? aiCredits.toLocaleString("pt-BR") : aiCredits}</b></div>
    <div class="mcspy-row"><span>Anúncios (amostra)</span><b>${summary.itemsCount ?? "—"}</b></div>
    <div class="mcspy-row"><span>Concorrentes</span><b>${Object.keys(store.competitors || {}).length}</b></div>
    <button class="mcspy-btn" id="btn-manage" style="margin-top:8px">Gerenciar API key</button>
  `;
  el.querySelector("#btn-manage").addEventListener("click", () => chrome.runtime.openOptionsPage());
}

// ---------------- Tabs / bootstrap ----------------

function setupTabs() {
  const tabs = document.querySelectorAll(".mcspy-tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".mcspy-panel-tab").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");
    });
  });
}

document.getElementById("btn-options").addEventListener("click", () => chrome.runtime.openOptionsPage());

setupTabs();
renderCurrentTab();
renderCompetitorsTab();
renderAccountTab();
