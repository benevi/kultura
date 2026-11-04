#!/usr/bin/env python3
"""
KULTURA — Renovación semanal de las imágenes con profundidad de la landing.

Lo ejecuta .github/workflows/landing-media.yml cada lunes (y a mano con
workflow_dispatch). Pasos:
  1. Candidatos: GET {SITE_URL}/api/landing/sources (rankings destacados y
     muestra de portadas, datos ya públicos) + lo más visto de la semana en
     TMDB (fondos SIN texto para la portada y el cierre).
  2. Para cada imagen: mapa de profundidad (Depth Anything V2), dilatado y
     suavizado para que los bordes no se rompan al moverse, y control de
     calidad automático: umbral de la capa delantera (Otsu), foco del encuadre
     y si el nombre puede ir «entre capas» sin quedar tapado.
  3. Sube imagen y mapa al bucket «landing» y escribe `landing_media` de la
     semana. Solo si la semana nueva está completa la activa (y desactiva la
     anterior): si falla algo, la landing sigue con la semana pasada.
  4. Borra semanas de más de 5 semanas y vacía la caché `landing-media`.

Variables: SITE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TMDB_API_KEY,
REVALIDATE_SECRET (opcional), DRY_RUN=1 (calcula y guarda en ./out sin subir).
"""
from __future__ import annotations

import datetime as dt
import io
import json
import os
import sys
import time
from dataclasses import dataclass, field

import numpy as np
import requests
from PIL import Image

UA = {"User-Agent": "KULTURA-landing-media/1.0 (+https://kulturaapp.vercel.app)"}
HERO_COUNT = 3          # escenas de la portada
FEATURE_COUNT = 4       # «Lo que hay dentro»
STEP_COUNT = 3          # «Así funciona»
KEEP_WEEKS = 5
FG_MIN, FG_MAX = 0.05, 0.45   # parte de la imagen que puede quedar delante
WORD_BAND = (0.30, 0.62)      # franja vertical donde va el nombre
WORD_BAND_MAX = 0.5           # como mucho la mitad de esa franja tapada


# ---------------------------------------------------------------- análisis
@dataclass
class Analysis:
    threshold: float
    fg_ratio: float
    focus: tuple[float, float]
    layered: bool
    accent: str
    band_cover: float = 0.0


def otsu(values: np.ndarray) -> float:
    """Umbral de Otsu sobre valores 0-1 (sin OpenCV, para poder probarlo)."""
    hist, edges = np.histogram(values.ravel(), bins=256, range=(0.0, 1.0))
    hist = hist.astype(float)
    total = hist.sum()
    if total == 0:
        return 0.5
    centers = (edges[:-1] + edges[1:]) / 2
    w0 = np.cumsum(hist)
    w1 = total - w0
    m0 = np.cumsum(hist * centers)
    mt = m0[-1]
    with np.errstate(divide="ignore", invalid="ignore"):
        between = (mt * w0 - m0 * total) ** 2 / (w0 * w1)
    between = np.nan_to_num(between)
    # Con dos niveles muy separados hay una meseta de máximos: se toma su
    # centro (el corte queda entre ambos, no pegado a uno).
    best = np.flatnonzero(between >= between.max() * (1 - 1e-9))
    return float(edges[int(round(best.mean())) + 1])


BAND_TARGET = 0.3   # parte ideal de la franja del nombre tapada por el personaje


def band_of(fg: np.ndarray) -> float:
    h = fg.shape[0]
    band = fg[int(h * WORD_BAND[0]): int(h * WORD_BAND[1])]
    return float(band.mean()) if band.size else 1.0


def pick_threshold(depth: np.ndarray) -> float:
    """El corte con el que el primer plano tapa ~30 % de la franja del nombre
    (se lee y a la vez el personaje pasa por delante), dentro de los límites de
    tamaño. Si ninguno cumple, Otsu."""
    base = otsu(depth)
    best, best_score = base, None
    for th in np.arange(0.08, 0.86, 0.02):
        fg = depth > th
        ratio = float(fg.mean())
        if not FG_MIN <= ratio <= FG_MAX:
            continue
        cover = band_of(fg)
        if cover > WORD_BAND_MAX:
            continue
        score = abs(cover - BAND_TARGET) + 0.1 * abs(th - base)
        if best_score is None or score < best_score:
            best, best_score = float(th), score
    return best


def analyse(depth: np.ndarray, rgb: np.ndarray) -> Analysis:
    """depth: 0-1 (cerca = 1). Devuelve lo que necesita el shader."""
    th = pick_threshold(depth)
    fg = depth > th
    ratio = float(fg.mean())
    if fg.any():
        ys, xs = np.nonzero(fg)
        focus = (float(np.clip(xs.mean() / fg.shape[1], 0.15, 0.85)), float(np.clip(ys.mean() / fg.shape[0], 0.2, 0.6)))
    else:
        focus = (0.5, 0.4)
    band_cover = band_of(fg)
    layered = FG_MIN <= ratio <= FG_MAX and band_cover <= WORD_BAND_MAX
    return Analysis(round(th, 3), round(ratio, 3), (round(focus[0], 3), round(focus[1], 3)), layered, accent_of(rgb), round(band_cover, 3))


def accent_of(rgb: np.ndarray) -> str:
    """Color vivo dominante (para el botón de la escena)."""
    small = np.asarray(Image.fromarray(rgb).resize((96, 54))).reshape(-1, 3).astype(float) / 255
    mx, mn = small.max(1), small.min(1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    score = sat * mx
    top = small[np.argsort(score)[-60:]].mean(0) * 255
    return "#%02x%02x%02x" % tuple(int(v) for v in top)


def soften(depth: np.ndarray) -> np.ndarray:
    """Dilata (los bordes del primer plano crecen un poco) y suaviza: así el
    parallax no rasga las siluetas. Normaliza a 0-1."""
    import cv2  # import tardío: los tests de `analyse` no lo necesitan

    k = max(3, int(depth.shape[1] / 110) | 1)
    d = cv2.dilate(depth.astype("float32"), np.ones((k, k), np.uint8))
    d = cv2.GaussianBlur(d, (0, 0), k * 0.6)
    return (d - d.min()) / (d.max() - d.min() + 1e-8)


# ---------------------------------------------------------------- selección
@dataclass
class Pick:
    slot: str
    position: int
    media_type: str
    external_id: str
    title: str
    url: str
    format: str | None = None
    year: int | None = None
    rating: float | None = None
    portrait: bool = True
    extra: dict = field(default_factory=dict)


def unique_by_url(items: list[Pick]) -> list[Pick]:
    """Nunca la misma imagen ni el mismo título dos veces en la landing."""
    seen_url, seen_title, out = set(), set(), []
    for it in items:
        key_t = (it.media_type, it.title.strip().lower())
        if it.url in seen_url or key_t in seen_title:
            continue
        seen_url.add(it.url)
        seen_title.add(key_t)
        out.append(it)
    return out


def choose_scenes(cands: list[tuple[Pick, Analysis]], count: int) -> list[tuple[Pick, Analysis]]:
    """Primero las que admiten el nombre entre capas; dentro, las que tienen
    la capa delantera más cerca del 22 % de la imagen."""
    return sorted(cands, key=lambda c: (not c[1].layered, abs(c[1].fg_ratio - 0.22)))[:count]


# ---------------------------------------------------------------- red
def get(url: str, **kw) -> requests.Response:
    for attempt in range(3):
        r = requests.get(url, headers=UA, timeout=30, **kw)
        if r.status_code < 500 and r.status_code != 429:
            return r
        time.sleep(2 * (attempt + 1))
    return r


def load_image(url: str, max_w: int) -> np.ndarray | None:
    r = get(url)
    if r.status_code != 200 or not r.headers.get("content-type", "").startswith("image"):
        return None
    im = Image.open(io.BytesIO(r.content)).convert("RGB")
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    return np.asarray(im)


def to_portrait(rgb: np.ndarray) -> np.ndarray:
    """Recorte central 2:3 para imágenes apaisadas (capturas de juegos)."""
    h, w, _ = rgb.shape
    if h / w >= 1.3:
        return rgb
    cw = int(h * 2 / 3)
    x = max(0, (w - cw) // 2)
    return rgb[:, x: x + cw]


def tmdb_hero_candidates(key: str, limit: int = 14) -> list[Pick]:
    """Lo más visto de la semana con un fondo SIN texto (idioma nulo)."""
    out: list[Pick] = []
    r = get(f"https://api.themoviedb.org/3/trending/all/week?api_key={key}&language=es-ES")
    for it in (r.json().get("results") or [])[:30] if r.ok else []:
        kind = it.get("media_type")
        if kind not in ("movie", "tv") or it.get("adult"):
            continue
        imgs = get(f"https://api.themoviedb.org/3/{kind}/{it['id']}/images?api_key={key}&include_image_language=null")
        backs = [b for b in (imgs.json().get("backdrops") or []) if b.get("iso_639_1") is None] if imgs.ok else []
        if not backs:
            continue
        best = max(backs, key=lambda b: (b.get("vote_average") or 0, b.get("width") or 0))
        title = it.get("title") or it.get("name") or ""
        date = it.get("release_date") or it.get("first_air_date") or ""
        out.append(Pick("hero", 0, kind, str(it["id"]), title, f"https://image.tmdb.org/t/p/original{best['file_path']}",
                        format=kind, year=int(date[:4]) if date[:4].isdigit() else None, portrait=False))
        if len(out) >= limit:
            break
    return out


def steam_portrait(title: str) -> str | None:
    """Carátula vertical de Steam para un juego (RAWG solo tiene capturas apaisadas)."""
    r = get("https://store.steampowered.com/api/storesearch/", params={"term": title, "l": "spanish", "cc": "ES"})
    items = r.json().get("items") if r.ok else None
    if not items:
        return None
    url = f"https://cdn.steamstatic.com/steam/apps/{items[0]['id']}/library_600x900_2x.jpg"
    return url if get(url).headers.get("content-type", "").startswith("image") else None


# ---------------------------------------------------------------- Supabase
class Store:
    def __init__(self, base: str, key: str, dry: bool):
        self.base, self.dry = base.rstrip("/"), dry
        self.h = {"apikey": key, "Authorization": f"Bearer {key}"}

    def upload(self, path: str, data: bytes) -> None:
        if self.dry:
            os.makedirs(os.path.dirname(f"out/{path}"), exist_ok=True)
            open(f"out/{path}", "wb").write(data)
            return
        r = requests.post(f"{self.base}/storage/v1/object/landing/{path}", data=data, timeout=60,
                          headers={**self.h, "Content-Type": "image/jpeg", "x-upsert": "true", "Cache-Control": "max-age=31536000"})
        r.raise_for_status()

    def rest(self, method: str, query: str, body=None, prefer: str = "") -> requests.Response:
        if self.dry:
            print("DRY", method, query, (json.dumps(body)[:200] if body else ""))
            return requests.Response()
        r = requests.request(method, f"{self.base}/rest/v1/{query}", json=body, timeout=60,
                             headers={**self.h, "Content-Type": "application/json", **({"Prefer": prefer} if prefer else {})})
        r.raise_for_status()
        return r

    def delete_prefix(self, prefix: str) -> None:
        if self.dry:
            return
        r = requests.post(f"{self.base}/storage/v1/object/list/landing", json={"prefix": prefix, "limit": 1000}, headers=self.h, timeout=60)
        names = [f"{prefix}/{o['name']}" for o in (r.json() if r.ok else [])]
        if names:
            requests.delete(f"{self.base}/storage/v1/object/landing", json={"prefixes": names}, headers=self.h, timeout=60)


def jpeg(arr: np.ndarray, quality: int, gray: bool = False) -> bytes:
    buf = io.BytesIO()
    im = Image.fromarray(arr if not gray else (arr * 255).astype("uint8"))
    im.save(buf, "JPEG", quality=quality, optimize=True, progressive=True)
    return buf.getvalue()


# ---------------------------------------------------------------- main
def main() -> int:
    site = os.environ.get("SITE_URL", "https://kulturaapp.vercel.app").rstrip("/")
    dry = os.environ.get("DRY_RUN") == "1"
    store = Store(os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ""), dry)
    tmdb = os.environ.get("TMDB_API_KEY", "")
    today = dt.date.today()
    week = (today - dt.timedelta(days=today.weekday())).isoformat()

    src = get(os.environ.get("SOURCES_URL") or f"{site}/api/landing/sources").json()
    from transformers import pipeline  # tarda: se carga solo si hay trabajo

    depth_model = pipeline("depth-estimation", model="depth-anything/Depth-Anything-V2-Base-hf", device="cpu")

    def process(p: Pick, max_w: int):
        # Las apaisadas se bajan grandes para que el recorte vertical no quede borroso.
        rgb = load_image(p.url, max(max_w, 1600) if p.portrait else max_w)
        if rgb is None:
            return None
        if p.portrait:
            rgb = to_portrait(rgb)
            if rgb.shape[1] > max_w:
                im = Image.fromarray(rgb)
                rgb = np.asarray(im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS))
        small = Image.fromarray(rgb)
        small.thumbnail((1024, 1024))
        d = depth_model(small)["predicted_depth"].squeeze().numpy()
        d = (d - d.min()) / (d.max() - d.min() + 1e-8)
        d = np.asarray(Image.fromarray((d * 255).astype("uint8")).resize(small.size, Image.BICUBIC), float) / 255
        d = soften(d)
        return rgb, d, analyse(d, rgb)

    rows: list[dict] = []

    def emit(p: Pick, rgb: np.ndarray, d: np.ndarray, a: Analysis) -> None:
        key = f"{p.slot}-{p.position}"
        img_path, dep_path = f"{week}/{key}.jpg", f"{week}/{key}_d.jpg"
        h, w, _ = rgb.shape
        dh = np.asarray(Image.fromarray((d * 255).astype("uint8")).resize((max(1, w // 2), max(1, h // 2)), Image.BICUBIC), float) / 255
        store.upload(img_path, jpeg(rgb, 80))
        store.upload(dep_path, jpeg(dh, 90, gray=True))
        rows.append({"week": week, "slot": p.slot, "position": p.position, "format": p.format, "media_type": p.media_type,
                     "external_id": p.external_id, "title": p.title, "year": p.year, "rating": p.rating,
                     "image_path": img_path, "depth_path": dep_path, "width": w, "height": h,
                     "threshold": a.threshold, "focus_x": a.focus[0], "focus_y": a.focus[1], "fg_ratio": a.fg_ratio,
                     "layered": a.layered, "accent": a.accent, "active": False})
        print(f"· {key:10} {p.title[:40]:40} capas={a.layered} delante={a.fg_ratio}")

    used: list[Pick] = []

    # 1. Portada y cierre: fondos sin texto de lo más visto de la semana.
    scenes = []
    for c in tmdb_hero_candidates(tmdb) if tmdb else []:
        res = process(c, 1920)
        if res:
            scenes.append((c, res))
    ranked = choose_scenes([(c, r[2]) for c, r in scenes], HERO_COUNT + 1)
    by_pick = {id(c): r for c, r in scenes}
    for i, (c, _) in enumerate(ranked):
        c.slot, c.position = ("hero", i) if i < HERO_COUNT else ("close", 0)
        emit(c, *by_pick[id(c)])
        used.append(c)

    # 2. Rankings: el líder de cada formato.
    leaders: list[Pick] = []
    reserve: list[Pick] = []
    for rk in src.get("rankings", []):
        for j, it in enumerate(rk.get("items", [])):
            p = Pick("ranking", 0, it["type"], str(it.get("externalId") or it["id"]), it["title"], it["poster"],
                     format=rk["format"], year=it.get("year"), rating=it.get("rating"))
            if rk["format"] == "game":
                p.url = steam_portrait(it["title"]) or it["poster"]
            (leaders if j == 0 else reserve).append(p)
    for i, p in enumerate(unique_by_url(leaders)):
        p.position = i
        res = process(p, 640)
        if res:
            emit(p, *res)
            used.append(p)

    # 3. Funciones y pasos: el resto, mezclando formatos y sin repetir.
    pool = reserve + [Pick("feature", 0, s["type"], str(s["id"]), s["title"], s["poster"], format=s["type"]) for s in src.get("showcase", [])]
    taken = {u.url for u in used} | {(u.media_type, u.title.lower()) for u in used}
    pool = [p for p in unique_by_url(interleave_by_format(pool)) if p.url not in taken and (p.media_type, p.title.lower()) not in taken]
    for slot, count in (("feature", FEATURE_COUNT), ("step", STEP_COUNT)):
        n = 0
        while n < count and pool:
            p = pool.pop(0)
            p.slot, p.position = slot, n
            res = process(p, 640)
            if res:
                emit(p, *res)
                n += 1

    # 4. Sin portada o sin rankings, no se activa nada: se queda la semana anterior.
    slots = {r["slot"] for r in rows}
    if not {"hero", "ranking"} <= slots:
        print("Semana incompleta: no se activa (sigue la anterior).", file=sys.stderr)
        return 1
    store.rest("POST", "landing_media?on_conflict=week,slot,position", rows, "resolution=merge-duplicates")
    store.rest("PATCH", f"landing_media?week=eq.{week}", {"active": True})
    store.rest("PATCH", f"landing_media?week=neq.{week}&active=is.true", {"active": False})

    # 5. Limpieza y caché.
    cutoff = (dt.date.fromisoformat(week) - dt.timedelta(weeks=KEEP_WEEKS)).isoformat()
    if not dry:
        old = store.rest("GET", f"landing_media?select=week&week=lt.{cutoff}").json()
        for w in sorted({o["week"] for o in old}):
            store.delete_prefix(w)
        store.rest("DELETE", f"landing_media?week=lt.{cutoff}")
        secret = os.environ.get("REVALIDATE_SECRET")
        if secret:
            requests.post(f"{site}/api/revalidate", json={"tags": ["landing-media"]},
                          headers={"Authorization": f"Bearer {secret}"}, timeout=30)
    print(f"Semana {week}: {len(rows)} imágenes.")
    return 0


def interleave_by_format(items: list[Pick]) -> list[Pick]:
    """Alterna formatos para que funciones y pasos no sean todo anime."""
    buckets: dict[str, list[Pick]] = {}
    for it in items:
        buckets.setdefault(it.format or it.media_type, []).append(it)
    out, lists = [], list(buckets.values())
    while any(lists):
        for lst in lists:
            if lst:
                out.append(lst.pop(0))
    return out


if __name__ == "__main__":
    sys.exit(main())
