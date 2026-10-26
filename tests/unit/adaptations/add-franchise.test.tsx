// ============================================================
// F-29 · "Añadir toda la franquicia": uno a uno y respetando el límite
// de /api/library (30/min por usuario).
// ============================================================

import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import es from "../../../messages/es.json";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

// Biblioteca de quien pulsa, vista con su sesión del navegador.
const lib = vi.hoisted(() => ({
  owned: new Set<string>(),
  fail: false,
  queries: [] as Array<{ userId: unknown; ids: unknown }>,
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => {
      const q = { userId: undefined as unknown, ids: undefined as unknown };
      const chain = {
        select: () => chain,
        eq: (_c: string, v: unknown) => {
          q.userId = v;
          return chain;
        },
        in: async (_c: string, ids: string[]) => {
          q.ids = ids;
          lib.queries.push(q);
          if (lib.fail) return { data: null, error: { message: "boom" } };
          return { data: ids.filter((id) => lib.owned.has(id)).map((media_id) => ({ media_id })), error: null };
        },
      };
      return chain;
    },
  }),
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

import { AddFranchiseButton, FRANCHISE_ADD_GAP_MS } from "@/components/media/AddFranchiseButton";

const ITEMS = [
  { mediaId: "book_OL1W", title: "Uno" },
  { mediaId: "movie_2", title: "Dos" },
  { mediaId: "tv_3", title: "Tres" },
];

const ok = () => new Response(JSON.stringify({ entry: {} }), { status: 200 });
const tooMany = (retry: string) => new Response("{}", { status: 429, headers: { "Retry-After": retry } });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  refresh.mockReset();
  lib.owned = new Set();
  lib.fail = false;
  lib.queries = [];
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => {
  vi.useRealTimers();
});

async function press() {
  fireEvent.click(screen.getByRole("button"));
  // Deja correr la cola entera (pausas entre peticiones y esperas de 429).
  for (let i = 0; i < 20; i++) await act(() => vi.advanceTimersByTimeAsync(1000));
}

describe("AddFranchiseButton", () => {
  it("añade como Pendiente uno a uno, sin pisar nada, y refresca la ficha", async () => {
    fetchMock.mockImplementation(async () => ok());
    render(<AddFranchiseButton items={ITEMS} userId="u1" />);
    expect(screen.getByText('hint:{"count":3}')).toBeInTheDocument();
    await press();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const [i, call] of fetchMock.mock.calls.entries()) {
      const [url, init] = call as [string, RequestInit];
      expect(url).toBe("/api/library");
      expect(init.method).toBe("POST");
      // Solo id y estado: sin nota (nunca borra una nota existente).
      expect(JSON.parse(init.body as string)).toEqual({ mediaId: ITEMS[i].mediaId, status: "pending" });
    }
    expect(screen.getByRole("status")).toHaveTextContent('done:{"count":3}');
    expect(screen.queryByRole("button")).toBeNull();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(FRANCHISE_ADD_GAP_MS).toBeGreaterThan(0);
  });

  it("429 con Retry-After: espera esos segundos una vez y sigue", async () => {
    fetchMock
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(tooMany("3"))
      .mockResolvedValue(ok());
    render(<AddFranchiseButton items={ITEMS} userId="u1" />);
    fireEvent.click(screen.getByRole("button"));
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(screen.getByRole("status")).toHaveTextContent('waiting:{"seconds":3}');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(fetchMock).toHaveBeenCalledTimes(2); // aún esperando
    for (let i = 0; i < 10; i++) await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(screen.getByRole("status")).toHaveTextContent('done:{"count":3}');
  });

  it("segundo 429: para, dice cuántos lleva y deja seguir con el resto", async () => {
    fetchMock
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(tooMany("2"))
      .mockResolvedValueOnce(tooMany("2"));
    render(<AddFranchiseButton items={ITEMS} userId="u1" />);
    await press();
    expect(screen.getByRole("status")).toHaveTextContent('partial:{"done":1,"total":3}');
    // El botón sigue, ahora con los 2 que faltan.
    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.getByText('hint:{"count":2}')).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("429 sin nada añadido: aviso de límite", async () => {
    fetchMock.mockResolvedValue(tooMany("120"));
    render(<AddFranchiseButton items={ITEMS} userId="u1" />);
    await press();
    expect(screen.getByRole("status")).toHaveTextContent("rateLimited");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("un título que el proveedor no da (404/502) se salta; sesión caducada (401) para", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("{}", { status: 502 }))
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(new Response("{}", { status: 401 }));
    render(<AddFranchiseButton items={ITEMS} userId="u1" />);
    await press();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("status")).toHaveTextContent('partial:{"done":1,"total":3}');
  });

  it("solo inserta: lo que ya está en SU biblioteca (otra pestaña) se salta y no se pisa", async () => {
    fetchMock.mockImplementation(async () => ok());
    lib.owned = new Set(["movie_2"]);
    render(<AddFranchiseButton items={ITEMS} userId="u1" />);
    await press();
    expect(fetchMock.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string).mediaId)).toEqual([
      "book_OL1W",
      "tv_3",
    ]);
    expect(lib.queries.every((q) => q.userId === "u1")).toBe(true);
    expect(screen.getByRole("status")).toHaveTextContent('done:{"count":2}');
  });

  it("si entra justo antes de enviarlo, también se salta", async () => {
    fetchMock.mockImplementation(async () => {
      lib.owned.add("tv_3"); // otra pestaña lo añade mientras tanto
      return ok();
    });
    render(<AddFranchiseButton items={ITEMS} userId="u1" />);
    await press();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ya estaban todos: lo dice y no envía nada", async () => {
    lib.owned = new Set(ITEMS.map((i) => i.mediaId));
    render(<AddFranchiseButton items={ITEMS} userId="u1" />);
    await press();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("allIn");
  });

  it("si no se puede comprobar la biblioteca, no se envía nada y se puede reintentar", async () => {
    lib.fail = true;
    render(<AddFranchiseButton items={ITEMS} userId="u1" />);
    await press();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("error");
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("los textos existen en es y en (plural ICU)", () => {
    expect(es.adaptations.add.hint).toContain("plural");
    expect(es.adaptations.add.done).toContain("plural");
  });
});
