/**
 * MOV-9 — hoja nativa de compartir con la tarjeta OG adjunta cuando el
 * navegador acepta archivos; si no, el enlace solo; si no hay hoja, quien
 * llama pone su alternativa.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const PNG = new Uint8Array([137, 80, 78, 71]);

function install({ share, canShare }: { share?: ReturnType<typeof vi.fn>; canShare?: ReturnType<typeof vi.fn> }) {
  Object.defineProperty(navigator, "share", { value: share, configurable: true, writable: true });
  Object.defineProperty(navigator, "canShare", { value: canShare, configurable: true, writable: true });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.resetModules();
  document.documentElement.lang = "es";
  fetchMock = vi.fn(async () => new Response(PNG, { status: 200, headers: { "content-type": "image/png" } }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  install({});
});

const load = () => import("@/components/pwa/share");

describe("ogImagePath", () => {
  it("añade el idioma del documento si falta y respeta el que hay", async () => {
    const { ogImagePath } = await load();
    expect(ogImagePath("/u/benevi", "en")).toBe("/en/u/benevi/opengraph-image");
    expect(ogImagePath("/es/best/movie/2026/")).toBe("/es/best/movie/2026/opengraph-image");
    expect(ogImagePath("/en/u/ana?x=1#y")).toBe("/en/u/ana/opengraph-image");
    expect(ogImagePath("/")).toBe("/es/opengraph-image");
  });
});

describe("shareNative", () => {
  it("con archivos admitidos, comparte enlace + tarjeta OG", async () => {
    const share = vi.fn(async () => undefined);
    install({ share, canShare: vi.fn(() => true) });
    const { shareNative } = await load();
    expect(await shareNative({ title: "Perfil", url: "https://k.app/es/u/ana", imagePath: "/u/ana" })).toBe("shared");
    expect(fetchMock).toHaveBeenCalledWith("/es/u/ana/opengraph-image", expect.objectContaining({ credentials: "omit" }));
    const data = (share.mock.calls as unknown as [ShareData][])[0][0];
    expect(data).toMatchObject({ title: "Perfil", url: "https://k.app/es/u/ana" });
    expect(data.files?.[0]).toBeInstanceOf(File);
    expect(data.files?.[0].type).toBe("image/png");
  });

  it("la imagen se pide una sola vez (precarga al apuntar + toque)", async () => {
    install({ share: vi.fn(async () => undefined), canShare: vi.fn(() => true) });
    const { prepareShareImage, shareNative } = await load();
    await prepareShareImage("/es/u/ana");
    await shareNative({ title: "x", url: "u", imagePath: "/es/u/ana" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("navegador sin archivos (sin canShare): solo el enlace, sin descargar nada", async () => {
    const share = vi.fn(async () => undefined);
    install({ share });
    const { shareNative } = await load();
    expect(await shareNative({ title: "t", text: "txt", url: "u", imagePath: "/es/u/ana" })).toBe("shared");
    expect(share).toHaveBeenCalledWith({ title: "t", text: "txt", url: "u" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sin tarjeta (404, no es imagen o canShare la rechaza): solo el enlace", async () => {
    const share = vi.fn(async () => undefined);
    install({ share, canShare: vi.fn(() => true) });
    fetchMock.mockResolvedValueOnce(new Response("no", { status: 404, headers: { "content-type": "text/html" } }));
    const { shareNative } = await load();
    await shareNative({ title: "Lista", url: "u", imagePath: "/u/ana/l/1" });
    expect(share).toHaveBeenCalledWith({ title: "Lista", url: "u" });
  });

  it("si la imagen tarda más del presupuesto, no espera: comparte sin ella", async () => {
    vi.useFakeTimers();
    const share = vi.fn(async () => undefined);
    install({ share, canShare: vi.fn(() => true) });
    fetchMock.mockImplementationOnce(() => new Promise(() => undefined));
    const { shareNative, IMAGE_BUDGET_MS } = await load();
    const result = shareNative({ title: "t", url: "u", imagePath: "/es/u/ana" });
    await vi.advanceTimersByTimeAsync(IMAGE_BUDGET_MS + 10);
    expect(await result).toBe("shared");
    expect(share).toHaveBeenCalledWith({ title: "t", url: "u" });
  });

  it("si rechaza el archivo (NotAllowedError) reintenta sin él", async () => {
    const share = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("no", "NotAllowedError"))
      .mockResolvedValueOnce(undefined);
    install({ share, canShare: vi.fn(() => true) });
    const { shareNative } = await load();
    expect(await shareNative({ title: "t", url: "u", imagePath: "/es/u/ana" })).toBe("shared");
    expect(share).toHaveBeenCalledTimes(2);
    expect(share.mock.calls[1][0]).toEqual({ title: "t", url: "u" });
  });

  it("cancelar la hoja es `cancelled` (sin alternativa); sin hoja, `unavailable`", async () => {
    install({ share: vi.fn().mockRejectedValue(new DOMException("x", "AbortError")), canShare: vi.fn(() => true) });
    const { shareNative } = await load();
    expect(await shareNative({ title: "t", url: "u", imagePath: "/es/u/ana" })).toBe("cancelled");
    install({});
    expect(await shareNative({ title: "t", url: "u" })).toBe("unavailable");
    install({ share: vi.fn().mockRejectedValue(new DOMException("x", "NotAllowedError")) });
    expect(await shareNative({ title: "t", url: "u" })).toBe("unavailable");
  });
});
