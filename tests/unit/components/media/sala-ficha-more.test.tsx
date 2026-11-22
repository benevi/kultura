// ============================================================
// Fase 8.5 · F2c: la mitad de abajo de la ficha con «Sala».
// Las acciones de hoy (listas, recomendar, compartir la nota, denunciar) con
// `skin="sala"`: mismo comportamiento, disparador de «Sala». Y la fila de
// «Dónde ver», que enseña entero lo que tiene el foco.
// ============================================================

import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import type { MediaItem } from "@/types/media";

const h = vi.hoisted(() => ({
  shareNative: vi.fn(),
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
// En la app llega por next/dynamic; aquí, directo (el import perezoso se comprueba aparte).
vi.mock("@/components/sala/SalaButtonLazy", async () => ({
  SalaButtonLazy: (await import("@/components/sala/SalaButton")).SalaButton,
}));

import { AddToListButton } from "@/components/social/AddToListButton";
import { RecommendButton } from "@/components/social/RecommendButton";
import { ReportButton } from "@/components/social/ReportButton";
import { ShareRatingButton } from "@/components/media/ShareRatingButton";
import { SalaScrollRow } from "@/components/media/sala/SalaScrollRow";

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


  it("el SalaButton llega por next/dynamic: la ficha de hoy no lo descarga", () => {
    const lazy = readFileSync("src/components/sala/SalaButtonLazy.tsx", "utf8");
    expect(lazy).toContain('import("./SalaButton")');
    for (const f of [
      "src/components/social/AddToListButton.tsx",
      "src/components/social/RecommendButton.tsx",
      "src/components/social/ReportButton.tsx",
      "src/components/media/ShareRatingButton.tsx",
    ]) {
      const src = readFileSync(f, "utf8");
      expect(src).toContain("@/components/sala/SalaButtonLazy");
      expect(src).not.toMatch(/from ['"]@\/components\/sala\/SalaButton['"]/);
    }
  });
});

describe("F2c: la fila de «Dónde ver»", () => {
  it("enseña entero lo que tiene el foco, sin mover la página en vertical", () => {
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
});
