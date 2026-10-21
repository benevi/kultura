# Kit de vídeo de KULTURA

Vídeos verticales 1080x1920 (21,5 s, con música propia) hechos con datos reales de
los rankings públicos de la app. Formato actual: **Top 5** (cuenta atrás 5→1).

```bash
git clone --depth 1 -b kultura/media-videos https://github.com/benevi/kultura media && cd media/cm-video
python3 capture.py --format anime --year 2026 --out work --seed 3   # anime | movie | tv | game
python3 render.py --data work/data.json --out out/top5-anime-2026 --preview   # 5 fotogramas para revisar
python3 render.py --data work/data.json --out out/top5-anime-2026 --seed 3    # ~7 min con 6 workers
```

- Salidas: `out/<nombre>_web.mp4` (Instagram/TikTok) y `out/<nombre>_x.mp4` (X, < 10 MB).
- `--seed` cambia el cierre, el tempo, la tonalidad y la progresión de la música.
- Cada formato tiene su color (anime lima, películas rosa, series lila, juegos cian);
  los juegos usan tarjeta apaisada porque RAWG da capturas, no carátulas.
- `capture.py` sale con código 2 si el ranking no devuelve 200 o no hay 5 títulos.
- Fuentes (Inter, OFL) y grano se generan solos la primera vez (npm + numpy).
