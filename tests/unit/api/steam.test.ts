// ============================================================
// KULTURA — Steam Store API (E-GAMES-STEAM)
// Cubre: resolución del appid (RAWG stores → best-effort por nombre), params de
// idioma/país, normalización a SteamInfo, y sobre todo el CONTRATO DE
// DEGRADACIÓN: ningún fallo de Steam puede romper la ficha de un juego.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { RawgGame } from "@/lib/api/rawg";
import {
  steamLanguage,
  steamCountry,
  steamStoreUrl,
  steamAppIdFromUrl,
  steamAppIdFromRawgGame,
  parseSupportedLanguages,
  searchSteamAppId,
  getSteamAppDetails,
  toSteamInfo,
  getSteamInfoForGame,
} from "@/lib/api/steam";

function game(overrides: Partial<RawgGame> = {}): RawgGame {
  return {
    id: 1,
    name: "Hades",
    background_image: null,
    released: "2020-09-17",
    rating: 4.7,
    metacritic: 93,
    genres: [],
    ...overrides,
  };
}

function mockFetchSequence(
  responses: { ok?: boolean; status?: number; body: unknown }[]
) {
  const spy = vi.fn();
  for (const r of responses) {
    spy.mockResolvedValueOnce({
      ok: r.ok ?? true,
      status: r.status ?? 200,
      json: async () => r.body,
    });
  }
  vi.stubGlobal("fetch", spy);
  return spy;
}

function urlOfCall(spy: ReturnType<typeof mockFetchSequence>, i = 0): URL {
  return new URL(spy.mock.calls[i][0] as string);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ── Locale → params ───────────────────────────────────────────────────────────

describe("steamLanguage / steamCountry", () => {
  it("derivan del locale activo", () => {
    expect(steamLanguage("es")).toBe("spanish");
    expect(steamLanguage("en")).toBe("english");
    expect(steamCountry("es")).toBe("ES");
    expect(steamCountry("en")).toBe("US");
  });

  it("sin locale caen al default de la app (es)", () => {
    expect(steamLanguage()).toBe("spanish");
    expect(steamCountry(null)).toBe("ES");
  });
});

// ── Resolución del appid ──────────────────────────────────────────────────────

describe("steamAppIdFromUrl", () => {
  it("extrae el appid de una URL de tienda de Steam", () => {
    expect(
      steamAppIdFromUrl("https://store.steampowered.com/app/1145360/Hades/")
    ).toBe(1145360);
    expect(steamAppIdFromUrl("http://store.steampowered.com/app/620")).toBe(620);
  });

  it("null para URLs de otras tiendas o sin id", () => {
    expect(steamAppIdFromUrl("https://www.epicgames.com/store/p/hades")).toBeNull();
    expect(steamAppIdFromUrl("https://store.steampowered.com/search/?term=x")).toBeNull();
    expect(steamAppIdFromUrl(undefined)).toBeNull();
  });
});

describe("steamAppIdFromRawgGame", () => {
  it("usa la entrada de Steam de RAWG (slug)", () => {
    const id = steamAppIdFromRawgGame(
      game({
        stores: [
          { url: "https://www.gog.com/game/hades", store: { slug: "gog" } },
          {
            url: "https://store.steampowered.com/app/1145360/Hades/",
            store: { slug: "steam" },
          },
        ],
      })
    );
    expect(id).toBe(1145360);
  });

  it("reconoce Steam por domain y por id numérico", () => {
    expect(
      steamAppIdFromRawgGame(
        game({
          stores: [
            {
              url: "https://store.steampowered.com/app/620/Portal_2/",
              store: { domain: "store.steampowered.com" },
            },
          ],
        })
      )
    ).toBe(620);
    expect(
      steamAppIdFromRawgGame(
        game({
          stores: [
            {
              url: "https://store.steampowered.com/app/292030/",
              store: { id: 1 },
            },
          ],
        })
      )
    ).toBe(292030);
  });

  it("acepta la URL de Steam aunque falten los metadatos de tienda", () => {
    expect(
      steamAppIdFromRawgGame(
        game({ stores: [{ url: "https://store.steampowered.com/app/49520/" }] })
      )
    ).toBe(49520);
  });

  it("null sin stores o sin ninguna de Steam", () => {
    expect(steamAppIdFromRawgGame(game())).toBeNull();
    expect(
      steamAppIdFromRawgGame(
        game({ stores: [{ url: "https://www.gog.com/x", store: { slug: "gog" } }] })
      )
    ).toBeNull();
  });
});

describe("searchSteamAppId (best-effort por nombre)", () => {
  it("acepta la coincidencia exacta normalizada (acentos/signos/mayúsculas)", async () => {
    const spy = mockFetchSequence([
      { body: { items: [{ id: 553850, name: "HELLDIVERS™ 2", type: "app" }] } },
    ]);
    await expect(searchSteamAppId("Helldivers 2", "en")).resolves.toBe(553850);
    const url = urlOfCall(spy);
    expect(url.searchParams.get("term")).toBe("Helldivers 2");
    expect(url.searchParams.get("cc")).toBe("US");
    expect(url.searchParams.get("l")).toBe("english");
  });

  it("RECHAZA un parecido (mostrar el precio de otro juego es peor que nada)", async () => {
    mockFetchSequence([
      { body: { items: [{ id: 99, name: "Hades II", type: "app" }] } },
    ]);
    await expect(searchSteamAppId("Hades")).resolves.toBeNull();
  });

  it("respuesta vacía o no-ok → null", async () => {
    mockFetchSequence([{ body: { items: [] } }]);
    await expect(searchSteamAppId("Nada")).resolves.toBeNull();

    vi.unstubAllGlobals();
    mockFetchSequence([{ ok: false, status: 503, body: {} }]);
    await expect(searchSteamAppId("Nada")).resolves.toBeNull();
  });

  it("nombre vacío → null sin llamar a Steam", async () => {
    const spy = mockFetchSequence([]);
    await expect(searchSteamAppId("   ")).resolves.toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });
});

// ── appdetails ────────────────────────────────────────────────────────────────

describe("getSteamAppDetails", () => {
  it("envía appids + idioma + país y devuelve data", async () => {
    const spy = mockFetchSequence([
      { body: { "1145360": { success: true, data: { name: "Hades" } } } },
    ]);
    const data = await getSteamAppDetails(1145360, "es");
    expect(data?.name).toBe("Hades");
    const url = urlOfCall(spy);
    expect(url.searchParams.get("appids")).toBe("1145360");
    expect(url.searchParams.get("l")).toBe("spanish");
    expect(url.searchParams.get("cc")).toBe("ES");
  });

  it("success:false → null (appid inexistente o no disponible en el país)", async () => {
    mockFetchSequence([{ body: { "999": { success: false } } }]);
    await expect(getSteamAppDetails(999)).resolves.toBeNull();
  });

  it("HTTP no-ok → null", async () => {
    mockFetchSequence([{ ok: false, status: 500, body: {} }]);
    await expect(getSteamAppDetails(1)).resolves.toBeNull();
  });
});

// ── Normalización ─────────────────────────────────────────────────────────────

describe("parseSupportedLanguages", () => {
  it("limpia HTML, nota de doblaje y asteriscos", () => {
    expect(
      parseSupportedLanguages(
        "English<strong>*</strong>, Spanish - Spain, Japanese*<br><strong>*</strong>languages with full audio support"
      )
    ).toEqual(["English", "Spanish - Spain", "Japanese"]);
  });

  it("undefined / vacío → undefined", () => {
    expect(parseSupportedLanguages(undefined)).toBeUndefined();
    expect(parseSupportedLanguages("")).toBeUndefined();
    expect(parseSupportedLanguages("<br>")).toBeUndefined();
  });
});

describe("toSteamInfo", () => {
  it("mapea precio, descuento, idiomas, capturas (máx 4) y metacritic", () => {
    const info = toSteamInfo(1145360, {
      type: "game",
      is_free: false,
      supported_languages: "English, Spanish - Spain",
      price_overview: {
        final_formatted: "12,49€",
        initial_formatted: "24,99€",
        discount_percent: 50,
      },
      screenshots: Array.from({ length: 6 }, (_, i) => ({
        id: i,
        path_thumbnail: `https://cdn.cloudflare.steamstatic.com/t${i}.jpg`,
        path_full: `https://cdn.cloudflare.steamstatic.com/f${i}.jpg`,
      })),
      metacritic: { score: 93 },
    });

    expect(info.appId).toBe(1145360);
    expect(info.storeUrl).toBe(steamStoreUrl(1145360));
    expect(info.isFree).toBe(false);
    expect(info.price).toBe("12,49€");
    expect(info.priceOriginal).toBe("24,99€");
    expect(info.discountPercent).toBe(50);
    expect(info.supportedLanguages).toEqual(["English", "Spanish - Spain"]);
    expect(info.screenshots).toHaveLength(4);
    expect(info.metacritic).toBe(93);
  });

  it("sin descuento no expone precio original ni porcentaje", () => {
    const info = toSteamInfo(1, {
      price_overview: {
        final_formatted: "19,99€",
        initial_formatted: "19,99€",
        discount_percent: 0,
      },
    });
    expect(info.priceOriginal).toBeUndefined();
    expect(info.discountPercent).toBeUndefined();
  });

  it("juego gratuito: isFree true sin precio", () => {
    const info = toSteamInfo(2, { is_free: true });
    expect(info.isFree).toBe(true);
    expect(info.price).toBeUndefined();
  });

  it("descarta capturas incompletas", () => {
    const info = toSteamInfo(3, {
      screenshots: [
        { path_thumbnail: "https://x/t.jpg" }, // sin full
        { path_thumbnail: "https://x/t2.jpg", path_full: "https://x/f2.jpg" },
      ],
    });
    expect(info.screenshots).toEqual([
      { thumb: "https://x/t2.jpg", full: "https://x/f2.jpg" },
    ]);
  });
});

// ── Contrato de degradación ───────────────────────────────────────────────────

describe("getSteamInfoForGame — degradación silenciosa", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("camino feliz: appid de RAWG + appdetails → SteamInfo", async () => {
    mockFetchSequence([
      {
        body: {
          "1145360": {
            success: true,
            data: { type: "game", is_free: false, price_overview: { final_formatted: "24,99€" } },
          },
        },
      },
    ]);
    const info = await getSteamInfoForGame(
      game({
        stores: [
          {
            url: "https://store.steampowered.com/app/1145360/Hades/",
            store: { slug: "steam" },
          },
        ],
      }),
      "es"
    );
    expect(info?.appId).toBe(1145360);
    expect(info?.price).toBe("24,99€");
  });

  it("sin enlace de Steam cae al best-effort por nombre", async () => {
    const spy = mockFetchSequence([
      { body: { items: [{ id: 620, name: "Portal 2" }] } },
      { body: { "620": { success: true, data: { type: "game", is_free: false } } } },
    ]);
    const info = await getSteamInfoForGame(game({ name: "Portal 2" }), "en");
    expect(info?.appId).toBe(620);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("appid no resoluble → null y NO se llama a appdetails", async () => {
    const spy = mockFetchSequence([{ body: { items: [] } }]);
    await expect(getSteamInfoForGame(game())).resolves.toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("un DLC/demo (type != game) no se muestra como el juego", async () => {
    mockFetchSequence([
      { body: { "1": { success: true, data: { type: "dlc" } } } },
    ]);
    const info = await getSteamInfoForGame(
      game({ stores: [{ url: "https://store.steampowered.com/app/1/" }] })
    );
    expect(info).toBeNull();
  });

  it("red caída → null (la ficha se pinta igual), sin propagar la excepción", async () => {
    const spy = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    vi.stubGlobal("fetch", spy);
    await expect(
      getSteamInfoForGame(
        game({ stores: [{ url: "https://store.steampowered.com/app/1/" }] })
      )
    ).resolves.toBeNull();
  });

  it("JSON con shape inesperado → null, sin lanzar", async () => {
    mockFetchSequence([{ body: "no soy un objeto" }]);
    await expect(
      getSteamInfoForGame(
        game({ stores: [{ url: "https://store.steampowered.com/app/1/" }] })
      )
    ).resolves.toBeNull();
  });
});
