// ============================================================
// F-29 · Ficha: "También existe como…", franquicia y "Compartir mi nota"
// ============================================================

import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { STORED_VERSION, type StoredAdaptations } from "@/lib/adaptations/model";

const mocks = vi.hoisted(() => ({
  getAdaptations: vi.fn(),
  loadPosters: vi.fn(),
  loadInLibrary: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/adaptations/load", () => ({ getAdaptations: mocks.getAdaptations }));
vi.mock("@/lib/adaptations/enrich", () => ({ loadPosters: mocks.loadPosters, loadInLibrary: mocks.loadInLibrary }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("next-intl/server", () => ({
  getTranslations: async ({ namespace }: { namespace: string }) => {
    const t = (key: string, values?: Record<string, unknown>) =>
      `${namespace}.${key}${values ? `(${Object.values(values).join(",")})` : ""}`;
    t.raw = (key: string) => (key === "adding" ? "Añadiendo {done} de {total}" : key === "addedOne" ? "{count} añadido" : "{count} añadidos");
    return t;
  },
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (props: { src: string }) => <img src={props.src} />,
}));

import { AdaptationsSection } from "@/components/media/AdaptationsSection";
import { AddFranchiseButton } from "@/components/media/AddFranchiseButton";
import { ShareRatingButton } from "@/components/media/ShareRatingButton";

const DUNE: StoredAdaptations = {
  v: STORED_VERSION,
  qid: "Q2",
  works: [
    { mediaId: "book_OL893415W", type: "book", rel: "source", qid: "Q3", es: "Dune", year: 1965 },
    { mediaId: "movie_841", type: "movie", rel: "sibling", qid: "Q4", es: "Dune", year: 1984 },
    { mediaId: "movie_693134", type: "movie", rel: "franchise", qid: "Q5", es: "Dune: parte dos", year: 2024 },
  ],
  franchise: { qid: "Q6", es: "Dune" },
};
const ITEM = { id: "movie_438631", type: "movie" as const, externalId: "438631" };

beforeEach(() => {
  mocks.getAdaptations.mockResolvedValue(DUNE);
  mocks.loadPosters.mockResolvedValue(new Map([["movie_841", "https://image.tmdb.org/t/p/w500/a.jpg"]]));
  mocks.loadInLibrary.mockResolvedValue(new Set(["movie_841"]));
});

describe("AdaptationsSection", () => {
  it("pinta origen y otras adaptaciones con enlace a su ficha, y la fuente (Wikidata)", async () => {
    render(await AdaptationsSection({ item: ITEM, locale: "es", userId: null }));
    expect(screen.getByRole("heading", { name: "adaptations.title" })).toBeInTheDocument();
    const links = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(links).toContain("/media/book/OL893415W");
    expect(links).toContain("/media/movie/841");
    expect(screen.getByText(/adaptations\.rel\.source/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Wikidata" })).toHaveAttribute("href", "https://www.wikidata.org/wiki/Q2");
    // Sin sesión: CTA de registro con vuelta a la ficha, sin botón de añadir.
    expect(screen.getByRole("link", { name: "adaptations.loginToAdd" })).toHaveAttribute(
      "href",
      "/login?mode=register&next=%2Fes%2Fmedia%2Fmovie%2F438631",
    );
    expect(mocks.loadInLibrary).not.toHaveBeenCalled();
  });

  it("con sesión: 'Añadir toda la franquicia' solo con lo que falta", async () => {
    render(await AdaptationsSection({ item: ITEM, locale: "es", userId: "u1" }));
    expect(screen.getByRole("heading", { name: "adaptations.franchise(Dune)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "adaptations.addAll(2)" })).toBeInTheDocument();
    expect(mocks.loadInLibrary).toHaveBeenCalledWith({}, "u1", ["book_OL893415W", "movie_841", "movie_693134"]);
  });

  it("todo en la biblioteca: aviso en vez de botón", async () => {
    mocks.loadInLibrary.mockResolvedValue(new Set(["book_OL893415W", "movie_841", "movie_693134"]));
    render(await AdaptationsSection({ item: ITEM, locale: "es", userId: "u1" }));
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("adaptations.allInLibrary")).toBeInTheDocument();
  });

  it("sin datos (o Wikidata caído): no pinta nada", async () => {
    mocks.getAdaptations.mockResolvedValue(null);
    expect(await AdaptationsSection({ item: ITEM, locale: "es" })).toBeNull();
  });
});

const LABELS = {
  addAll: "Añadir toda la franquicia",
  adding: "Añadiendo {done} de {total}",
  addedOne: "{count} añadido",
  addedOther: "{count} añadidos",
  rateLimited: "Espera un minuto",
  failed: "No se pudo",
};

describe("AddFranchiseButton", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("añade a Pendiente de uno en uno y refresca", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AddFranchiseButton mediaIds={["movie_1", "book_OL1W"]} labels={LABELS} />);
    fireEvent.click(screen.getByRole("button", { name: LABELS.addAll }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("2 añadidos"));
    expect(fetchMock.mock.calls.map((c) => JSON.parse((c as unknown as [string, RequestInit])[1].body as string))).toEqual([
      { mediaId: "movie_1", status: "pending" },
      { mediaId: "book_OL1W", status: "pending" },
    ]);
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("429: se para, avisa y deja seguir con lo que falta", async () => {
    const statuses = [200, 429, 200];
    const fetchMock = vi.fn(async () => new Response("{}", { status: statuses.shift() }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AddFranchiseButton mediaIds={["a_1", "b_2"]} labels={LABELS} />);
    fireEvent.click(screen.getByRole("button", { name: LABELS.addAll }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Espera un minuto"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: LABELS.addAll }));
    });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("1 añadido"));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(JSON.parse((fetchMock.mock.calls[2] as unknown as [string, RequestInit])[1].body as string).mediaId).toBe("b_2");
  });
});

describe("ShareRatingButton", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sin hoja nativa copia el enlace absoluto", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    render(
      <ShareRatingButton
        path="/es/u/benevi/r/movie/438631?s=abc"
        labels={{ button: "Compartir mi nota", shareText: "Mi nota", copied: "Copiado", copyError: "Error" }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Compartir mi nota" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Copiado"));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/es/u/benevi/r/movie/438631?s=abc`);
  });
});
