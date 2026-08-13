<p align="center">
  <img src="assets/marketplace-conenct.png" alt="Marketplace Connect" width="600">
</p>

<p align="center">
  <a href="https://marketplaces.tiops.com.br"><strong>🔗 marketplaces.tiops.com.br</strong></a>
</p>

---

# Marketplace Connect — Análise de Produtos

**Extensão Chrome (Manifest V3) para quem vende em marketplace.** Pontua a
qualidade do anúncio na própria página, diagnostica título e descrição, mostra
em que posição ele aparece na busca, acompanha o preço dos concorrentes ao
longo do tempo e calcula margem.

**Somente leitura.** A extensão não altera nenhum anúncio — nem o seu. Ela lê,
mede e informa; o que fazer com isso é decisão sua, no painel do marketplace.

👉 **Conta e chave de API:** [marketplaces.tiops.com.br](https://marketplaces.tiops.com.br)

## Código aberto

Este repositório existe para duas coisas: você auditar o que a extensão faz
antes de instalar, e usar como ponto de partida para construir a sua própria.

Não há build step, minificação nem código remoto — o JavaScript do pacote
publicado é exatamente o que está aqui. Licença MIT: use, modifique e
redistribua, inclusive comercialmente.

## Como instalar (modo desenvolvedor)

1. Abra `chrome://extensions` no Chrome.
2. Ative "Modo do desenvolvedor" (canto superior direito).
3. Clique em "Carregar sem compactação" e selecione a pasta deste repositório.
4. Fixe o ícone da extensão na barra do Chrome (opcional).

## Como conectar sua conta

1. Clique no ícone da extensão → ⚙️ para abrir as opções.
2. Gere uma API key em [marketplaces.tiops.com.br](https://marketplaces.tiops.com.br)
   (Integrações → API Keys).
3. Cole a chave e clique em **Salvar e validar**.

**Sem chave a extensão continua útil:** score do anúncio, monitoramento de
concorrentes, alertas e calculadora de margem funcionam sem conectar conta
nenhuma. A chave só é necessária para as funções que tocam nos seus próprios
anúncios.

## O que ela faz

- **Score do anúncio** — painel na própria página com 8 indicadores
  (descrição, imagens, SEO do título, especificações, benefícios, estrutura,
  itens inclusos e sinais de confiança), nota de 0 a 100 em cada.
- **Diagnóstico de título** — contagem de caracteres com o corte de 60 que a
  listagem aplica, caixa alta, emoji, palavra de vitrine ocupando espaço de
  termo de busca, repetição e ausência de número (modelo, medida, capacidade).
- **Diagnóstico de descrição** — tamanho, parágrafos, listas, se diz o que vem
  na caixa, se menciona garantia, e quantos termos ela acrescenta além dos que
  já estão no título — que é o que amplia a indexação.
- **Posição na busca** — procura o anúncio nos primeiros 200 resultados de um
  termo que você informa (a extensão sugere um a partir do título) e devolve a
  colocação e a página. Sob clique, nunca automático.
- **Monitoramento de concorrentes** — marque um anúncio e a extensão registra
  preço, quantidade vendida aproximada e avaliação ao longo do tempo. O
  histórico vira gráfico no popup. Intervalo configurável de 1 a 24 horas.
- **Alertas** — notificação do Chrome quando o preço varia acima do limite que
  você definiu, ou quando as vendas sobem além do que você definiu.
- **Calculadora de margem** — custo, margem desejada, comissão, frete e imposto
  entram; preço de venda ideal, lucro líquido e diferença percentual em relação
  ao concorrente saem, já com a taxa fixa de produtos de menor valor.
- **Com a conta conectada** — reconhece que o anúncio é seu, mostra saldo de
  créditos, compara seu preço com o do catálogo e consulta a posição na busca.

O "vendidos" que o Mercado Livre expõe é sempre uma faixa aproximada
(`+100`, `+1mil`), nunca o número exato — todo cálculo derivado dele herda essa
aproximação.

## Estrutura

```
manifest.json
background.js           # service worker: storage, alarmes, mensageria
lib/api.js              # cliente da API Marketplace Connect
content/
  content.js            # painel na página (Shadow DOM)
  content.css
popup/                  # anúncio atual / concorrentes / minha conta
options/                # chave de API + configurações
icons/
build.sh                # gera o .zip de publicação
```

`./build.sh` monta o pacote com apenas o que roda em runtime — docs, git e
assets de marketing ficam de fora.

## Privacidade

O que a extensão guarda fica no seu navegador. A chave de API vai apenas para
o servidor do Marketplace Connect, no cabeçalho `x-api-key`, e nunca é injetada
em nenhuma página. Detalhes em [PRIVACY.md](PRIVACY.md) e em
[marketplaces.tiops.com.br/privacidade](https://marketplaces.tiops.com.br/privacidade).

---

Produto independente da Tiops. Não é afiliado, patrocinado nem endossado pelo
Mercado Livre. "Mercado Livre" é marca registrada da MercadoLibre, Inc.
