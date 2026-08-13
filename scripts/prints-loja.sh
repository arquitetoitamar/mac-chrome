#!/usr/bin/env bash
# Enquadra os prints em 1280x800, que é a medida exigida pela Chrome Web Store.
# Não distorce: reduz proporcionalmente se precisar e centraliza sobre branco.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p store-assets/screenshots
python3 - <<'PY'
from PIL import Image
import pathlib
origem = sorted(pathlib.Path("assets/prints").glob("*.png"))
if not origem:
    raise SystemExit("Nenhum print em assets/prints/")
for f in origem:
    im = Image.open(f).convert("RGB")
    im.thumbnail((1280, 800), Image.LANCZOS)
    quadro = Image.new("RGB", (1280, 800), (255, 255, 255))
    quadro.paste(im, ((1280 - im.width) // 2, (800 - im.height) // 2))
    saida = pathlib.Path("store-assets/screenshots") / f.name
    quadro.save(saida, quality=95)
    print(f"{f.name}: {im.width}x{im.height} -> 1280x800")
PY
