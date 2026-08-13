# Prints da extensão

Capturas usadas no README e na ficha da Chrome Web Store.

| Arquivo | O que mostra |
|---|---|
| `score-indicadores.png` | Os 8 indicadores de qualidade, detalhe do painel na página |
| `calculadora.png` | Página do anúncio com a Calculadora de margem aberta |
| `popup-concorrentes.png` | Popup da barra, aba Concorrentes, com o painel Info ao fundo |
| `popup-anuncio.png` | Popup da barra, aba Este anúncio |
| `popup-conta.png` | Popup da barra, aba Minha conta |

Faltam duas que valeriam a pena: a **página inteira com o score** e a **aba
SEO**. A aba SEO é o que distingue esta extensão das outras — se surgir o print,
ela entra no lugar de `popup-conta.png`.


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
