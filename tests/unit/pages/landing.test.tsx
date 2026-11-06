import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LandingMedia } from "@/lib/landing/media";
import { FALLBACK_MEDIA } from "@/lib/landing/scenes";
import es from "../../../messages/es.json";
import en from "../../../messages/en.json";

// next-intl con los mensajes REALES (es/en): así el test comprueba la copia
// de D-11 tal cual está en `messages/` y no un texto inventado aquí.
const { intl } = vi.hoisted(() => ({ intl: { locale: "es" as "es" | "en" } }));

function lookup(messages: Record<string, unknown>, ns: string, key: string): unknown {
  return [ns, ...key.split(".")].reduce<unknown>(
    (acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined),
    messages
  );
}

vi.mock("next-intl/server", () => ({
  getLocale: vi.fn(async () => intl.locale),
  setRequestLocale: vi.fn(),
  getTranslations: vi.fn(async (arg: string | { locale: string; namespace: string }) => {
    const ns = typeof arg === "string" ? arg : arg.namespace;
    const loc = typeof arg === "string" ? intl.locale : arg.locale;
    const messages = (loc === "en" ? en : es) as unknown as Record<string, unknown>;
    const t = (key: string, vars?: Record<string, string | number>) => {
      const raw = lookup(messages, ns, key);
      if (typeof raw !== "string") return `${ns}.${key}`;
      return raw.replace(/\{(\w+)\}/g, (_, v: string) => String(vars?.[v] ?? `{${v}}`));
    };
    t.raw = (key: string) => lookup(messages, ns, key);
    return t;
  }),
}));

const { demo } = vi.hoisted(() => ({ demo: { email: "demo@example.com" as string | undefined } }));
vi.mock("@/lib/env.server", () => ({
  env: new Proxy({}, { get: (_t, prop) => (prop === "DEMO_USER_EMAIL" ? demo.email : undefined) }),
}));

// Imágenes de la semana (lo que devolvería `getLandingMedia()`).
const { weekly } = vi.hoisted(() => ({ weekly: { media: [] as LandingMedia[] } }));
vi.mock("@/lib/landing/media", () => ({ getLandingMedia: vi.fn(async () => weekly.media) }));

// Piezas ajenas a la landing: fuente local, atribución (t.rich) y la isla WebGL.
vi.mock("@/app/fonts", () => ({ kulturaDisplay: { variable: "font-landing" } }));
vi.mock("@/components/legal/DataAttribution", () => ({ renderDataAttribution: async () => <p data-testid="attr" /> }));
vi.mock("@/components/landing/LandingMotion", () => ({ LandingMotion: () => <canvas data-testid="motion" /> }));

// REN-9: la portada no usa el `Link` de next-intl (enlaces `<a>` con el
// idioma); si alguien lo vuelve a importar, este doble hace fallar el test.
vi.mock("@/i18n/navigation", () => {
  throw new Error("la portada no debe importar @/i18n/navigation (REN-9)");
});

import HomePage, { generateMetadata } from "@/app/[locale]/page";

async function renderPage(locale: "es" | "en" = "es") {
  intl.locale = locale;
  return render(await HomePage({ params: Promise.resolve({ locale }) }));
}

function jsonLd(container: HTMLElement) {
  const script = container.querySelector('script[type="application/ld+json"]');
  return JSON.parse(script?.innerHTML ?? "{}") as { "@graph": Array<Record<string, unknown>> };
}

beforeEach(() => {
  weekly.media = [];
  demo.email = "demo@example.com";
});

describe("Landing v2 · portada", () => {
  it("un solo h1 (el nombre), la frase y un único «Crear cuenta»", async () => {
    const { container } = await renderPage();
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("KULTURA");
    expect(screen.getByText(es.landing.hero.lead)).toBeTruthy();
    const ctas = screen.getAllByRole("link", { name: "Crear cuenta" });
    expect(ctas).toHaveLength(1);
    expect(ctas[0].getAttribute("href")).toBe("/es/login?mode=register");
    expect(screen.getByRole("link", { name: "Entrar" }).getAttribute("href")).toBe("/es/login?mode=login");
  });

  it("la demo es un formulario POST; sin cuenta demo no hay botón ni pregunta", async () => {
    const { container, unmount } = await renderPage();
    const form = container.querySelector('form[action="/api/auth/demo"]')!;
    expect(form.getAttribute("method")).toBe("post");
    expect(within(form as HTMLElement).getByRole("button", { name: "Ver la demo" })).toBeTruthy();
    unmount();
    demo.email = undefined;
    const second = await renderPage();
    expect(second.container.querySelector('form[action="/api/auth/demo"]')).toBeNull();
    expect(second.container.textContent).not.toContain(es.landing.faq.demo.q);
  });

  it("la imagen de la portada está en el HTML con prioridad alta", async () => {
    const { container } = await renderPage();
    const img = container.querySelector(".kl-stage > img")!;
    expect(img.getAttribute("src")).toBe(FALLBACK_MEDIA[0].image);
    expect(img.getAttribute("fetchpriority")).toBe("high");
    expect(img.getAttribute("alt")).toBe("");
  });

  it("en inglés, en inglés y con enlace a la versión en español", async () => {
    const { container } = await renderPage("en");
    expect(screen.getByText(en.landing.hero.lead)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Create account" }).getAttribute("href")).toBe("/en/login?mode=register");
    expect(container.querySelector('a[hreflang="es"]')?.getAttribute("href")).toBe("/es");
  });
});

describe("Landing v2 · secciones", () => {
  it("orden: portada, lo que hay dentro, así funciona, comparativa y preguntas", async () => {
    const { container } = await renderPage();
    const ids = [...container.querySelectorAll("main > section")].map((s) => s.id);
    expect(ids).toEqual(["", "dentro", "funciona", "comparativa", "preguntas"]);
  });

  it("sin mencionar dinero (ni «gratis» ni «anuncios»)", async () => {
    const { container } = await renderPage();
    const visible = container.querySelector(".kl")!.textContent!.toLowerCase();
    expect(visible).not.toMatch(/gratis|anuncios/);
  });

  it("usa las imágenes de la semana y completa lo que falte con el respaldo", async () => {
    const hero0 = { ...FALLBACK_MEDIA[0], title: "Semana nueva", image: "https://x.supabase.co/h.jpg", depth: "https://x.supabase.co/h_d.jpg" };
    weekly.media = [hero0];
    const { container } = await renderPage();
    expect(container.querySelector(".kl-stage > img")!.getAttribute("src")).toBe("https://x.supabase.co/h.jpg");
    expect(container.querySelector(".kl-cap")!.textContent).toContain("Semana nueva");
    expect(container.querySelectorAll(".kl-win")).toHaveLength(4 + 1 + 3);
  });

  // F0 §7.3: el bloque de rankings sale de la portada hasta v2.0 (sin suelo de
  // votos que lo haga creíble: ver 04_DECISIONES). Ni notas ni enlaces a /best.
  it("sin rankings: ni notas, ni enlaces a /best, ni ancla #rankings", async () => {
    const { container } = await renderPage();
    expect(container.querySelector("#rankings")).toBeNull();
    expect(container.querySelector('a[href="#rankings"]')).toBeNull();
    expect(container.querySelector('a[href^="/es/best"]')).toBeNull();
    expect(container.querySelector(".kl-score")).toBeNull();
    const enPage = await renderPage("en");
    expect(enPage.container.querySelector("#rankings")).toBeNull();
    expect(enPage.container.querySelector('a[href^="/en/best"]')).toBeNull();
  });

  it("comparativa: seis apps por siete formatos y KULTURA con todos", async () => {
    const { container } = await renderPage();
    const rows = container.querySelectorAll(".kl-matrix tbody tr");
    expect(rows).toHaveLength(6);
    expect(rows[0].querySelectorAll('[aria-label="Sí"]')).toHaveLength(7);
    expect(rows[1].querySelectorAll('[aria-label="Sí"]')).toHaveLength(1);
  });

  it("FAQ visible y FAQPage en JSON-LD con las mismas preguntas", async () => {
    const { container } = await renderPage();
    const visible = [...container.querySelectorAll(".kl-faq summary")].map((s) => s.textContent);
    const ld = jsonLd(container)["@graph"].find((n) => n["@type"] === "FAQPage") as { mainEntity: { name: string }[] };
    expect(ld.mainEntity.map((q) => q.name)).toEqual(visible);
    expect(visible).not.toContain(es.landing.faq.what.q + "x");
    expect(visible).toHaveLength(5);
  });

  it("pie con los legales del idioma y la atribución de datos", async () => {
    const { container } = await renderPage();
    for (const p of ["privacy", "terms", "legal", "accessibility"]) {
      expect(container.querySelector(`footer a[href="/es/${p}"]`), p).toBeTruthy();
    }
    expect(screen.getByTestId("attr")).toBeTruthy();
  });
});

describe("Landing · metadatos (D-11, SEO-6)", () => {
  it("title y OG con la promesa del h1; tarjeta grande de X; og completo", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: "es" }) });
    expect(meta.title).toEqual({
      absolute: "KULTURA — Tu watchlist de cine, series, anime, manga, juegos, libros y cómics",
    });
    expect(meta.description).toBe(
      "Apunta lo que quieres ver, leer y jugar, puntúa lo que ya viste y compártelo con tus amigos. Gratis y sin anuncios."
    );
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
    expect(meta.openGraph).toMatchObject({
      siteName: "KULTURA",
      type: "website",
      locale: "es_ES",
      url: expect.stringMatching(/\/es$/),
      title: "KULTURA — Tu watchlist de cine, series, anime, manga, juegos, libros y cómics",
    });
  });

  it("en inglés, en inglés", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: "en" }) });
    expect(meta.title).toEqual({
      absolute: "KULTURA — Your watchlist for movies, TV, anime, manga, games, books and comics",
    });
    expect(meta.openGraph).toMatchObject({ locale: "en_US" });
  });
});
