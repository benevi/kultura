#!/usr/bin/env python3
"""
KULTURA — Prototipo fase 8.3 (rama desechable): mapas de las obras fijas en
modo Sala (Parásitos, Hades, Chihiro) para la capa 3D de la ficha
(`?3d=fondo`). La Pieza (libro, manga) no usa mapa.

Se ejecuta A MANO y en local; no sube nada a ningún sitio. Escribe en
`public/proto/depth/` y regenera `sala3d/depth.ts`:

  <slug>.d.jpg   Profundidad SOLO para el parallax (cerca = blanco). Dilatada y
                 suavizada como en la landing (`scripts/landing-media/build.py`,
                 `soften`): así el desplazamiento no rasga las siluetas.
                 Modelo: Depth Anything V2 Small (Apache-2.0).
  <slug>.m.png   Máscara de primer plano de verdad: lo que pasa por delante del
                 título. Segmentación de figura/fondo (BiRefNet, licencia MIT,
                 vía `rembg`, MIT), a la resolución de la imagen, sin pérdida.
                 Limpieza: fuera las zonas dudosas y las islas sueltas (solo
                 quedan componentes grandes y firmes), huecos pequeños
                 cerrados, y el borde ajustado a la imagen con un filtro guiado
                 corto: alfa suave de 2–3 px, sin halo.
El contorno del corte ya NO sale de umbralizar la profundidad (salía
deshilachado): lo pone la máscara. La profundidad mueve la imagen y solo
decide, con una transición suave, qué parte de la figura queda por delante
del título (para no tapar letras de más).

Dependencias, todas libres y gratuitas: las de
`scripts/landing-media/requirements.txt` (torch CPU, transformers, pillow,
numpy, opencv) más `rembg==2.0.67` y `onnxruntime`. Los pesos de BiRefNet
(224 MB, variante «general-lite») los baja `rembg` de sus publicaciones de
GitHub la primera vez. No se usa RMBG de BRIA (licencia no comercial).

Uso:
  python scripts/proto-depth/build.py --src <carpeta con <slug>.jpg>

Las imágenes de origen (el original del proveedor) se bajan antes a una
carpeta temporal y NO se guardan en el repo: solo los mapas derivados.
"""
from __future__ import annotations

import argparse
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "landing-media"))
from build import soften  # noqa: E402  (mismo suavizado que la landing)

# slug → clave de la ficha (`tipo/id externo`).
WORKS = {
    "parasitos": "movie/496243",
    "hades": "game/274755",
    "chihiro": "anime/al-199",
}
DEPTH_MODEL = "depth-anything/Depth-Anything-V2-Small-hf"
FG_MODEL = "birefnet-general-lite"
ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
OUT = os.path.join(ROOT, "public", "proto", "depth")
TS = os.path.join(ROOT, "src", "app", "[locale]", "proto", "ficha", "_dirs", "a", "sala3d", "depth.ts")
MATTE_W = 2048          # ancho máximo de la máscara
MIN_AREA = 0.004        # componentes menores (de la imagen) se descartan
MIN_FIRM = 0.8          # alfa media mínima de un componente: fuera lo dudoso
MAX_FUZZY = 0.3         # parte «a medias» máxima respecto al área del componente
MAX_HOLE = 0.003        # huecos menores se cierran


def box(a: np.ndarray, r: int) -> np.ndarray:
    return cv2.blur(a, (2 * r + 1, 2 * r + 1), borderType=cv2.BORDER_REFLECT)


def guided(guide: np.ndarray, src: np.ndarray, r: int, eps: float) -> np.ndarray:
    """Filtro guiado (He et al.) con guía en color: `src` toma los bordes de `guide`."""
    out = np.zeros_like(src)
    for c in range(3):
        g = guide[..., c]
        mg, ms = box(g, r), box(src, r)
        var = box(g * g, r) - mg * mg
        cov = box(g * src, r) - mg * ms
        a = cov / (var + eps)
        b = ms - a * mg
        out += box(a, r) * g + box(b, r)
    return np.clip(out / 3, 0, 1)


def clean(alpha: np.ndarray, rgb: np.ndarray) -> np.ndarray:
    """Máscara limpia: componentes grandes y firmes, sin huecos pequeños, borde suave pegado a la imagen."""
    h, w = alpha.shape
    solid = (alpha > 0.5).astype("uint8")
    n, labels, stats, _ = cv2.connectedComponentsWithStats(solid, connectivity=8)
    keep = np.zeros_like(solid)
    k_fuzzy = max(5, w // 60)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] < MIN_AREA * h * w:
            continue
        comp = labels == i
        if float(alpha[comp].mean()) < MIN_FIRM:
            continue
        # Dudoso: mucha zona a medias (ni figura ni fondo) dentro y alrededor.
        # Una figura limpia solo tiene una franja fina de alfa intermedia en su contorno.
        x, y, bw, bh, area = stats[i]
        pad = k_fuzzy
        y0, y1, x0, x1 = max(0, y - pad), min(h, y + bh + pad), max(0, x - pad), min(w, x + bw + pad)
        near = cv2.dilate(comp[y0:y1, x0:x1].astype("uint8"), np.ones((pad, pad), np.uint8)) > 0
        a_loc = alpha[y0:y1, x0:x1]
        if float(((a_loc > 0.08) & (a_loc < 0.92) & near).sum()) / area > MAX_FUZZY:
            continue
        keep[labels == i] = 1
    # Huecos: componentes del fondo que no tocan el borde y son pequeños.
    n, labels, stats, _ = cv2.connectedComponentsWithStats(1 - keep, connectivity=4)
    for i in range(1, n):
        x, y, bw, bh, area = stats[i]
        if x > 0 and y > 0 and x + bw < w and y + bh < h and area < MAX_HOLE * h * w:
            keep[labels == i] = 1
    # Contorno liso (sin escalones) y alfa suave: se suaviza el binario y se
    # ajusta a los bordes reales de la imagen con un filtro guiado corto.
    r = max(1, w // 900)
    soft = cv2.GaussianBlur(keep.astype("float32"), (0, 0), max(1.0, w / 1100))
    soft = guided(rgb, soft, r * 2, 2e-4)
    # Rampa centrada en el contorno: ~3 px de ancho, sin halo hacia fuera.
    return np.clip((soft - 0.3) / 0.4, 0, 1)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--side", type=int, default=1036, help="lado corto al que trabaja el modelo de profundidad (múltiplo de 14)")
    ap.add_argument("--debug", help="carpeta donde dejar vistas previas (no va al repo)")
    args = ap.parse_args()

    from rembg import new_session, remove
    from transformers import pipeline

    depth_model = pipeline("depth-estimation", model=DEPTH_MODEL, device="cpu")
    depth_model.image_processor.size = {"height": args.side, "width": args.side}
    fg = new_session(FG_MODEL)
    os.makedirs(OUT, exist_ok=True)
    manifest = {}
    for slug, key in WORKS.items():
        path = os.path.join(args.src, f"{slug}.jpg")
        if not os.path.exists(path):
            print(f"falta {path}", file=sys.stderr)
            continue
        full = Image.open(path).convert("RGB")
        # Profundidad (parallax): a 1600 px sobra.
        im = full.copy()
        im.thumbnail((1600, 1600))
        d = depth_model(im)["predicted_depth"].squeeze().numpy()
        d = (d - d.min()) / (d.max() - d.min() + 1e-8)
        d = np.clip(cv2.resize(d.astype("float32"), im.size, interpolation=cv2.INTER_CUBIC), 0, 1)
        par = Image.fromarray((soften(d) * 255).astype("uint8"))
        par.thumbnail((640, 640))
        par.save(os.path.join(OUT, f"{slug}.d.jpg"), "JPEG", quality=86, optimize=True, progressive=True)

        # Máscara de primer plano, a la resolución de la imagen (tope MATTE_W).
        big = full.copy()
        big.thumbnail((MATTE_W, MATTE_W), Image.LANCZOS)
        alpha = np.asarray(remove(full, session=fg, only_mask=True).convert("L").resize(big.size, Image.LANCZOS), dtype="float32") / 255
        mat = clean(alpha, np.asarray(big).astype("float32") / 255)
        m8 = Image.fromarray((mat * 255).astype("uint8"))
        m8.save(os.path.join(OUT, f"{slug}.m.png"), "PNG", optimize=True)
        manifest[key] = {
            "slug": slug, "w": full.width, "h": full.height, "matte": list(big.size),
        }
        if args.debug:
            os.makedirs(args.debug, exist_ok=True)
            m8.save(os.path.join(args.debug, f"{slug}-matte.png"))
        size = os.path.getsize(os.path.join(OUT, f"{slug}.m.png")) // 1024
        print(f"· {slug:10} {full.width}x{full.height}  máscara {big.size[0]}x{big.size[1]} {size} KB  primer plano {mat.mean() * 100:.0f} %")

    for old in os.listdir(OUT):
        if old.endswith(".m.jpg") or old == "manifest.json":
            os.remove(os.path.join(OUT, old))
    rows = "\n".join(
        f'  "{k}": {{ d: "/proto/depth/{v["slug"]}.d.jpg", m: "/proto/depth/{v["slug"]}.m.png" }},'
        for k, v in manifest.items()
    )
    with open(TS, "w", encoding="utf-8", newline="\n") as f:
        f.write(f'''// GENERADO por `scripts/proto-depth/build.py` — no editar a mano.
// Prototipo fase 8.3 — mapas de las obras fijas en modo Sala (`?3d=fondo`).
// Archivos estáticos de la rama, calculados EN LOCAL: no hay servicio, ni
// subida, ni copia de la imagen; solo los mapas derivados.
//   d: profundidad para el parallax (Depth Anything V2 Small, Apache-2.0).
//   m: máscara de primer plano, sin pérdida (BiRefNet, MIT): lo que pasa por
//      delante del título.
// Clave: `tipo/id externo`. Una Sala sin mapa no admite `fondo`.

export const DEPTH: Record<string, {{ d: string; m: string }}> = {{
{rows}
}};
''')
    print(json.dumps({k: v["matte"] for k, v in manifest.items()}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
