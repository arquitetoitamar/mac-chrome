# Prints da extensão

Capturas usadas no README e na ficha da Chrome Web Store.

| Arquivo | O que mostra |
|---|---|
| `01-score-na-pagina.png` | Painel de score injetado na página do anúncio, abaixo do preço |
| `02-painel-info.png` | Painel flutuante, aba Info — diagnóstico e dados do anúncio |
| `03-seo.png` | Aba SEO — título, descrição e posição na busca |
| `04-calculadora.png` | Aba Calculadora de margem |
| `05-gauges.png` | Detalhe dos 8 indicadores |
| `06-popup-anuncio.png` | Popup da barra de ferramentas, aba Este anúncio |
| `07-popup-concorrentes.png` | Popup, aba Concorrentes |
| `08-popup-conta.png` | Popup, aba Minha conta |
| `09-opcoes.png` | Tela de opções — chave de API e monitoramento |

Os nomes atuais são os que vieram da captura (`2.png`, `3.png`…). O que importa
é o conteúdo — `scripts/assets-loja.py` mapeia arquivo → legenda.

**Para a Chrome Web Store:** a loja exige 1280×800 ou 640×400 exatos, no máximo
cinco capturas, em 24 bits sem alfa. Print de janela nunca sai nessa medida, e
dois destes são recortes pequenos que ficariam borrados se esticados. Então
`scripts/assets-loja.py` compõe cada um: fundo da marca, título, linha de apoio
e o print com sombra, dimensionado para ocupar a área sem estourar.

O mesmo script gera o bloco promocional (440×280) e o letreiro (1400×560).
Saída em `store-assets/`, fora do pacote da extensão.

```bash
python3 scripts/assets-loja.py
```
