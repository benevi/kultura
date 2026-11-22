// ============================================================
// Fase 8.5 · F2c: la mitad de abajo de la ficha con «Sala».
// Las acciones de hoy (listas, recomendar, compartir la nota, denunciar,
// añadir la franquicia) con `skin="sala"`: mismo comportamiento, disparador
// de «Sala». Y «También existe como…» con `SalaWorkCard`.
// ============================================================

import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import type { AdaptationView } from "@/lib/adaptations/display";
import type { MediaItem } from "@/types/media";

const h = vi.hoisted(() => ({
  shareNative: vi.fn(),
  getAdaptations: vi.fn(),
  buildAdaptationView: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  useLocale: () => "es",
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={`/es${href}`} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: ({ src }: { src: string }) => <img src={src} alt="" />,
}));
vi.mock("@/components/ui/ToastProvider", () => ({
  useToastContext: () => ({ show: vi.fn(), showError: vi.fn(), dismiss: vi.fn() }),
}));
vi.mock("@/components/pwa/share", () => ({ shareNative: h.shareNative }));
vi.mock("@/lib/adaptations/load", () => ({ getAdaptations: h.getAdaptations }));
vi.mock("@/lib/adaptations/display", () => ({ buildAdaptationView: h.buildAdaptationView }));
// En la app llega por next/dynamic; aquí, directo (el import perezoso se comprueba aparte).
vi.mock("@/components/sala/SalaButtonLazy", async () => ({
  SalaButtonLazy: (await import("@/components/sala/SalaButton")).SalaButton,
}));

import { AddToListButton } from "@/components/social/AddToListButton";
import { RecommendButton } from "@/components/social/RecommendButton";
import { ReportButton } from "@/components/social/ReportButton";
import { ShareRatingButton } from "@/components/media/ShareRatingButton";
import { AddFranchiseButton } from "@/components/media/AddFranchiseButton";
import { AdaptationsSection } from "@/components/media/AdaptationsSection";

const item: MediaItem = { id: "movie_550", externalId: "550", type: "movie", title: "Fight Club" };

/** Un `SalaButton`: 48 px, esquinas rectas, tokens de «Sala». */
const isSala = (el: HTMLElement) => el.className.includes("min-h-sala-target") && !el.className.includes("rounded");

beforeEach(() => {
  h.shareNative.mockReset();
});

describe("F2c: disparadores con skin=sala", () => {
  it("añadir a una lista y recomendar: SalaButton; sin la prop, el de hoy", () => {
    const { unmount } = render(
      <>
        <AddToListButton item={item} skin="sala" />
        <RecommendButton item={item} skin="sala" />
      </>
    );
    expect(isSala(screen.getByRole("button", { name: "addToList" }))).toBe(true);
    expect(isSala(screen.getByRole("button", { name: "recommend" }))).toBe(true);
    unmount();
    render(
      <>
        <AddToListButton item={item} />
        <RecommendButton item={item} />
      </>
    );
    expect(isSala(screen.getByRole("button", { name: "addToList" }))).toBe(false);
    expect(isSala(screen.getByRole("button", { name: "recommend" }))).toBe(false);
  });

  it("denunciar: SalaButton discreto con su bandera; abre el mismo formulario y Escape devuelve el foco", async () => {
    render(<ReportButton targetType="media" targetId="movie_550" skin="sala" />);
    const trigger = screen.getByRole("button", { name: "label" });
    expect(isSala(trigger)).toBe(true);
    expect(trigger.className).toContain("text-sala-ink");
    expect(trigger.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await act(async () => fireEvent.click(trigger));
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const form = screen.getByRole("form", { name: "prompt" });
    expect(within(form).getAllByRole("radio")[0]).toHaveFocus();
    await act(async () => fireEvent.keyDown(form, { key: "Escape" }));
    expect(screen.queryByRole("form")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("denunciar con variant=icon ignora la piel (la bandera de 44 px de los mensajes)", () => {
    render(<ReportButton targetType="message" targetId="m1" variant="icon" skin="sala" />);
    expect(isSala(screen.getByRole("button"))).toBe(false);
  });

  it("compartir la nota: SalaButton y, sin hoja nativa, el menú también de «Sala»", async () => {
    h.shareNative.mockResolvedValue("unavailable");
    render(<ShareRatingButton path="/es/u/ana/r/movie/550?s=x" title="Fight Club" rating="9/10" skin="sala" />);
    const toggle = screen.getByRole("button", { name: "action" });
    expect(isSala(toggle)).toBe(true);
    await act(async () => fireEvent.click(toggle));
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    for (const name of ["copy", "onX", "onWhatsApp"]) {
      expect(isSala(screen.getByRole("button", { name }))).toBe(true);
    }
    expect(screen.getByRole("status").className).toContain("text-sala-ink");
  });

  it("añadir la franquicia: SalaButton que carga, con la pista en la tinta de la obra", () => {
    render(<AddFranchiseButton items={[{ mediaId: "a", title: "A" }, { mediaId: "b", title: "B" }]} skin="sala" />);
    const btn = screen.getByRole("button", { name: "action" });
    expect(isSala(btn)).toBe(true);
    expect(btn).toHaveAttribute("aria-describedby", "franchise-hint");
    expect(document.getElementById("franchise-hint")!.className).toContain("text-sala-ink-secondary");
  });

  it("el SalaButton llega por next/dynamic: la ficha de hoy no lo descarga", () => {
    const lazy = readFileSync("src/components/sala/SalaButtonLazy.tsx", "utf8");
    expect(lazy).toContain('import("./SalaButton")');
    for (const f of [
      "src/components/social/AddToListButton.tsx",
      "src/components/social/RecommendButton.tsx",
      "src/components/social/ReportButton.tsx",
      "src/components/media/ShareRatingButton.tsx",
      "src/components/media/AddFranchiseButton.tsx",
    ]) {
      const src = readFileSync(f, "utf8");
      expect(src).toContain("@/components/sala/SalaButtonLazy");
      expect(src).not.toMatch(/from ['"]@\/components\/sala\/SalaButton['"]/);
    }
  });
});

describe("F2c: «También existe como…» con sala", () => {
  const VIEW: AdaptationView = {
    cards: [
      { mediaId: "book_OL1W", type: "book", externalId: "OL1W", title: "Dune", year: 1965, relation: "source", inLibrary: false },
      { mediaId: "movie_841", type: "movie", externalId: "841", title: "Dune (1984)", relation: "sibling", inLibrary: true },
    ],
    addable: [
      { mediaId: "book_OL1W", title: "Dune" },
      { mediaId: "anime_1", title: "Otra" },
    ],
  };
  const ITEM = { id: "movie_438631", type: "movie" as const, externalId: "438631", title: "Dune" };

  beforeEach(() => {
    h.getAdaptations.mockReset().mockResolvedValue({ links: [{ mediaId: "book_OL1W" }], source: "table" });
    h.buildAdaptationView.mockReset().mockResolvedValue(VIEW);
  });

  it("tarjetas de «Sala» con el formato en palabras, la relación y la cita de Wikidata", async () => {
    const el = await AdaptationsSection({ item: ITEM, locale: "es", userId: null, supabase: null, sala: true });
    render(el!);
    const section = screen.getByRole("region", { name: "title" });
    expect(section).toHaveAttribute("data-sala-ficha-adaptations");
    const list = within(section).getByRole("list", { name: "title" });
    expect(list).toHaveAttribute("data-sala-list", "row");
    const cards = within(list).getAllByRole("listitem");
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByRole("heading", { level: 3, name: "Dune" })).toBeInTheDocument();
    expect(within(cards[0]).getByRole("link", { name: "Dune" })).toHaveAttribute("href", "/es/media/book/OL1W");
    expect(within(cards[0]).getByText("book")).toBeInTheDocument();
    expect(within(cards[0]).getByText("relation.source")).toBeInTheDocument();
    expect(within(cards[1]).getByText("relation.sibling · inLibrary")).toBeInTheDocument();
    // Sin sesión: entrar para añadir la franquicia, de vuelta aquí.
    const login = within(section).getByRole("link", { name: "loginToAdd" });
    expect(login.getAttribute("href")).toContain("mode=login");
    expect(login).toHaveAttribute("rel", "nofollow");
    const wikidata = within(section).getByRole("link", { name: /^Wikidata\s*newTab$/ });
    expect(wikidata).toHaveAttribute("href", "https://www.wikidata.org/");
    expect(wikidata).toHaveAttribute("target", "_blank");
  });

  it("con sesión: «Añadir toda la franquicia» de «Sala»", async () => {
    const el = await AdaptationsSection({ item: ITEM, locale: "es", userId: "u1", supabase: null, sala: true });
    render(el!);
    expect(isSala(screen.getByRole("button", { name: "action" }))).toBe(true);
  });

  it("la fila de «Dónde ver» enseña entero lo que tiene el foco, sin mover la página en vertical", async () => {
    const { SalaScrollRow } = await import("@/components/media/sala/SalaScrollRow");
    const spy = vi.fn();
    Element.prototype.scrollIntoView = spy;
    render(
      <SalaScrollRow data-testid="row">
        <a href="https://example.com">Uno</a>
      </SalaScrollRow>
    );
    act(() => screen.getByRole("link", { name: "Uno" }).focus());
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ block: "nearest", inline: "nearest" }));
    spy.mockClear();
    // La fila misma (cuando es foco) no se mueve sola.
    screen.getByTestId("row").setAttribute("tabindex", "0");
    act(() => screen.getByTestId("row").focus());
    expect(spy).not.toHaveBeenCalled();
  });

  it("sin sala, la sección de hoy", async () => {
    const el = await AdaptationsSection({ item: ITEM, locale: "es", userId: null, supabase: null });
    render(el!);
    expect(screen.getByRole("region", { name: "title" })).not.toHaveAttribute("data-sala-ficha-adaptations");
  });
});
