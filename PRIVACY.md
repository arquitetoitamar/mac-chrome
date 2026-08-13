# Política de Privacidade — Marketplace Connect: Análise de Produtos

**Última atualização:** 13 de agosto de 2026
**Responsável:** Tiops / Marketplace Connect — contato@tiops.com.br

Esta política descreve quais dados a extensão **Marketplace Connect — Análise de Produtos** coleta, como os usa e
com quem os compartilha. Ela vale para a extensão distribuída na Chrome Web
Store.

## 1. Dados que a extensão coleta

| Dado | Origem | Onde fica |
|---|---|---|
| Chave de API do Marketplace Connect (`mc_live_...`) | Digitada pelo usuário na tela de opções | `chrome.storage.local`, apenas no navegador do usuário |
| Dados públicos de anúncios do Mercado Livre (título, preço, quantidade vendida aproximada, avaliação, vendedor, categoria, ficha técnica, URLs de imagens) | Páginas do Mercado Livre visitadas pelo usuário | `chrome.storage.local`, apenas no navegador do usuário |
| Histórico de preço/vendas dos anúncios que o usuário escolheu monitorar | Coleta periódica das páginas públicas desses anúncios | `chrome.storage.local`, apenas no navegador do usuário |
| Preferências (intervalo de verificação, limites de alerta, notificações) | Configuração do usuário | `chrome.storage.local`, apenas no navegador do usuário |

A extensão **não** coleta: histórico de navegação, dados de formulários,
cookies de terceiros, credenciais de login, dados de pagamento, localização,
conteúdo de páginas fora do Mercado Livre, nem qualquer identificador
publicitário.

## 2. Como os dados são usados

- A chave de API é enviada **exclusivamente** para a API do Marketplace Connect,
  no cabeçalho `x-api-key`, para autenticar as operações que o próprio usuário
  solicita (consultar créditos, listar suas contas e anúncios, criar/editar
  anúncios seus, gerar mídia).
- Dados de anúncios são usados para exibir diagnóstico, comparação de preços,
  histórico e alertas — sempre dentro do navegador do usuário.
- Quando o usuário aciona uma função que depende do servidor, os parâmetros
  daquela operação são enviados ao servidor para executá-la:
  - **análise de catálogo** — o ID do anúncio;
  - **criação de anúncio** — título, descrição, preço, categoria e quantidade
    que estiverem no formulário, e as URLs de imagem apenas se o usuário marcar
    a caixa correspondente (desmarcada por padrão);
  - **geração de foto e de vídeo com IA** — a URL da imagem do produto, o título
    do anúncio e os parâmetros escolhidos. O processamento roda em serviços de
    IA contratados pela Tiops. Nada é gerado sem clique explícito do usuário, e
    cada operação consome créditos da conta dele.

## 3. Compartilhamento

Nenhum dado é vendido, alugado ou compartilhado com terceiros para publicidade,
análise de mercado ou qualquer finalidade não relacionada à função da extensão.
Os únicos destinos de rede são:

- `https://mcp.tiops.com.br` — API do Marketplace Connect, único servidor da
  Tiops com que a extensão fala. Todas as operações de conta, inclusive saldo de
  créditos e geração de mídia, passam por ele;
- `https://*.mercadolivre.com.br` / `https://*.mercadolibre.com` — leitura das
  páginas públicas de anúncios monitorados.

Para executar a geração de mídia, o servidor da Tiops repassa a imagem e o texto
enviados pelo usuário a provedores de IA contratados, que atuam como operadores
e não recebem a identidade nem a chave do usuário.

## 4. Armazenamento e retenção

Todos os dados locais ficam em `chrome.storage.local`, no dispositivo do
usuário. O histórico de cada anúncio monitorado é compactado automaticamente
(máximo de 250 pontos por item; acima de 30 dias, um ponto por dia).

O usuário pode apagar tudo a qualquer momento:

- **Remover chave** na tela de opções apaga a chave de API e os caches de conta;
- remover um concorrente monitorado apaga o histórico dele;
- desinstalar a extensão apaga todo o armazenamento local.

Dados enviados ao servidor da Tiops seguem a política de privacidade da
plataforma Marketplace Connect: <https://marketplaces.tiops.com.br>.

## 5. Segurança

A comunicação com os servidores é feita exclusivamente por HTTPS. A chave de
API nunca é exposta em páginas web: ela fica no service worker da extensão e
não é injetada em nenhuma página do Mercado Livre.

## 6. Menores de idade

A extensão é uma ferramenta profissional para vendedores de marketplace e não
se destina a menores de 13 anos.

## 7. Código aberto

O código-fonte da extensão é público. Qualquer pessoa pode auditar exatamente o
que ela lê, o que envia e para onde — ou partir dele para construir a própria
extensão. O pacote publicado na Chrome Web Store é gerado por `build.sh` a
partir desse mesmo fonte.

## 8. Alterações

Mudanças materiais nesta política serão publicadas nesta mesma URL, com a data
de atualização revisada.

## 8. Contato

Dúvidas ou pedidos de exclusão de dados: **contato@tiops.com.br**

---

**Aviso:** esta extensão é um produto independente da Tiops. Não é afiliado,
patrocinado nem endossado pelo Mercado Livre. "Mercado Livre" é marca
registrada da MercadoLibre, Inc.
