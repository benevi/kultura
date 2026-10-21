"""Saca el top 5 real de un ranking público de KULTURA y prepara data.json + portadas.

Uso: python3 capture.py --format anime --year 2026 --out work [--locale es] [--seed 3]
Formatos: anime | movie | tv | game. Sale con código 2 si el ranking no responde 200.
"""
import argparse, asyncio, json, os, re, sys, urllib.parse, urllib.request

BASE = "https://kulturaapp.vercel.app"
THEMES = {  # acento por formato: cada vídeo se distingue de un vistazo
    "anime": "#c6ff3d", "movie": "#ff2d8a", "tv": "#a78bfa", "game": "#22d3ee",
}
INTRO = {
    "anime": ("ANIME {y}", "Los mejor valorados del año"),
    "movie": ("PELIS {y}", "Las mejor valoradas del año"),
    "tv": ("SERIES {y}", "Las mejor valoradas del año"),
    "game": ("JUEGOS {y}", "Los mejor valorados del año"),
}
OUTROS = [  # cierres que rotan con --seed (nunca prometer cosas que la app no hace)
    ("TU CULTURA,", "EN UN SOLO", "SITIO."),
    ("¿CUÁL TE", "FALTA POR", "{VERB}?"),
    ("GUARDA LO", "QUE QUIERES", "{VERB}."),
    ("TODO LO QUE", "VES Y JUEGAS,", "JUNTO."),
]
GENRES_ES = {
    "Action": "Acción", "Adventure": "Aventura", "Comedy": "Comedia", "Drama": "Drama",
    "Fantasy": "Fantasía", "Horror": "Terror", "Mystery": "Misterio", "Romance": "Romance",
    "Sci-Fi": "Ciencia ficción", "Slice of Life": "Recuentos", "Sports": "Deportes",
    "Supernatural": "Sobrenatural", "Thriller": "Suspense", "Psychological": "Psicológico",
    "Music": "Música", "Mecha": "Mecha", "Ecchi": "Ecchi", "Mahou Shoujo": "Magical girl",
    "Action & Adventure": "Acción", "Sci-Fi & Fantasy": "Fantasía", "Animación": None,
    "Animation": None, "Simulation": "Simulación", "Strategy": "Estrategia",
    "Platformer": "Plataformas", "Racing": "Carreras", "RPG": "Rol", "Shooter": "Shooter",
    "Puzzle": "Puzle", "Indie": "Indie", "Casual": "Casual", "Fighting": "Lucha",
    "Arcade": "Arcade", "Family": "Familiar", "Card": "Cartas", "Board Games": "De mesa",
    "Massively Multiplayer": "MMO", "Educational": "Educativo",
}


def es_genres(gs):
    out = []
    for g in gs:
        v = GENRES_ES.get(g, g)
        if v and v not in out:
            out.append(v)
    return out[:3]


def original_url(src):
    """De /_next/image?url=X&w=..., saca X; mejora el tamaño de TMDB."""
    q = urllib.parse.urlparse(src)
    if q.path.endswith("/_next/image"):
        src = urllib.parse.parse_qs(q.query).get("url", [src])[0]
    src = src.replace("/t/p/w500/", "/t/p/w780/").replace("/t/p/w342/", "/t/p/w780/")
    # RAWG sirve miniaturas de 200 px: se pide la de 1280.
    return re.sub(r"/media/(resize|crop)/[^/]+/[^/]+/", "/media/resize/1280/-/", src)


def download(url, path):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r, open(path, "wb") as f:
        f.write(r.read())


async def scrape(url):
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 430, "height": 900})
        resp = await pg.goto(url, wait_until="networkidle", timeout=60000)
        if not resp or resp.status != 200:
            await b.close()
            return None
        items = await pg.evaluate("""() => [...document.querySelectorAll('ol[aria-label] > li')].slice(0,5).map(li => {
            const h = li.querySelector('h2'); const num = h.querySelector('span');
            const title = h.textContent.replace(num ? num.textContent : '', '').trim();
            const meta = li.querySelector('p') ? li.querySelector('p').textContent : '';
            const m = meta.match(/★\\s*([0-9.]+)/);
            const img = li.querySelector('img');
            return { title, score: m ? parseFloat(m[1]) : null,
                     genres: [...li.querySelectorAll('ul li')].map(x => x.textContent.trim()),
                     src: img ? (img.currentSrc || img.src) : null };
        })""")
        await b.close()
        return items


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--format", required=True, choices=list(THEMES))
    ap.add_argument("--year", required=True, type=int)
    ap.add_argument("--out", default="work")
    ap.add_argument("--locale", default="es")
    ap.add_argument("--seed", type=int, default=0)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    url = f"{BASE}/{a.locale}/best/{a.format}/{a.year}"
    items = asyncio.run(scrape(url))
    if not items or len(items) < 5:
        print(f"ERROR: {url} no devuelve un top 5", file=sys.stderr)
        sys.exit(2)
    data_items = []
    for rank, it in zip(range(1, 6), items):
        path = os.path.join(a.out, f"c{rank}.jpg")
        try:
            download(original_url(it["src"]), path)
        except Exception:
            download(urllib.parse.urljoin(BASE, it["src"]), path)
        data_items.append({"rank": rank, "title": it["title"], "score": it["score"],
                           "genres": es_genres(it["genres"]), "img": os.path.abspath(path)})
    data_items.reverse()  # el vídeo va del 5 al 1
    line2, line3 = INTRO[a.format]
    data = {
        "format": a.format, "year": a.year, "source": url,
        "accent": THEMES[a.format], "accent2": "#ff2d8a" if a.format != "movie" else "#c6ff3d",
        "intro": ["TOP 5", line2.format(y=a.year), line3],
        "outro": [l.replace("{VERB}", "JUGAR" if a.format == "game" else "VER") for l in OUTROS[a.seed % len(OUTROS)]],
        "landscape": a.format == "game",  # las imágenes de RAWG son capturas apaisadas
        "cta": "Empieza gratis", "url": "kulturaapp.vercel.app",
        "items": data_items,
    }
    with open(os.path.join(a.out, "data.json"), "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print(json.dumps({"ok": True, "top": [i["title"] for i in reversed(data_items)]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
