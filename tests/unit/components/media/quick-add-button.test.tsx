// ============================================================
// Fase 8.2 · Añadir en un toque desde Descubrir (bandera QUICK_ADD).
// Un POST /api/library/bulk de un solo id (solo inserta) y «Deshacer».
// ============================================================

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MediaItem } from "@/types/media";

const show = vi.fn();
const showError = vi.fn();
vi.mock("@/components/ui/ToastProvider", () => ({
  useToastContext: () => ({ show, showError, dismiss: vi.fn() }),
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean; sizes?: string }) => {
    const { fill: _fill, priority: _priority, sizes: _sizes, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...rest} />;
  },
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import { QuickAddButton } from "@/components/media/QuickAddButton";
import { MediaCard } from "@/components/media/MediaCard";

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
const bulk = (r: { added?: string[]; skipped?: string[]; failed?: string[] }) =>
  json(200, { data: { added: [], skipped: [], failed: [], ...r } });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  show.mockReset();
  showError.mockReset();
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

const button = () => screen.getByTestId("quick-add");

describe("QuickAddButton", () => {
  it("añade con un solo id a /api/library/bulk y avisa con «Deshacer»", async () => {
    fetchMock.mockResolvedValue(bulk({ added: ["movie_550"] }));
    render(<QuickAddButton mediaId="movie_550" title="Fight Club" />);
    expect(button()).toHaveAccessibleName('quickAdd:{"title":"Fight Club"}');
    fireEvent.click(button());
    await waitFor(() => expect(button()).toHaveAttribute("data-state", "inLibrary"));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/library/bulk");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ mediaIds: ["movie_550"] });
    expect(button()).toHaveAccessibleName('quickInLibrary:{"title":"Fight Club"}');
    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success", action: expect.objectContaining({ label: "undo" }) })
    );
  });

  it("«Deshacer» lo quita de la biblioteca y el botón vuelve a «+»", async () => {
    fetchMock.mockResolvedValueOnce(bulk({ added: ["movie_550"] })).mockResolvedValueOnce(json(200, { data: null }));
    render(<QuickAddButton mediaId="movie_550" title="Fight Club" />);
    fireEvent.click(button());
    await waitFor(() => expect(show).toHaveBeenCalled());
    (show.mock.calls[0][0] as { action: { onAction: () => void } }).action.onAction();
    await waitFor(() => expect(button()).toHaveAttribute("data-state", "idle"));

    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("/api/library");
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body as string)).toEqual({ mediaId: "movie_550" });
  });

  it("si ya estaba, lo dice y NO ofrece deshacer (no se borra lo que ya tenía)", async () => {
    fetchMock.mockResolvedValue(bulk({ skipped: ["movie_550"] }));
    render(<QuickAddButton mediaId="movie_550" title="Fight Club" />);
    fireEvent.click(button());
    await waitFor(() => expect(button()).toHaveAttribute("data-state", "inLibrary"));
    expect(show).toHaveBeenCalledTimes(1);
    expect((show.mock.calls[0][0] as { action?: unknown }).action).toBeUndefined();
  });

  it("una vez añadido, otro toque no repite la petición", async () => {
    fetchMock.mockResolvedValue(bulk({ added: ["movie_550"] }));
    render(<QuickAddButton mediaId="movie_550" title="Fight Club" />);
    fireEvent.click(button());
    await waitFor(() => expect(button()).toHaveAttribute("data-state", "inLibrary"));
    fireEvent.click(button());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sin ficha del proveedor o con error: aviso de error y se puede reintentar", async () => {
    fetchMock.mockResolvedValueOnce(bulk({ failed: ["movie_550"] }));
    render(<QuickAddButton mediaId="movie_550" title="Fight Club" />);
    fireEvent.click(button());
    await waitFor(() => expect(showError).toHaveBeenCalledWith("quickAddFailed"));
    expect(button()).toHaveAttribute("data-state", "idle");

    fetchMock.mockResolvedValueOnce(json(429, { error: { code: "rate_limited" } }, { "Retry-After": "20" }));
    fireEvent.click(button());
    await waitFor(() => expect(showError).toHaveBeenCalledWith("quickAddRateLimited"));
    expect(button()).toHaveAttribute("data-state", "idle");
  });
});

describe("MediaCard con acción", () => {
  const item: MediaItem = { id: "movie_550", externalId: "550", type: "movie", title: "Fight Club" };

  it("sin acción no hay botón (el resto de pantallas no cambia)", () => {
    render(<MediaCard item={item} />);
    expect(screen.queryByTestId("quick-add")).not.toBeInTheDocument();
  });

  it("con acción, el botón va fuera del enlace de la tarjeta", () => {
    render(<MediaCard item={item} action={<QuickAddButton mediaId={item.id} title={item.title} />} />);
    expect(button().closest("a")).toBeNull();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/media/movie/550");
  });
});
