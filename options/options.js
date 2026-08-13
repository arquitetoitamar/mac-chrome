const inputKey = document.getElementById("input-key");
const btnToggleKey = document.getElementById("btn-toggle-key");
const btnSave = document.getElementById("btn-save");
const btnClear = document.getElementById("btn-clear");
const keyStatus = document.getElementById("key-status");

const intervalSel = document.getElementById("interval");
const pricePctInput = document.getElementById("price-pct");
const soldDeltaInput = document.getElementById("sold-delta");
const notifEnabledInput = document.getElementById("notif-enabled");
const btnSaveSettings = document.getElementById("btn-save-settings");
const settingsStatus = document.getElementById("settings-status");

function setStatus(el, msg, ok) {
  el.textContent = msg;
  el.className = "status " + (ok ? "ok" : "err");
}

async function load() {
  const store = await chrome.runtime.sendMessage({ type: "GET_ALL" });
  if (store.apiKey) inputKey.value = store.apiKey;
  const s = store.settings || {};
  intervalSel.value = String(s.checkIntervalHours ?? 6);
  pricePctInput.value = s.notifyPricePct ?? 5;
  soldDeltaInput.value = s.notifySoldDelta ?? 5;
  notifEnabledInput.checked = s.notificationsEnabled !== false;
}

btnToggleKey.addEventListener("click", () => {
  inputKey.type = inputKey.type === "password" ? "text" : "password";
});

btnSave.addEventListener("click", async () => {
  const key = inputKey.value.trim();
  if (!key) {
    setStatus(keyStatus, "Cole sua API key antes de salvar.", false);
    return;
  }
  setStatus(keyStatus, "Validando…", true);
  const res = await chrome.runtime.sendMessage({ type: "SAVE_API_KEY", apiKey: key });
  if (res.ok) {
    setStatus(keyStatus, "Conectado! Chave validada com sucesso.", true);
  } else {
    setStatus(
      keyStatus,
      `Chave salva, mas não foi possível validar agora (${res.error || "erro desconhecido"}). Verifique se está correta.`,
      false
    );
  }
});

btnClear.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "CLEAR_API_KEY" });
  inputKey.value = "";
  setStatus(keyStatus, "Chave removida.", true);
});

btnSaveSettings.addEventListener("click", async () => {
  const settings = {
    checkIntervalHours: Number(intervalSel.value),
    notifyPricePct: Number(pricePctInput.value) || 5,
    notifySoldDelta: Number(soldDeltaInput.value) || 5,
    notificationsEnabled: notifEnabledInput.checked,
  };
  await chrome.runtime.sendMessage({ type: "SET_SETTINGS", settings });
  setStatus(settingsStatus, "Configurações salvas.", true);
});

load();
