#!/usr/bin/env python3
"""Gera os recursos gráficos da ficha da Chrome Web Store.

A loja é estrita: 1280x800 ou 640x400 nas capturas, 440x280 no bloco pequeno,
1400x560 no letreiro, e tudo em 24 bits sem canal alfa. Print de janela nunca
sai nessa medida, e dois dos nossos são recortes pequenos — esticar deixaria
borrado. Então cada captura é composta: fundo da marca, título, uma linha de
apoio e o print em tamanho real com sombra. Recorte pequeno vira destaque em
vez de imagem esticada.

Saída em store-assets/. Nada aqui entra no pacote da extensão.
"""
import pathlib
from PIL import Image, ImageDraw, ImageFilter, ImageFont

RAIZ = pathlib.Path(__file__).resolve().parent.parent
PRINTS = RAIZ / "assets/prints"
SAIDA = RAIZ / "store-assets"

AZUL = (41, 104, 200)
AZUL_ESCURO = (26, 62, 122)
AMBAR = (230, 168, 23)
GRAFITE = (28, 37, 48)
CINZA = (105, 118, 133)

BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
REG = "/System/Library/Fonts/Supplemental/Arial.ttf"

# A ordem é a ordem da vitrine. A primeira é a que decide se a pessoa instala,
# então abre com o que é a assinatura do produto: os oito indicadores.
CAPTURAS = [
    ("score-indicadores.png", "8 indicadores de qualidade, de 0 a 100",
     "Descrição, imagens, SEO do título, especificações, benefícios, estrutura, inclusos e confiança."),
    ("calculadora.png", "O preço que fecha a sua margem",
     "Informe custo, comissão, frete e imposto. Sai o preço de venda, o lucro líquido e a diferença para o concorrente."),
    ("popup-concorrentes.png", "Acompanhe o preço dos concorrentes",
     "Marque um anúncio e a extensão passa a registrar preço, vendas e avaliação ao longo do tempo."),
    ("popup-anuncio.png", "Os números do anúncio, num clique",
     "Preço, vendidos, receita estimada, avaliação e posição na categoria — na barra de ferramentas."),
    ("popup-conta.png", "Conecte a conta para comparar",
     "Com a chave de API você compara seu preço com o do catálogo e consulta a posição na busca."),
]


def fonte(caminho, tam):
    return ImageFont.truetype(caminho, tam)


def fundo(w, h, escuro=False):
    """Gradiente vertical. Claro nas capturas, escuro nos blocos promocionais."""
    base = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(base)
    topo = (AZUL if escuro else (246, 249, 253))
    baixo = (AZUL_ESCURO if escuro else (226, 235, 247))
    for y in range(h):
        t = y / max(h - 1, 1)
        d.line([(0, y), (w, y)],
               fill=tuple(round(topo[i] + (baixo[i] - topo[i]) * t) for i in range(3)))
    return base


def com_sombra(im, raio=18, desfoque=22, opacidade=70):
    """Cantos arredondados + sombra projetada, para o print descolar do fundo."""
    im = im.convert("RGB")
    mascara = Image.new("L", im.size, 0)
    ImageDraw.Draw(mascara).rounded_rectangle([0, 0, im.width - 1, im.height - 1], raio, fill=255)

    pad = desfoque * 2
    tela = Image.new("RGBA", (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
    sombra = Image.new("RGBA", tela.size, (0, 0, 0, 0))
    ImageDraw.Draw(sombra).rounded_rectangle(
        [pad, pad + 8, pad + im.width, pad + im.height + 8], raio, fill=(15, 30, 60, opacidade))
    tela.alpha_composite(sombra.filter(ImageFilter.GaussianBlur(desfoque)))

    recorte = Image.new("RGBA", im.size, (0, 0, 0, 0))
    recorte.paste(im, (0, 0), mascara)
    tela.alpha_composite(recorte, (pad, pad))
    return tela


def quebrar(d, texto, fnt, largura):
    linhas, atual = [], ""
    for palavra in texto.split():
        teste = (atual + " " + palavra).strip()
        if d.textlength(teste, font=fnt) <= largura:
            atual = teste
        else:
            if atual:
                linhas.append(atual)
            atual = palavra
    if atual:
        linhas.append(atual)
    return linhas


def marca(base, d, x, y, tam=34):
    icone = Image.open(RAIZ / "icons/icon128.png").convert("RGBA").resize((tam, tam), Image.LANCZOS)
    base.paste(icone, (x, y), icone)
    d.text((x + tam + 10, y + tam / 2), "Marketplace Connect", font=fonte(BOLD, 17),
           fill=CINZA, anchor="lm")


def captura(arquivo, titulo, apoio):
    W, H = 1280, 800
    base = fundo(W, H)
    d = ImageDraw.Draw(base)

    marca(base, d, 64, 52)

    f_tit = fonte(BOLD, 42)
    f_sub = fonte(REG, 21)
    y = 130
    for linha in quebrar(d, titulo, f_tit, W - 128):
        d.text((64, y), linha, font=f_tit, fill=GRAFITE)
        y += 52
    y += 6
    for linha in quebrar(d, apoio, f_sub, W - 128):
        d.text((64, y), linha, font=f_sub, fill=CINZA)
        y += 30

    d.rounded_rectangle([64, y + 16, 64 + 72, y + 21], 3, fill=AMBAR)
    topo_img = y + 52

    im = Image.open(PRINTS / arquivo).convert("RGB")
    max_w, max_h = W - 128, H - topo_img - 56

    # Ocupa a área disponível em vez de flutuar nela: recorte pequeno deixado no
    # tamanho real abre um vazio embaixo que lê como erro de diagramação. O teto
    # de 2,2x existe porque acima disso a ampliação começa a borrar visivelmente.
    # com_sombra devolve a imagem com 88px a mais em cada eixo (a margem que a
    # sombra desfocada precisa). Sem descontar isso, o resultado estoura embaixo.
    folga = 88
    escala = min((max_w - folga) / im.width, (max_h - folga) / im.height, 2.2)
    im = im.resize((round(im.width * escala), round(im.height * escala)), Image.LANCZOS)

    sombreado = com_sombra(im)
    base.paste(sombreado,
               ((W - sombreado.width) // 2,
                topo_img + (max_h - sombreado.height) // 2),
               sombreado)
    return base


def bloco(w, h, titulo, apoio, tam_tit, tam_sub, tam_icone):
    base = fundo(w, h, escuro=True)
    d = ImageDraw.Draw(base)

    icone = Image.open(RAIZ / "icons/icon128.png").convert("RGBA").resize((tam_icone, tam_icone), Image.LANCZOS)
    margem = round(w * 0.06)

    f_tit, f_sub = fonte(BOLD, tam_tit), fonte(REG, tam_sub)
    largura_txt = w - margem * 2 - tam_icone - round(w * 0.04)
    linhas_t = quebrar(d, titulo, f_tit, largura_txt)
    linhas_s = quebrar(d, apoio, f_sub, largura_txt) if apoio else []

    alt = len(linhas_t) * (tam_tit + 8) + (len(linhas_s) * (tam_sub + 7) + 10 if linhas_s else 0)
    y = (h - alt) // 2
    x = margem + tam_icone + round(w * 0.04)

    base.paste(icone, (margem, (h - tam_icone) // 2), icone)
    for linha in linhas_t:
        d.text((x, y), linha, font=f_tit, fill=(255, 255, 255))
        y += tam_tit + 8
    if linhas_s:
        y += 10
        for linha in linhas_s:
            d.text((x, y), linha, font=f_sub, fill=(198, 217, 245))
            y += tam_sub + 7
    return base


def main():
    tela = SAIDA / "screenshots"
    tela.mkdir(parents=True, exist_ok=True)

    for i, (arq, tit, sub) in enumerate(CAPTURAS, 1):
        if not (PRINTS / arq).exists():
            print(f"  falta {arq} — pulando")
            continue
        destino = tela / f"{i:02d}-{arq}"
        captura(arq, tit, sub).save(destino, "PNG")
        print(f"{destino.relative_to(RAIZ)}  1280x800  RGB")

    p = SAIDA / "promo-440x280.png"
    bloco(440, 280, "Análise de Produtos",
          "Score, SEO e margem no anúncio.", 30, 15, 84).save(p, "PNG")
    print(f"{p.relative_to(RAIZ)}  440x280  RGB")

    m = SAIDA / "marquee-1400x560.png"
    bloco(1400, 560, "Análise de Produtos",
          "Score do anúncio, diagnóstico de título e descrição, posição na busca e "
          "calculadora de margem — na própria página do Mercado Livre.", 78, 30, 240).save(m, "PNG")
    print(f"{m.relative_to(RAIZ)}  1400x560  RGB")


if __name__ == "__main__":
    main()
