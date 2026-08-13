// Cliente da API do Marketplace Connect.
// Contrato: POST { action, params } com a chave no header x-api-key.
// A chave nunca vai na query string: URL completa é gravada em log de acesso
// de CDN/WAF/origem e em ferramentas de APM — header não.

// Host único da API. Já foi uma lista com failover entre marketplaces.tiops.com.br
// e este host; a lista saiu porque marketplaces.tiops.com.br/mcp devolve 301 para
// /mcp/, que por sua vez devolve 404 — ou seja, o host "novo" nunca atendeu a API,
// e declará-lo custava uma permissão de host que a extensão não usava.
// Se a API mudar de domínio, é uma linha aqui + nova versão na loja.
export const MCP_ENDPOINT = "https://mcp.tiops.com.br";

/**
 * POST no endpoint da API.
 */
function postToMcp(apiKey, payload) {
  return fetch(MCP_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify(payload),
  });
}

/**
 * Executa uma "action" do Marketplace Connect.
 * @param {string} apiKey chave no formato mc_live_...
 * @param {string} action nome da action (ex: "credits_status", "list_items")
 * @param {object} params parâmetros da action
 */
export async function callAction(apiKey, action, params = {}) {
  if (!apiKey) return { ok: false, error: "Nenhuma API key configurada." };
  try {
    // Normalize snake_case → camelCase for ML actions that require it
    const normalized = { ...params };
    if (normalized.item_id && !normalized.itemId) normalized.itemId = normalized.item_id;
    if (normalized.product_url && !normalized.productUrl) normalized.productUrl = normalized.product_url;
    if (normalized.meli_user_id && !normalized.meliUserId) normalized.meliUserId = normalized.meli_user_id;
    if (normalized.category_id && !normalized.categoryId) normalized.categoryId = normalized.category_id;

    const res = await postToMcp(apiKey, { action, params: normalized });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch (_) { data = { raw: text }; }

    if (!res.ok) {
      return { ok: false, error: data?.error || data?.message || `HTTP ${res.status}` };
    }

    // AWS Lambda Function URL wraps response in {statusCode, body}
    if (data.body && typeof data.body === "string") {
      try { data = JSON.parse(data.body); } catch (_) {}
    }
    // O backend envolve a resposta em {status|ok|success, data, ...}.
    // Desembrulha quando TODAS as chaves do objeto são chaves de envelope —
    // payload real (item com id/title/seller_id...) nunca casa com isso,
    // então não há clobber de payloads legítimos com campo "data" próprio.
    const ENVELOPE_KEYS = new Set([
      "status", "statusCode", "ok", "success", "data",
      "error", "message", "meta", "request_id", "requestId", "action",
    ]);
    if (
      data.data &&
      typeof data.data === "object" &&
      Object.keys(data).every((k) => ENVELOPE_KEYS.has(k))
    ) {
      data = data.data;
    }

    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err?.message || "Falha de rede ao chamar Marketplace Connect." };
  }
}

export async function validateApiKey(apiKey) {
  return callAction(apiKey, "credits_status");
}
