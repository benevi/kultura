// ============================================================
// KULTURA — Registro del service worker (MOV-2)
//
// - Solo en producción: en `next dev` los chunks no llevan hash y un
//   cache-first rompería la recarga en caliente.
// - Tras `load`, para no competir con la primera carga.
// - `scope: "/"` (el archivo vive en la raíz, no hace falta
//   `Service-Worker-Allowed`) y `updateViaCache: "none"`: el navegador
//   comprueba `sw.js` en la red en cada visita, sin la caché HTTP.
// - Interruptor: `NEXT_PUBLIC_PWA_SW=0` des-registra el worker en los
//   navegadores que ya lo tengan (si algún día hiciera falta retirarlo).
// ============================================================

export const SW_URL = "/sw.js";

export type SwResult = "unsupported" | "skipped" | "unregistered" | "scheduled";

interface SwEnv {
  /** `process.env.NEXT_PUBLIC_PWA_SW` (cualquier valor salvo "0" = activo). */
  flag: string | undefined;
  production: boolean;
}

export function swMode({ flag, production }: SwEnv): "register" | "unregister" | "skip" {
  if (flag === "0") return "unregister";
  return production ? "register" : "skip";
}

export async function setupServiceWorker(
  env: SwEnv = {
    flag: process.env.NEXT_PUBLIC_PWA_SW,
    production: process.env.NODE_ENV === "production",
  },
  win: Window = window,
): Promise<SwResult> {
  const container = win.navigator.serviceWorker;
  if (!container) return "unsupported";
  const mode = swMode(env);
  if (mode === "skip") return "skipped";
  if (mode === "unregister") {
    const registrations = await container.getRegistrations().catch(() => []);
    await Promise.all(
      registrations
        .filter((r) => [r.active, r.waiting, r.installing].some((w) => w?.scriptURL.endsWith(SW_URL)))
        .map((r) => r.unregister().catch(() => false)),
    );
    return "unregistered";
  }
  const register = () => {
    container.register(SW_URL, { scope: "/", updateViaCache: "none" }).catch(() => {
      // Sin worker la app funciona igual (solo pierde el modo sin conexión).
    });
  };
  if (win.document.readyState === "complete") register();
  else win.addEventListener("load", register, { once: true });
  return "scheduled";
}
