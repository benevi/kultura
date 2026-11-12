// ============================================================
// F-29 · "Añadir toda la franquicia": una sola petición a
// POST /api/library/bulk (saneamiento 6.4), con un reintento ante 429.
// ============================================================

import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import es from "../../../messages/es.json";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

import { AddFranchiseButton } from "@/components/media/AddFranchiseButton";

const ITEMS = [
  { mediaId: "book_OL1W", title: "Uno" },
  { mediaId: "movie_2", title: "Dos" },
  { mediaId: "tv_3", title: "Tres" },
];
const IDS = ITEMS.map((i) => i.mediaId);

const result = (r: { added?: string[]; skipped?: string[]; failed?: string[] }) =>
  new Response(JSON.stringify({ data: { added: [], skipped: [], failed: [], ...r } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
const tooMany = (retry: string) =>
  new Response(JSON.stringify({ error: { code: "rate_limited" } }), { status: 429, headers: { "Retry-After": retry } });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  refresh.mockReset();
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => {
  vi.useRealTimers();
});

async function press() {
  fireEvent.click(screen.getByRole("button"));
  for (let i = 0; i < 10; i++) await act(() => vi.advanceTimersByTimeAsync(1000));
}

describe("AddFranchiseButton", () => {
  it("una sola petición con todos los ids (sin estado ni nota) y refresca la ficha", async () => {
    fetchMock.mockResolvedValue(result({ added: IDS }));
    render(<AddFranchiseButton items={ITEMS} />);
    expect(screen.getByText('hint:{"count":3}')).toBeInTheDocument();
    await press();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/library/bulk");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ mediaIds: IDS });
    expect(screen.getByRole("status")).toHaveTextContent('done:{"count":3}');
    expect(screen.queryByRole("button")).toBeNull();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("lo que ya estaba (otra pestaña) no cuenta como añadido", async () => {
    fetchMock.mockResolvedValue(result({ added: ["book_OL1W", "tv_3"], skipped: ["movie_2"] }));
    render(<AddFranchiseButton items={ITEMS} />);
    await press();
    expect(screen.getByRole("status")).toHaveTextContent('done:{"count":2}');
  });

  it("ya estaban todos: lo dice y no refresca", async () => {
    fetchMock.mockResolvedValue(result({ skipped: IDS }));
    render(<AddFranchiseButton items={ITEMS} />);
    await press();
    expect(screen.getByRole("status")).toHaveTextContent("allIn");
    expect(screen.queryByRole("button")).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("sin ficha del proveedor: quedan para reintentar, solo esos", async () => {
    fetchMock.mockResolvedValueOnce(result({ added: ["book_OL1W"], failed: ["movie_2", "tv_3"] }));
    render(<AddFranchiseButton items={ITEMS} />);
    await press();
    expect(screen.getByRole("status")).toHaveTextContent('partial:{"done":1,"total":3}');
    expect(screen.getByText('hint:{"count":2}')).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(result({ added: ["movie_2", "tv_3"] }));
    await press();
    expect(JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string)).toEqual({
      mediaIds: ["movie_2", "tv_3"],
    });
    expect(screen.getByRole("status")).toHaveTextContent('done:{"count":2}');
  });

  it("429 con Retry-After: espera esos segundos una vez y reintenta", async () => {
    fetchMock.mockResolvedValueOnce(tooMany("3")).mockResolvedValueOnce(result({ added: IDS }));
    render(<AddFranchiseButton items={ITEMS} />);
    fireEvent.click(screen.getByRole("button"));
    await act(() => vi.advanceTimersByTimeAsync(10));
    expect(screen.getByRole("status")).toHaveTextContent('waiting:{"seconds":3}');
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(fetchMock).toHaveBeenCalledTimes(1); // aún esperando
    for (let i = 0; i < 5; i++) await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status")).toHaveTextContent('done:{"count":3}');
  });

  it("segundo 429 o Retry-After largo: aviso de límite y se puede seguir", async () => {
    fetchMock.mockResolvedValue(tooMany("120"));
    render(<AddFranchiseButton items={ITEMS} />);
    await press();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("rateLimited");
    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();

    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(tooMany("2")).mockResolvedValueOnce(tooMany("2"));
    await press();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status")).toHaveTextContent("rateLimited");
  });

  it("sesión caducada o fallo de red: error y se puede reintentar", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 401 }));
    render(<AddFranchiseButton items={ITEMS} />);
    await press();
    expect(screen.getByRole("status")).toHaveTextContent("error");
    expect(screen.getByRole("button")).toBeInTheDocument();

    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await press();
    expect(screen.getByRole("status")).toHaveTextContent("error");
  });

  it("los textos existen en es (plural ICU)", () => {
    expect(es.adaptations.add.hint).toContain("plural");
    expect(es.adaptations.add.done).toContain("plural");
    expect(es.adaptations.add.progress).toContain("plural");
  });
});
