/**
 * Álbum de cromos (DISENO.md): componentes de `src/components/album`, las
 * cifras con formato del idioma y la card de catálogo re-vestida.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import es from "../../../messages/es.json";
import en from "../../../messages/en.json";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (props: Record<string, unknown>) => <img src={String(props.src)} alt={String(props.alt)} />,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>();
  return {
    ...actual,
    useLocale: () => "es",
    useTranslations: (namespace: string) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      actual.createTranslator({ locale: "es", messages: es as any, namespace: namespace as any }),
  };
});

import { Cromo, Slot, ProgressStrip, FormatTag, StatusBand, Foil, AlbumPage, NumberBadge, albumLabels } from "@/components/album";
import { MediaCard } from "@/components/media/MediaCard";
import { formatCount, formatScore, formatSince } from "@/lib/design/format";
import { albumShapeFor, cromoPlaceholder, isFoil, FORMATS } from "@/lib/design/album";
import { createTranslator } from "next-intl";

describe("cifras y fechas con el formato del idioma", () => {
  it("la nota lleva coma decimal en español y punto en inglés", () => {
    expect(formatScore(8.5, "es")).toBe("8,5");
    expect(formatScore(7, "es")).toBe("7,0");
    expect(formatScore(8.5, "en")).toBe("8.5");
  });

  it("los recuentos llevan separador de miles", () => {
    expect(formatCount(12345, "es")).toBe("12.345");
    expect(formatCount(12345, "en")).toBe("12,345");
  });

  it("«hace N días» con Intl.RelativeTimeFormat", () => {
    const now = new Date(2026, 10, 3, 12).getTime();
    expect(formatSince(new Date(2026, 10, 3, 8), "es", now)).toBe("hoy");
    expect(formatSince(new Date(2026, 10, 2, 23), "es", now)).toBe("ayer");
    expect(formatSince(new Date(2026, 9, 31, 9), "es", now)).toBe("hace 3 días");
    expect(formatSince(new Date(2026, 9, 31, 9), "en", now)).toBe("3 days ago");
    expect(formatSince(new Date(2026, 9, 13), "es", now)).toBe("hace 3 semanas");
    expect(formatSince(new Date(2026, 11, 3), "es", now)).toBe("hoy");
  });
});

describe("gramática del álbum", () => {
  it("estado de biblioteca → forma", () => {
    expect(albumShapeFor("pending")).toBe("slot");
    expect(albumShapeFor("in_progress")).toBe("placed");
    expect(albumShapeFor("completed")).toBe("pasted");
    expect(albumShapeFor("abandoned")).toBe("folded");
    expect(isFoil(10)).toBe(true);
    expect(isFoil(9.5)).toBe(false);
    expect(isFoil(5, 5)).toBe(true);
  });

  it("el respaldo es un degradado de un solo matiz y nunca violeta", () => {
    for (const seed of ["movie_550", "anime_1", "x", "book_OL1M", "a", "bb", "ccc", "dddd", "eeeee"]) {
      const g = cromoPlaceholder(seed);
      const hues = Array.from(g.matchAll(/oklch\([^)]* ([\d.]+)\)/g), (m) => Number(m[1]));
      expect(hues).toHaveLength(2);
      expect(hues[0]).toBe(hues[1]);
      expect(hues[0] > 270 && hues[0] < 330).toBe(false);
    }
  });

  it("los textos del álbum existen en los dos idiomas", () => {
    for (const messages of [es, en]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const t = createTranslator({ locale: "es", messages: messages as any, namespace: "album" as any });
      const labels = albumLabels(t as unknown as Parameters<typeof albumLabels>[0]);
      for (const f of FORMATS) expect(labels.format(f)).not.toMatch(/^album\./);
      expect(labels.status("abandoned")).toBeTruthy();
      expect(labels.slot(12)).toMatch(/12/);
      expect(labels.missing(3)).toMatch(/3/);
    }
  });
});

describe("Cromo", () => {
  it("borde blanco de 3 px, radio 4 px y el respaldo primero", () => {
    const { container } = render(<Cromo title="Dune" seed="movie_1" poster="https://x/p.jpg" sizes="100px" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toMatch(/\bcromo\b/);
    expect(el.className).toContain("rounded-cromo");
    expect(el.className).toContain("border-[3px]");
    expect(el.dataset.state).toBe("pasted");
    const ph = el.querySelector("[data-placeholder]")!;
    expect(ph.compareDocumentPosition(el.querySelector("img")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("en curso: tira de progreso al pie, en el color del formato, con texto para el lector", () => {
    const { container } = render(
      <Cromo title="Frieren" state="placed" format="anime" progress={0.4} progressLabel="Episodio 4 de 10" sizes="100px" />
    );
    const strip = container.querySelector("[data-progress-strip]")!;
    const fill = strip.querySelector("[aria-hidden] > span") as HTMLElement;
    expect(fill.style.transform).toBe("scaleX(0.4)");
    expect(fill.style.backgroundColor).toBe("var(--format-anime)");
    expect(screen.getByText("Episodio 4 de 10")).toHaveClass("sr-only");
  });

  it("abandonado: esquina doblada y legible (sin opacidad)", () => {
    const { container } = render(<Cromo title="Lost" state="folded" stateLabel="Abandonado" sizes="100px" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("cromo-folded");
    expect(el.className).not.toMatch(/opacity-/);
    expect(el.querySelector("[data-fold]")).not.toBeNull();
    expect(screen.getByText("Abandonado")).toHaveClass("sr-only");
  });

  it("10/10: brillo; `still` no levanta la esquina; `paste` reproduce el pegado", () => {
    const { container } = render(<Cromo title="Akira" foil still paste="in" sizes="100px" />);
    const cls = (container.firstElementChild as HTMLElement).className;
    expect(cls).toContain("cromo-foil");
    expect(cls).toContain("cromo-static");
    expect(cls).toContain("animate-paste");
  });
});

describe("Slot, banda, formato, número y página", () => {
  it("hueco vacío: contorno discontinuo, número y título impreso", () => {
    const { container } = render(<Slot number={12} title="Dune" format="movie" formatLabel="Película" label="Hueco 12, te falta:" />);
    const box = container.querySelector("[data-slot] > div")!;
    expect(box.className).toContain("border-dashed");
    expect(box.className).toContain("border-slot-line");
    expect(screen.getByText("12")).toHaveClass("font-display");
    expect(screen.getByText("Dune")).toBeInTheDocument();
    expect(screen.getByText("Película")).toHaveClass("sr-only");
    expect(container.querySelector('[data-tab="movie"]')).not.toBeNull();
  });

  it("con cromo: el hueco se llena y desaparecen el número y el contorno", () => {
    const { container } = render(
      <Slot number={3} title="Dune">
        <Cromo title="Dune" sizes="100px" />
      </Slot>
    );
    expect(container.querySelector("[data-slot]")).toHaveAttribute("data-filled");
    expect(container.querySelector(".border-dashed")).toBeNull();
    expect(screen.queryByText("3")).toBeNull();
  });

  it("banda de estado: estado + «hace 3 días» en <time>", () => {
    const now = new Date(2026, 10, 3, 12).getTime();
    const touched = new Date(2026, 9, 31, 9);
    render(<StatusBand status="in_progress" label="En curso" touchedAt={touched} locale="es" now={now} />);
    const time = screen.getByText("hace 3 días");
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("dateTime", touched.toISOString());
    expect(screen.getByText("En curso")).toBeInTheDocument();
  });

  it("formato: punto de color + nombre, siempre juntos", () => {
    const { container } = render(<FormatTag format="game" label="Videojuego" />);
    expect(screen.getByText("Videojuego")).toBeInTheDocument();
    const dot = container.querySelector("[aria-hidden]") as HTMLElement;
    expect(dot.style.backgroundColor).toBe("var(--format-game)");
  });

  it("número en su caja, en Lilita (font-numeral), con texto para el lector", () => {
    render(<NumberBadge n={1} tone="yellow" size="xl" label="Puesto 1" />);
    const box = screen.getByText("Puesto 1").parentElement!;
    expect(box.className).toContain("font-numeral");
    expect(box.className).toContain("rounded-cromo");
    expect(box.className).toContain("bg-album-yellow");
  });

  it("brillo: envoltorio que se puede apagar", () => {
    const { container, rerender } = render(<Foil>x</Foil>);
    expect(container.firstElementChild!.className).toContain("cromo-foil");
    rerender(<Foil active={false}>x</Foil>);
    expect(container.firstElementChild!.className).not.toContain("cromo-foil");
  });

  it("página impresa: aplica theme-paper y pinta el pliego con lomo", () => {
    const { container } = render(<AlbumPage tone="cyan" left={<p>Lo mejor de 2025</p>} right={<p>Te faltan</p>} />);
    const page = container.firstElementChild as HTMLElement;
    expect(page.className).toContain("theme-paper");
    expect(page.className).toContain("paper-cyan");
    expect(page.querySelector(".page-grid [data-spread]")).not.toBeNull();
  });

  it("la barra de progreso recorta valores fuera de 0..1", () => {
    const { container } = render(<ProgressStrip value={3} />);
    expect((container.querySelector("[aria-hidden] > span") as HTMLElement).style.transform).toBe("scaleX(1)");
  });
});

describe("MediaCard (WIG): la nota con el formato del idioma", () => {
  const item = { id: "movie_550", externalId: "550", type: "movie" as const, title: "Fight Club", year: 1999, rating: 7.5 };

  // Regresión: `toFixed(1)` pintaba «7.5» en español y el lector leía
  // «estrella negra 7.5».
  it("pinta «7,5» y el lector oye «Nota 7,5», no la estrella", () => {
    const { container } = render(<MediaCard item={item} />);
    expect(container.textContent).toContain("7,5");
    expect(container.textContent).not.toContain("7.5");
    expect(screen.getByText("Nota 7,5")).toHaveClass("sr-only");
    expect(container.textContent).not.toContain("★");
  });

  it("el formato va como etiqueta (punto + nombre) bajo el título, no encima de la portada", () => {
    const { container } = render(<MediaCard item={item} showType />);
    const tag = screen.getByTestId("media-type-badge");
    expect(tag).toHaveTextContent("Película");
    expect(container.querySelector("[data-cromo]")!.contains(tag)).toBe(false);
  });
});
