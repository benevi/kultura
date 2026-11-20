import path from "path";
import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import type { BrowserCommand } from "vitest/node";
import type { CDPSession, Page } from "@playwright/test";

// Pone la densidad de pantalla (`devicePixelRatio`) sin tocar el tamaño de la
// ventana, para las historias que miden en píxeles físicos (el tope de
// ampliación del póster a densidad 2 y 3). Lo llama `fijarDensidad`, de
// `.storybook/sala.tsx`. Es un comando propio y no el CDP de Vitest porque ese
// pide `browser.api.allowWrite` y `allowExec`, que el addon de Storybook deja
// apagados: así la página solo puede pedir esto.
const sesiones = new WeakMap<Page, Promise<CDPSession>>();
const salaDensidad: BrowserCommand<[dpr: number]> = async ({ page, context }, dpr) => {
  if (!(dpr >= 1 && dpr <= 4)) throw new Error(`Densidad fuera de rango: ${dpr}`);
  let sesion = sesiones.get(page);
  if (!sesion) sesiones.set(page, (sesion = context.newCDPSession(page)));
  const { width, height } = page.viewportSize() ?? { width: 0, height: 0 };
  await (await sesion).send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: dpr, mobile: false });
};

// Los nombres accesibles de los encabezados, como los calcula Chromium (CDP
// `Accessibility.getFullAXTree`, en todos los marcos): lo que leerá un lector
// de pantalla, no lo que dice el DOM. Lo usa `nombresDeEncabezados`
// (.storybook/sala.tsx).
const salaEncabezados: BrowserCommand<[]> = async ({ page, context }) => {
  let sesion = sesiones.get(page);
  if (!sesion) sesiones.set(page, (sesion = context.newCDPSession(page)));
  const cdp = await sesion;
  await cdp.send("Accessibility.enable");
  type Marco = { frame: { id: string }; childFrames?: Marco[] };
  const { frameTree } = (await cdp.send("Page.getFrameTree")) as unknown as { frameTree: Marco };
  const marcos: string[] = [];
  const recorrer = (m: Marco) => {
    marcos.push(m.frame.id);
    for (const hijo of m.childFrames ?? []) recorrer(hijo);
  };
  recorrer(frameTree);
  const nombres: string[] = [];
  for (const frameId of marcos) {
    try {
      const { nodes } = (await cdp.send("Accessibility.getFullAXTree", { frameId })) as unknown as {
        nodes: Array<{ ignored?: boolean; role?: { value?: string }; name?: { value?: string } }>;
      };
      for (const n of nodes) if (!n.ignored && n.role?.value === "heading") nombres.push(String(n.name?.value ?? ""));
    } catch {
      // Un marco que ya no existe: no tiene encabezados.
    }
  }
  return nombres;
};

// Emula preferencias del sistema (`forced-colors`, `prefers-contrast`…) con CDP
// `Emulation.setEmulatedMedia`. Lo usa `emularMedios` (.storybook/sala.tsx);
// solo admite esas dos y el movimiento reducido. Una lista vacía lo deja como estaba.
const MEDIOS_PERMITIDOS = new Set(["forced-colors", "prefers-contrast", "prefers-reduced-motion"]);
const salaMedios: BrowserCommand<[features: Array<{ name: string; value: string }>]> = async ({ page, context }, features) => {
  if (!features.every((f) => MEDIOS_PERMITIDOS.has(f.name))) throw new Error("Medio no permitido");
  let sesion = sesiones.get(page);
  if (!sesion) sesiones.set(page, (sesion = context.newCDPSession(page)));
  await (await sesion).send("Emulation.setEmulatedMedia", { features });
};

// Pruebas de las historias de Storybook (`npm run test:storybook`): cada
// historia se pinta en Chromium (el de Playwright, ya instalado) y pasa axe;
// con `a11y.test: "error"` (.storybook/preview.tsx) una violación la hace
// fallar, y también un contraste que axe no haya podido medir
// (.storybook/contraste.ts). El addon aplica solo las anotaciones de .storybook/preview.tsx y del
// addon de a11y (desde Storybook 10.3 no hace falta archivo de setup). Va en un
// archivo aparte para que `npm test` siga sin navegador.
export default defineConfig({
  plugins: [
    storybookTest({
      configDir: path.resolve(__dirname, ".storybook"),
      storybookScript: "npm run storybook -- --no-open",
    }),
  ],
  // Dependencias que Vite descubre tarde (al abrir la primera historia que las
  // usa) y que, sin esto, le hacen recargar a media prueba con la caché fría:
  // todas las historias fallaban con «Vitest failed to find the current suite».
  optimizeDeps: {
    include: ["next-intl", "next-intl/navigation", "next-intl/routing", "@radix-ui/react-slot", "@radix-ui/react-dialog", "clsx", "tailwind-merge"],
  },
  test: {
    name: "storybook",
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
      commands: { salaDensidad, salaEncabezados, salaMedios },
    },
  },
});
