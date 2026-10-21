"""Renderiza un vídeo de la plantilla con los datos de capture.py.

Uso: python3 render.py --data work/data.json --out out/nombre [--workers 6] [--seed 3]
Genera out/nombre_web.mp4 (Instagram/TikTok) y out/nombre_x.mp4 (X, < 10 MB).
"""
import argparse, asyncio, json, os, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
FPS = 30


async def worker(w, n, data, frames, total):
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--allow-file-access-from-files"])
        pg = await b.new_page(viewport={"width": 1080, "height": 1920})
        await pg.goto("file://" + os.path.join(HERE, "top5.html"))
        await pg.evaluate("d => setData(d)", data)
        await pg.wait_for_function("[...document.images].every(i => i.complete && i.naturalWidth > 0)", timeout=30000)
        await pg.evaluate("document.fonts.ready")
        await pg.wait_for_timeout(500)
        for i in range(w, total, n):
            await pg.evaluate(f"render({i / FPS})")
            await pg.screenshot(path=os.path.join(frames, f"f{i:04d}.png"))
        await b.close()


def ensure_assets():
    fonts = os.path.join(HERE, "fonts")
    if not os.path.exists(os.path.join(fonts, "inter-latin-900-normal.woff2")):
        os.makedirs(fonts, exist_ok=True)
        tmp = os.path.join(HERE, ".npm")
        subprocess.run(["npm", "pack", "@fontsource/inter@5", "--silent"], cwd=HERE, check=True, capture_output=True)
        tgz = [f for f in os.listdir(HERE) if f.startswith("fontsource-inter") and f.endswith(".tgz")][0]
        subprocess.run(["tar", "xzf", tgz, "-C", HERE], check=True)
        for wgt in (600, 800, 900):
            shutil.copy(os.path.join(HERE, "package", "files", f"inter-latin-{wgt}-normal.woff2"), fonts)
        shutil.rmtree(os.path.join(HERE, "package"), ignore_errors=True); os.remove(os.path.join(HERE, tgz))
        shutil.rmtree(tmp, ignore_errors=True)
    grain = os.path.join(HERE, "grain.png")
    if not os.path.exists(grain):
        import numpy as np
        from PIL import Image
        g = (np.random.default_rng(1).normal(128, 40, (512, 512))).clip(0, 255).astype("uint8")
        Image.fromarray(g, "L").save(grain)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--preview", action="store_true", help="solo 5 fotogramas clave en PNG")
    a = ap.parse_args()
    ensure_assets()
    data = json.load(open(a.data))
    T0, END, TOTAL = [2.4, 5.3, 8.2, 11.1, 14.0], 18.9, 21.5
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    frames = a.out + "_frames"
    shutil.rmtree(frames, ignore_errors=True); os.makedirs(frames)
    total = int(TOTAL * FPS)
    if a.preview:
        keys = [int(t * FPS) for t in (1.6, 4.0, 9.5, 16.5, 20.8)]
        async def prev():
            from playwright.async_api import async_playwright
            async with async_playwright() as p:
                b = await p.chromium.launch(args=["--allow-file-access-from-files"])
                pg = await b.new_page(viewport={"width": 1080, "height": 1920})
                await pg.goto("file://" + os.path.join(HERE, "top5.html"))
                await pg.evaluate("d => setData(d)", data)
                await pg.wait_for_function("[...document.images].every(i => i.complete && i.naturalWidth > 0)", timeout=30000)
                await pg.evaluate("document.fonts.ready"); await pg.wait_for_timeout(500)
                for i in keys:
                    await pg.evaluate(f"render({i / FPS})")
                    await pg.screenshot(path=os.path.join(frames, f"f{i:04d}.png"))
                await b.close()
        asyncio.run(prev())
        print(json.dumps({"preview": sorted(os.listdir(frames))}))
        return

    async def all_workers():
        await asyncio.gather(*[worker(w, a.workers, data, frames, total) for w in range(a.workers)])
    asyncio.run(all_workers())
    cues = {"total": TOTAL, "intro_end": T0[0], "hits": T0, "big": T0[-1], "outro": END}
    cj = a.out + "_cues.json"; json.dump(cues, open(cj, "w"))
    wav = a.out + ".wav"
    subprocess.run([sys.executable, os.path.join(HERE, "music.py"), wav, cj, str(a.seed)], check=True)
    raw = a.out + "_raw.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", os.path.join(frames, "f%04d.png"),
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium", raw], check=True)
    web, xv = a.out + "_web.mp4", a.out + "_x.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", raw, "-i", wav, "-c:v", "libx264", "-crf", "24", "-preset", "slow",
                    "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", web], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", web, "-c:v", "libx264", "-b:v", "2500k", "-maxrate", "3000k",
                    "-bufsize", "6000k", "-c:a", "copy", "-movflags", "+faststart", xv], check=True)
    for f in (raw, wav, cj):
        os.remove(f)
    shutil.rmtree(frames)
    print(json.dumps({"web": web, "web_mb": round(os.path.getsize(web) / 1e6, 1), "x": xv, "x_mb": round(os.path.getsize(xv) / 1e6, 1)}))


if __name__ == "__main__":
    main()
