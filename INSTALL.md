# Marketplace Connect — Análise de Produtos: Instalação

## Método 1: Chrome Web Store (em breve)

## Método 2: Modo desenvolvedor

1. Baixe este repositório (botão **Code → Download ZIP**) e extraia numa pasta.
2. Abra `chrome://extensions` no Chrome.
3. Ative "Modo do desenvolvedor" (canto superior direito).
4. Clique em "Carregar sem compactação".
5. Selecione a pasta extraída.
6. A extensão aparece na barra de ferramentas.

## Método 3: Via terminal

```bash
git clone https://github.com/arquitetoitamar/mac-chrome.git
```

Depois: `chrome://extensions` → Carregar sem compactação → selecione a pasta
`mac-chrome`.

## Como usar

1. Abra um anúncio no Mercado Livre — o painel de score aparece sozinho.
2. Clique no ícone da extensão para ver concorrentes monitorados, calculadora
   de margem e o resumo da sua conta.

Score, monitoramento, alertas e calculadora funcionam sem conectar conta. A
chave de API do Marketplace Connect é necessária só para as funções que tocam
nos seus próprios anúncios — veja [README.md](README.md).
