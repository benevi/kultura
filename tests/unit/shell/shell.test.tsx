/**
 * F-10 — documento HTML, metadatos e instalación:
 * un solo `<html lang>` (SEO-5/ACC-15), metadatos por idioma (TXT-2/TXT-5,
 * SEO-6, SEO-8), sin hreflang en cabeceras (SEO-4), 404 y error global con
 * idioma y `<main>` (ACC-7, TXT-4) y "Saltar al contenido" (ACC-13). La PWA
 * (MOV-1) va en `pwa.test.ts`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import fs from "node:fs";
import path from "node:path";
import es from "../../../messages/es.json";
import en from "../../../messages/en.json";

const state = vi.hoisted(() => ({
  xPathname: null as string | null,
  acceptLanguage: null as string | null,
  pathname: "/es" as string | null,
  locale: "es",
}));

vi.mock("next/headers", () => ({
  headers: () =>
    new Headers(
      Object.fromEntries(
        [
          ["x-pathname", state.xPathname],
          ["accept-language", state.acceptLanguage],
        ].filter(([, v]) => v !== null) as [string, string][],
      ),
    ),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => state.pathname,
}));

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const all = { es: (await import("../../../messages/es.json")).default, en: (await import("../../../messages/en.json")).default };
  return {
    getTranslations: async ({ locale, namespace }: { locale: "es" | "en"; namespace: string }) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createTranslator({ locale, messages: all[locale] as any, namespace: namespace as any }),
    getMessages: async () => all[state.locale as "es" | "en"],
  };
});

vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>();
  const all = { es: (await import("../../../messages/es.json")).default, en: (await import("../../../messages/en.json")).default };
  return {
    ...actual,
    NextIntlClientProvider: ({ children }: { children: ReactNode; messages: object }) => children,
    useLocale: () => state.locale,
    useTranslations: (namespace: string) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      actual.createTranslator({ locale: state.locale, messages: (all as any)[state.locale], namespace: namespace as any }),
  };
});

vi.mock("@/app/fonts", () => ({
  bricolageGrotesque: { variable: "font-var-display" },
  figtree: { variable: "font-var-body" },
}));
vi.mock("@vercel/analytics/next", () => ({ Analytics: () => null }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("react-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-dom")>()),
  preconnect: vi.fn(),
}));

import RootLayout from "@/app/layout";
import LocaleLayout, { generateMetadata, viewport } from "@/app/[locale]/layout";
import AppTemplate from "@/app/[locale]/(app)/template";
import ReportLayout from "@/app/[locale]/report/layout";
import WelcomeLayout from "@/app/[locale]/welcome/layout";
import { ClientMessages } from "@/i18n/ClientMessages";
import LocaleNotFound, { generateMetadata as notFoundMetadata } from "@/app/[locale]/not-found";
import RootNotFound, { generateMetadata as rootNotFoundMetadata } from "@/app/not-found";
import GlobalError from "@/app/global-error";
import CatchAllPage, { generateMetadata as catchAllMetadata } from "@/app/[locale]/[...rest]/page";
import { SkipLink } from "@/app/[locale]/SkipLink";
import { routing } from "@/i18n/routing";
import { localeFromAcceptLanguage, localeFromPathname } from "@/i18n/detect";
import {
  APP_CLIENT_NAMESPACES,
  REPORT_CLIENT_NAMESPACES,
  SHELL_CLIENT_NAMESPACES,
  WELCOME_CLIENT_NAMESPACES,
} from "@/i18n/client-messages";
import { siteUrl } from "@/lib/site-url";

const ROOT = path.resolve(__dirname, "../../..");

type El = ReactElement<Record<string, unknown> & { children?: ReactNode }>;
const childrenOf = (el: El) => ([] as ReactNode[]).concat(el.props.children).filter(isValidElement) as El[];

beforeEach(() => {
  state.xPathname = null;
  state.acceptLanguage = null;
  state.pathname = "/es";
  state.locale = "es";
});

describe("SEO-5/ACC-15 — un solo documento", () => {
  it("el layout raíz devuelve los hijos tal cual, sin <html> ni <body>", () => {
    const child = <p>hola</p>;
    expect(RootLayout({ children: child })).toBe(child);
  });

  it("[locale]/layout pinta <html lang> con el idioma de la URL y un solo <body>", async () => {
    state.locale = "en";
    const html = (await LocaleLayout({ children: <p />, params: Promise.resolve({ locale: "en" }) })) as El;
    expect(html.type).toBe("html");
    expect(html.props.lang).toBe("en");
    const [body] = childrenOf(html);
    expect(body.type).toBe("body");
    expect(String(body.props.className)).toContain("font-var-display");
    expect(String(body.props.className)).toContain("font-var-body");
  });

  it("un idioma no soportado da 404", async () => {
    await expect(LocaleLayout({ children: null, params: Promise.resolve({ locale: "fr" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });
});

describe("ACC-13 — Saltar al contenido", () => {
  it("es lo primero del <body>, traducido", async () => {
    state.locale = "en";
    const html = (await LocaleLayout({ children: <p />, params: Promise.resolve({ locale: "en" }) })) as El;
    const [first] = childrenOf(childrenOf(html)[0]);
    expect(first.type).toBe(SkipLink);
    expect(first.props.label).toBe("Skip to content");
  });

  it("enfoca el <main> de la página aunque no tenga id", () => {
    render(
      <>
        <SkipLink label="Saltar al contenido" />
        <header>
          <a href="/es/home">Inicio</a>
        </header>
        <main>contenido</main>
      </>,
    );
    const link = screen.getByRole("link", { name: "Saltar al contenido" });
    expect(link).toHaveAttribute("href", "#main");
    const main = screen.getByRole("main");
    // El ancla existe aunque la pantalla no le haya puesto id (axe: skip-link).
    expect(main).toHaveAttribute("id", "main");
    main.scrollIntoView = vi.fn();
    fireEvent.click(link);
    expect(document.activeElement).toBe(main);
    expect(main).toHaveAttribute("tabindex", "-1");
  });

  it("sin <main> (ficha, búsqueda) salta a lo que sigue a la cabecera, nunca a la cabecera", () => {
    render(
      <>
        <SkipLink label="Saltar al contenido" />
        <header>
          <a href="/es/home">Inicio</a>
        </header>
        <div data-testid="contenido">
          <h1>Dune</h1>
        </div>
        <nav aria-label="inferior">
          <a href="/es/library">Biblioteca</a>
        </nav>
      </>,
    );
    const content = screen.getByTestId("contenido");
    content.scrollIntoView = vi.fn();
    expect(content).toHaveAttribute("id", "main");
    fireEvent.click(screen.getByRole("link", { name: "Saltar al contenido" }));
    expect(document.activeElement).toBe(content);
  });

  it("sin <main> ni cabecera (restablecer contraseña) salta al h1", () => {
    render(
      <>
        <SkipLink label="Saltar al contenido" />
        <div>
          <h1>Nueva contraseña</h1>
          <input aria-label="Contraseña" />
        </div>
      </>,
    );
    const h1 = screen.getByRole("heading", { level: 1 });
    h1.scrollIntoView = vi.fn();
    fireEvent.click(screen.getByRole("link", { name: "Saltar al contenido" }));
    expect(document.activeElement).toBe(h1);
    expect(h1).toHaveAttribute("tabindex", "-1");
  });

  it("al cambiar de pantalla quita el ancla del destino anterior y la pone en el nuevo <main>", () => {
    const { rerender } = render(
      <>
        <SkipLink label="Saltar al contenido" />
        <header />
        <div data-testid="viejo">ficha</div>
      </>,
    );
    expect(screen.getByTestId("viejo")).toHaveAttribute("id", "main");
    state.pathname = "/es/library";
    rerender(
      <>
        <SkipLink label="Saltar al contenido" />
        <header />
        <div data-testid="viejo">
          <main data-testid="nuevo">biblioteca</main>
        </div>
      </>,
    );
    expect(screen.getByTestId("viejo")).not.toHaveAttribute("id");
    expect(screen.getByTestId("nuevo")).toHaveAttribute("id", "main");
  });

  it("globals.css deja 5rem arriba y abajo al desplazar a un ancla", () => {
    const css = fs.readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");
    expect(css).toMatch(/scroll-padding-top:\s*5rem/);
    expect(css).toMatch(/scroll-padding-bottom:\s*5rem/);
  });
});

describe("REN-5 — textos del navegador", () => {
  it("el layout solo manda los namespaces del shell", async () => {
    const html = (await LocaleLayout({ children: <p />, params: Promise.resolve({ locale: "es" }) })) as El;
    const provider = childrenOf(childrenOf(html)[0])[1];
    const messages = provider.props.messages as Record<string, unknown>;
    expect(Object.keys(messages).sort()).toEqual(
      Array.from(new Set(SHELL_CLIENT_NAMESPACES.map((ns) => ns.split(".")[0]))).sort(),
    );
    expect(messages).not.toHaveProperty("legal");
    expect(messages).not.toHaveProperty("landing");
    expect(Object.keys((messages.discoverFilters as object) ?? {})).toEqual(["typeBadge"]);
  });

  it.each([
    ["(app)/template", AppTemplate, APP_CLIENT_NAMESPACES],
    ["report/layout", ReportLayout, REPORT_CLIENT_NAMESPACES],
    ["welcome/layout", WelcomeLayout, WELCOME_CLIENT_NAMESPACES],
  ] as const)("%s pone su proveedor con su lista", async (_name, Zone, list) => {
    const zone = Zone({ children: <p /> }) as El;
    expect(zone.type).toBe(ClientMessages);
    expect(zone.props.namespaces).toBe(list);
    const provider = (await ClientMessages({ namespaces: list, children: <p /> })) as El;
    expect(Object.keys(provider.props.messages as object).sort()).toEqual(
      Array.from(new Set(list.map((ns) => ns.split(".")[0]))).sort(),
    );
  });
});

describe("TXT-2/TXT-5/SEO-6 — metadatos por defecto traducidos", () => {
  it.each([
    ["es", es],
    ["en", en],
  ] as const)("%s: título, descripción, OG y tarjeta con la frase de la marca", async (locale, messages) => {
    state.xPathname = `/${locale}/privacy?utm_source=x`;
    const meta = await generateMetadata({ params: Promise.resolve({ locale }) });
    expect(meta.title).toEqual({ template: "%s · KULTURA", default: messages.meta.defaultTitle });
    expect(meta.description).toBe(messages.meta.description);
    expect(meta.openGraph).toMatchObject({
      siteName: "KULTURA",
      type: "website",
      locale: locale === "es" ? "es_ES" : "en_US",
      alternateLocale: [locale === "es" ? "en_US" : "es_ES"],
      url: `${siteUrl()}/${locale}/privacy`,
    });
    // Título, descripción e imagen de OG y X los rellena Next con los de cada
    // página y la tarjeta del sitio: fijarlos aquí haría que una página con
    // título propio heredara el de la portada en OG y en X.
    expect(meta.openGraph).not.toHaveProperty("title");
    expect(meta.openGraph).not.toHaveProperty("description");
    expect(meta.openGraph).not.toHaveProperty("images");
    expect(meta.twitter).toEqual({ card: "summary_large_image" });
    expect(meta.appleWebApp).toMatchObject({ capable: true, title: "KULTURA" });
    // Heredado por una página sin canonical propio la marcaría como copia de la portada.
    expect(meta.alternates).toBeUndefined();
  });

  it("la frase confirmada (D-11) está literal en el título", () => {
    expect(es.meta.defaultTitle).toContain("Tu watchlist de cine, series, anime, manga, juegos, libros y cómics");
    expect(en.meta.defaultTitle).toContain("Your watchlist for movies, TV, anime, manga, games, books and comics");
    expect(es.meta.description).toBe(
      "Apunta lo que quieres ver, leer y jugar, puntúa lo que ya viste y compártelo con tus amigos. Gratis y sin anuncios.",
    );
  });

  it("sin x-pathname no inventa og:url", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: "es" }) });
    expect(meta.openGraph).not.toHaveProperty("url");
  });

  describe("SEO-8 — el dominio es una variable", () => {
    const prev = process.env.NEXT_PUBLIC_SITE_URL;
    afterEach(() => {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = prev;
    });

    it("metadataBase y og:url salen de NEXT_PUBLIC_SITE_URL", async () => {
      process.env.NEXT_PUBLIC_SITE_URL = "https://kulturaapp.example/";
      state.xPathname = "/en/best/movie/2025";
      const meta = await generateMetadata({ params: Promise.resolve({ locale: "en" }) });
      expect(String(meta.metadataBase)).toBe("https://kulturaapp.example/");
      expect(meta.openGraph).toMatchObject({ url: "https://kulturaapp.example/en/best/movie/2025" });
    });
  });

  it("viewport: color de la barra = --surface-base real, modo oscuro y a sangre", () => {
    expect(viewport).toMatchObject({ themeColor: "#0c0d14", colorScheme: "dark", viewportFit: "cover" });
    expect(viewport).not.toHaveProperty("maximumScale");
  });
});

describe("SEO-4 — hreflang solo en el HTML", () => {
  it("el middleware de idiomas no añade la cabecera Link", () => {
    expect(routing.alternateLinks).toBe(false);
  });
});

describe("ACC-7/TXT-4 — 404 y error global", () => {
  it("/en/<inexistente> tiene <title> en inglés y noindex", async () => {
    expect(await notFoundMetadata({ params: Promise.resolve({ locale: "en" }) })).toEqual({
      title: { absolute: "Page not found · KULTURA" },
      robots: { index: false },
    });
    expect(await notFoundMetadata({ params: { locale: "es" } })).toMatchObject({
      title: { absolute: "Página no encontrada · KULTURA" },
    });
  });

  it("con un primer segmento que no es idioma (/algo.php) el título sigue al navegador", async () => {
    state.acceptLanguage = "en-GB,en;q=0.9";
    expect(await notFoundMetadata({ params: Promise.resolve({ locale: "algo.php" }) })).toMatchObject({
      title: { absolute: "Page not found · KULTURA" },
    });
  });

  it("la ruta comodín da 404 ya desde los metadatos (el título no se queda en el de la portada)", async () => {
    await expect(catchAllMetadata()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(() => CatchAllPage()).toThrow("NEXT_NOT_FOUND");
    // En el layout no: Next relee sus metadatos para la 404 y lanzar dejaría la página sin título.
    expect(await generateMetadata({ params: Promise.resolve({ locale: "algo.php" }) })).toEqual({});
  });

  it("la 404 de un idioma es un <main> con h1 y vuelve a la portada de ese idioma", () => {
    state.locale = "en";
    render(<LocaleNotFound />);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main");
    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to home" })).toHaveAttribute("href", "/en");
  });

  it.each([
    ["en-US,en;q=0.9,es;q=0.8", "en", "Page not found · KULTURA"],
    ["es-ES,es;q=0.9", "es", "Página no encontrada · KULTURA"],
    [null, "es", "Página no encontrada · KULTURA"],
  ])("404 raíz con Accept-Language %s → %s", async (header, lang, title) => {
    state.acceptLanguage = header;
    const html = (await RootNotFound()) as El;
    expect(html.type).toBe("html");
    expect(html.props.lang).toBe(lang);
    const markup = renderToStaticMarkup(html);
    expect(markup.match(/<html/g)).toHaveLength(1);
    expect(markup.match(/<body/g)).toHaveLength(1);
    expect(markup).toContain('<main id="main"');
    expect(markup).toContain(`href="/${lang}"`);
    expect(markup).toContain("font-var-display");
    expect((await rootNotFoundMetadata()).title).toBe(title);
  });

  describe("error global", () => {
    afterEach(() => window.history.replaceState(null, "", "/"));

    it.each([
      ["/en/library", "en", en.errors],
      ["/en", "en", en.errors],
      ["/es/home", "es", es.errors],
      ["/", "es", es.errors],
    ])("en %s: idioma de la URL, <main>, h1 y vuelta a su portada", (url, lang, copy) => {
      // Si lo que cae es el router, `usePathname` no tiene contexto: no se usa.
      state.pathname = null;
      window.history.replaceState(null, "", url);
      const markup = renderToStaticMarkup(<GlobalError error={new Error("x")} reset={() => {}} />);
      expect(markup).toMatch(new RegExp(`^<html lang="${lang}"`));
      expect(markup).toContain(`<title>${copy.somethingWentWrong} · KULTURA</title>`);
      expect(markup).toMatch(new RegExp(`<main id="main"[^>]*>.*<h1[^>]*>${copy.somethingWentWrong}</h1>`));
      expect(markup).toContain(`>${copy.tryAgain}</button>`);
      expect(markup).toContain(`href="/${lang}"`);
    });

    it("no depende de hojas de estilo: estilos en línea con los hex de los tokens y fuente del sistema", () => {
      const markup = renderToStaticMarkup(<GlobalError error={new Error("x")} reset={() => {}} />);
      expect(markup).not.toContain("class=");
      expect(markup).toMatch(/<body style="[^"]*background-color:#0c0d14[^"]*color:#f4f5f8[^"]*font-family:system-ui/);
      expect(markup).toMatch(/<button[^>]*background-color:#fb40ad;color:#12080c/);
      const source = fs.readFileSync(path.join(ROOT, "src/app/global-error.tsx"), "utf8");
      expect(source).not.toMatch(/\.css['"]|@\/app\/fonts|usePathname\(/);
    });
  });
});

describe("detección de idioma", () => {
  it.each([
    ["/en", "en"],
    ["/en/media/movie/1", "en"],
    ["/es/home", "es"],
    ["/enx", "es"],
    ["/", "es"],
    [null, "es"],
  ])("ruta %s → %s", (p, l) => expect(localeFromPathname(p)).toBe(l));

  it.each([
    ["en-GB,en;q=0.8", "en"],
    ["fr-FR,fr;q=0.9,en;q=0.7,es;q=0.5", "en"],
    ["fr,de", "es"],
    ["es;q=0.2,en;q=0.9", "en"],
    ["en;q=0,es", "es"],
    ["", "es"],
  ])("Accept-Language %s → %s", (h, l) => expect(localeFromAcceptLanguage(h)).toBe(l));
});
