// ============================================================
// KULTURA — Traducción de sinopsis (E-SINOPSIS-I18N)
//
// El contrato que importa es económico y de robustez, no lingüístico:
//   1. Lo que ya está en el idioma pedido NO llega al modelo.
//   2. Lo que ya se tradujo una vez NO se vuelve a pagar (caché compartida).
//   3. Cualquier fallo (sin clave, tabla sin migrar, modelo caído) devuelve el
//      texto ORIGINAL — la ficha nunca se queda sin sinopsis.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

const { streamMock, adminClientMock, cacheStore } = vi.hoisted(() => ({
  streamMock: vi.fn(),
  adminClientMock: vi.fn(),
  cacheStore: new Map<string, string>(),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { stream: streamMock };
  },
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: adminClientMock }));

vi.mock("@/lib/env", () => ({
  env: new Proxy({} as Record<string, string>, {
    get: (_t, prop: string) =>
      prop === "ANTHROPIC_API_KEY" ? process.env.__TEST_ANTHROPIC_KEY : undefined,
  }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ENGLISH =
  "After a demon attack leaves his family slain and his sister cursed, a " +
  "young man sets out on a journey to find a cure and to avenge the dead.";

const SPANISH =
  "Tras un ataque demoníaco que acaba con su familia y maldice a su hermana, " +
  "un joven emprende un viaje para encontrar una cura y vengar a los muertos.";

/** Respuesta del SDK en su forma de streaming (`.finalMessage()`). */
function modelReturns(text: string) {
  streamMock.mockReturnValue({
    finalMessage: async () => ({ content: [{ type: "text", text }] }),
  });
}

/** Cliente admin en memoria: emula `media_translations` con un Map. */
function makeAdminClient() {
  return {
    from: () => ({
      select: () => ({
        eq: (_col: string, key: string) => ({
          maybeSingle: async () => ({
            data: cacheStore.has(key) ? { content: cacheStore.get(key) } : null,
            error: null,
          }),
        }),
      }),
      upsert: async (row: { cache_key: string; content: string }) => {
        cacheStore.set(row.cache_key, row.content);
        return { error: null };
      },
    }),
  };
}

async function loadModule() {
  return import("@/lib/translate/synopsis");
}

beforeEach(() => {
  vi.resetModules();
  streamMock.mockReset();
  cacheStore.clear();
  adminClientMock.mockReset();
  adminClientMock.mockImplementation(makeAdminClient);
  process.env.__TEST_ANTHROPIC_KEY = "sk-ant-test";
});

describe("translateSynopsis", () => {
  it("texto ya en el idioma activo → se devuelve tal cual sin llamar al modelo", async () => {
    const { translateSynopsis } = await loadModule();
    const out = await translateSynopsis({
      text: SPANISH,
      locale: "es",
      mediaId: "anime_al-1535",
    });

    expect(out).toBe(SPANISH);
    expect(streamMock).not.toHaveBeenCalled();
  });

  it("texto en otro idioma → lo traduce y devuelve la traducción", async () => {
    modelReturns(SPANISH);
    const { translateSynopsis } = await loadModule();

    const out = await translateSynopsis({
      text: ENGLISH,
      locale: "es",
      mediaId: "anime_al-1535",
    });

    expect(out).toBe(SPANISH);
    expect(streamMock).toHaveBeenCalledTimes(1);
  });

  it("la segunda visita no vuelve a pagar: sale de la caché compartida", async () => {
    modelReturns(SPANISH);
    const { translateSynopsis } = await loadModule();

    const args = { text: ENGLISH, locale: "es", mediaId: "game_667657" };
    await translateSynopsis(args);
    // La escritura de caché va sin await (no debe retrasar la respuesta):
    // se cede el turno del event loop antes de comprobarla.
    await new Promise((r) => setTimeout(r, 0));

    // Módulo recargado → caché en memoria vacía, así que este acierto solo
    // puede venir de la tabla: es el caso que de verdad ahorra dinero.
    vi.resetModules();
    const fresh = await loadModule();
    streamMock.mockClear();

    const second = await fresh.translateSynopsis(args);
    expect(second).toBe(SPANISH);
    expect(streamMock).not.toHaveBeenCalled();
  });

  it("sin ANTHROPIC_API_KEY → texto original, nunca vacío", async () => {
    delete process.env.__TEST_ANTHROPIC_KEY;
    const { translateSynopsis } = await loadModule();

    const out = await translateSynopsis({
      text: ENGLISH,
      locale: "es",
      mediaId: "comic_4050-1",
    });

    expect(out).toBe(ENGLISH);
    expect(streamMock).not.toHaveBeenCalled();
  });

  it("modelo caído → texto original, la ficha no se rompe", async () => {
    streamMock.mockImplementation(() => {
      throw new Error("overloaded");
    });
    const { translateSynopsis } = await loadModule();

    const out = await translateSynopsis({
      text: ENGLISH,
      locale: "es",
      mediaId: "game_667657",
    });
    expect(out).toBe(ENGLISH);
  });

  it("tabla sin migrar → traduce igual, solo se queda sin caché", async () => {
    adminClientMock.mockImplementation(() => {
      throw new Error('relation "media_translations" does not exist');
    });
    modelReturns(SPANISH);
    const { translateSynopsis } = await loadModule();

    const out = await translateSynopsis({
      text: ENGLISH,
      locale: "es",
      mediaId: "manga_abc",
    });
    expect(out).toBe(SPANISH);
  });

  it("cacheOnly → sirve la caché si existe, y si no el original, sin llamar al modelo", async () => {
    modelReturns(SPANISH);
    const { translateSynopsis } = await loadModule();
    const args = { text: ENGLISH, locale: "es", mediaId: "book_xyz" };

    const cold = await translateSynopsis({ ...args, cacheOnly: true });
    expect(cold).toBe(ENGLISH);
    expect(streamMock).not.toHaveBeenCalled();

    // Alguien abre la ficha y paga la traducción…
    await translateSynopsis(args);
    await new Promise((r) => setTimeout(r, 0));

    vi.resetModules();
    const fresh = await loadModule();
    streamMock.mockClear();

    // …y a partir de ahí los metadatos la aprovechan gratis.
    const warm = await fresh.translateSynopsis({ ...args, cacheOnly: true });
    expect(warm).toBe(SPANISH);
    expect(streamMock).not.toHaveBeenCalled();
  });

  it("sinopsis vacía → cadena vacía, sin tocar caché ni modelo", async () => {
    const { translateSynopsis } = await loadModule();
    expect(await translateSynopsis({ text: "", locale: "es", mediaId: "x_1" })).toBe("");
    expect(await translateSynopsis({ text: null, locale: "es", mediaId: "x_1" })).toBe("");
    expect(streamMock).not.toHaveBeenCalled();
  });

  it("un texto desmesurado no se manda al modelo (no es una sinopsis)", async () => {
    const { translateSynopsis } = await loadModule();
    const huge = `${ENGLISH} `.repeat(200);

    const out = await translateSynopsis({ text: huge, locale: "es", mediaId: "game_1" });
    expect(out).toBe(huge.trim());
    expect(streamMock).not.toHaveBeenCalled();
  });

  it("locale en → traduce el español al inglés (la regla va en ambos sentidos)", async () => {
    modelReturns(ENGLISH);
    const { translateSynopsis } = await loadModule();

    const out = await translateSynopsis({
      text: SPANISH,
      locale: "en",
      mediaId: "manga_uuid",
    });
    expect(out).toBe(ENGLISH);
    expect(streamMock).toHaveBeenCalledTimes(1);
  });
});
