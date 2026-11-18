#!/usr/bin/env python3
"""
KULTURA — Prototipo fase 8.3 (rama desechable): mapas de profundidad de las
obras fijas en modo Sala (Parásitos, Hades) para la capa 3D de la ficha
(`?3d=fondo`). La Pieza (libro, manga, anime) no usa mapa.

Se ejecuta A MANO y en local; no sube nada a ningún sitio. Escribe archivos
estáticos en `public/proto/depth/`:

  <slug>.d.jpg   Profundidad para el parallax (cerca = blanco). Dilatada y
                 suavizada como en la landing (`scripts/landing-media/build.py`,
                 `soften`): así el desplazamiento no rasga las siluetas.
  <slug>.m.jpg   Máscara de «lo que pasa por delante del título». Es la misma
                 profundidad SIN dilatar ni suavizar (el modelo trabaja al doble
                 de resolución para que el contorno salga fino), sin el suelo
                 —a cada fila se le resta su nivel de fondo: solo cuenta lo que
                 sobresale (personajes, objetos), no el suelo que se acerca a la
                 cámara—, con una curva en S alrededor de su corte natural y un
                 filtro guiado muy corto que ajusta el borde a la imagen.

Modelo: Depth Anything V2 (el de la landing). Por defecto la variante Small
(Apache-2.0); `--model base` usa la Base de la landing (CC-BY-NC-4.0).
Dependencias: las de `scripts/landing-media/requirements.txt` (torch CPU,
transformers, pillow, numpy, opencv). Todo libre y gratuito.

Uso:
  python scripts/proto-depth/build.py --src <carpeta con <slug>.jpg> [--model small|base]

Las imágenes de origen se bajan antes a una carpeta temporal por las mismas
rutas que usa la ficha (directa al CDN; MangaDex por el optimizador local) y
NO se guardan en el repo: solo los dos mapas derivados.
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
from build import otsu, soften  # noqa: E402  (mismo Otsu y mismo suavizado que la landing)

# slug → clave de la ficha (`type/id`), como en `_base/works.ts`.
WORKS = {
    "parasitos": "movie/496243",
    "hades": "game/274755",
}
MODELS = {
    "small": "depth-anything/Depth-Anything-V2-Small-hf",
    "base": "depth-anything/Depth-Anything-V2-Base-hf",
}
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "proto", "depth")


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


def front(depth: np.ndarray) -> np.ndarray:
    """Quita el suelo: a cada fila se le resta su nivel de fondo (percentil 30,
    suavizado en vertical y nunca decreciente hacia abajo) y se reescala."""
    base = np.percentile(depth, 30, axis=1)
    base = np.maximum.accumulate(base)
    k = max(3, depth.shape[0] // 12) | 1
    base = cv2.GaussianBlur(base.reshape(-1, 1).astype("float32"), (1, k), 0).ravel()
    f = (depth - base[:, None]) / np.maximum(1 - base[:, None], 0.08)
    f = np.clip(f, 0, 1)
    hi = np.percentile(f, 99.5)
    return np.clip(f / max(hi, 1e-3), 0, 1)


def save_gray(arr: np.ndarray, path: str, max_w: int, quality: int) -> tuple[int, int]:
    im = Image.fromarray((np.clip(arr, 0, 1) * 255).astype("uint8"))
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    im.save(path, "JPEG", quality=quality, optimize=True, progressive=True)
    return im.size


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--model", default="small", choices=MODELS)
    ap.add_argument("--side", type=int, default=1036, help="lado corto al que trabaja el modelo (múltiplo de 14)")
    ap.add_argument("--gain", type=float, default=6.0, help="contraste de la máscara alrededor de su corte natural")
    ap.add_argument("--debug", help="carpeta donde dejar vistas previas (no va al repo)")
    args = ap.parse_args()

    from transformers import pipeline

    model = pipeline("depth-estimation", model=MODELS[args.model], device="cpu")
    # El modelo trabaja por defecto a 518 px de lado corto; al doble, los
    # contornos salen bastante más finos (a cambio de ~4× de tiempo en CPU).
    model.image_processor.size = {"height": args.side, "width": args.side}
    os.makedirs(OUT, exist_ok=True)
    manifest = {}
    for slug, key in WORKS.items():
        path = os.path.join(args.src, f"{slug}.jpg")
        if not os.path.exists(path):
            print(f"falta {path}", file=sys.stderr)
            continue
        im = Image.open(path).convert("RGB")
        if im.width > 1600:
            im = im.resize((1600, round(im.height * 1600 / im.width)), Image.LANCZOS)
        small = im.copy()
        small.thumbnail((2048, 2048))
        d = model(small)["predicted_depth"].squeeze().numpy()
        d = (d - d.min()) / (d.max() - d.min() + 1e-8)
        d = cv2.resize(d.astype("float32"), im.size, interpolation=cv2.INTER_CUBIC)
        d = np.clip(d, 0, 1)
        rgb = np.asarray(im).astype("float32") / 255

        par = soften(d)  # parallax: dilatado + suavizado
        mat = front(d)
        # Más contraste alrededor del corte natural (Otsu): figura y fondo quedan
        # separados por una rampa corta, y el umbral cae siempre en el contorno.
        # Curva en S, sin recortar: el orden de cerca a lejos se conserva (el umbral
        # aún puede subir para dejar solo lo más cercano).
        mat = 1 / (1 + np.exp(-(mat - otsu(mat)) * args.gain))
        mat = (mat - mat.min()) / (mat.max() - mat.min() + 1e-8)
        # Un filtro guiado MUY corto: ajusta el contorno a la imagen (1-2 px) sin
        # crear halo. Con radios mayores el contorno «brilla» alrededor de la figura.
        mat = guided(rgb, mat.astype("float32"), max(1, im.width // 640), 1e-4)

        dw, dh = save_gray(par, os.path.join(OUT, f"{slug}.d.jpg"), 640, 86)
        mw, mh = save_gray(mat, os.path.join(OUT, f"{slug}.m.jpg"), 1280, 84)
        manifest[key] = {"slug": slug, "w": im.width, "h": im.height, "depth": [dw, dh], "matte": [mw, mh]}
        if args.debug:
            os.makedirs(args.debug, exist_ok=True)
            Image.fromarray((d * 255).astype("uint8")).save(os.path.join(args.debug, f"{slug}-raw.png"))
            Image.fromarray((mat * 255).astype("uint8")).save(os.path.join(args.debug, f"{slug}-matte.png"))
        print(f"· {slug:10} {im.width}x{im.height}  d {dw}x{dh}  m {mw}x{mh}")
    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump({"model": MODELS[args.model], "works": manifest}, f, indent=1)
    return 0


if __name__ == "__main__":
    sys.exit(main())
