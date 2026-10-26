#!/usr/bin/env python3
"""
F-22 (D-02) — comprobación en navegador de las páginas cacheables y de las
que conservan el nonce: 0 violaciones de CSP, 0 errores de consola, la página
hidrata (React engancha sus nodos) y los botones de compartir funcionan.

Uso (Playwright para Python, Chromium):
  python3 scripts/check-csp-pages.py https://kulturaapp.vercel.app
  python3 scripts/check-csp-pages.py http://localhost:3187

Si hay HTTPS_PROXY en el entorno, el navegador sale por él. ≤ 1 página/s, sin
iniciar sesión ni enviar formularios. Sale con código 1 si algo falla.
"""
import json
import os
import sys
import time
import urllib.parse

from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else "https://kulturaapp.vercel.app").rstrip("/")
YEAR = time.gmtime().tm_year

# (ruta, ¿cacheable?) — las cacheables llevan la CSP fija; el resto, nonce.
PAGES = [
    ("/es", True),
    ("/en", True),
    (f"/es/best/movie/{YEAR}", True),
    (f"/es/best/anime/{YEAR}", True),
    ("/es/best", True),
    ("/es/privacy", True),
    ("/en/terms", True),
    ("/es/offline", True),
    ("/es/login", False),
    ("/es/u/benevi", False),
]

# Se instala antes de cualquier script de la página: guarda cada violación
# (también las de la política solo de informe, con disposition "report").
INIT = """
window.__csp = [];
document.addEventListener('securitypolicyviolation', (e) => {
  window.__csp.push({ directive: e.effectiveDirective, blocked: e.blockedURI, disposition: e.disposition });
});
"""

HYDRATED = """
() => {
  const el = document.querySelector('main') || document.body;
  return Object.keys(el).some((k) => k.startsWith('__reactFiber') || k.startsWith('__reactProps'));
}
"""


def proxy_settings():
    raw = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
    if not raw or BASE.startswith("http://localhost"):
        return None
    u = urllib.parse.urlparse(raw)
    out = {"server": f"{u.scheme}://{u.hostname}:{u.port}"}
    if u.username:
        out.update(username=urllib.parse.unquote(u.username), password=urllib.parse.unquote(u.password or ""))
    return out


def main() -> int:
    failures = 0
    with sync_playwright() as pw:
        browser = pw.chromium.launch(proxy=proxy_settings())
        ctx = browser.new_context(ignore_https_errors=True, locale="es-ES", viewport={"width": 390, "height": 844})
        ctx.add_init_script(INIT)
        for path, cacheable in PAGES:
            page = ctx.new_page()
            console_errors = []
            # Errores de CSP en consola (los de la política de verdad y los
            # "[Report Only]"); el resto de errores (p. ej. una portada que no
            # carga) se listan aparte y no hacen fallar la comprobación.
            page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: console_errors.append(f"pageerror: {e}"))
            res = page.goto(BASE + path, wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(1500)
            headers = res.headers if res else {}
            csp = headers.get("content-security-policy", "")
            violations = page.evaluate("window.__csp")
            enforced = [v for v in violations if v["disposition"] == "enforce"]
            hydrated = page.evaluate(HYDRATED)
            csp_console = [m for m in console_errors if "Content Security Policy" in m or m.startswith("pageerror")]
            other_console = [m[:120] for m in console_errors if m not in csp_console]
            checks = {
                "status": res.status if res else None,
                "nonce_en_csp": "'nonce-" in csp,
                "unsafe_eval": "unsafe-eval" in csp,
                "hidrata": hydrated,
                "violaciones_csp": enforced,
                "solo_informe": violations and [v for v in violations if v["disposition"] != "enforce"],
                "errores_csp_consola": csp_console,
                "otros_errores_consola": sorted(set(other_console)),
                "cache": {k: headers.get(k) for k in ("cache-control", "x-vercel-cache", "age") if headers.get(k)},
            }
            ok = (
                checks["status"] == 200
                and checks["nonce_en_csp"] is (not cacheable)
                and not checks["unsafe_eval"]
                and hydrated
                and not enforced
                and not csp_console
            )
            if "/best/" in path and path.count("/") == 4:
                share = page.locator("button[aria-expanded]").first
                if share.count():
                    share.click()
                    page.wait_for_timeout(300)
                    checks["compartir_abre_menu"] = share.get_attribute("aria-expanded") == "true"
                    ok = ok and checks["compartir_abre_menu"]
                else:
                    checks["compartir_abre_menu"] = "sin botón (ranking vacío)"
            print(("OK  " if ok else "FALLO ") + path + " " + json.dumps(checks, ensure_ascii=False))
            failures += 0 if ok else 1
            page.close()
            time.sleep(1)
        browser.close()
    print(f"\n{len(PAGES) - failures}/{len(PAGES)} páginas correctas")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
