import { createRef, type ComponentProps } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SalaWorkCard, SalaWorkCardSkeleton, type SalaWorkCardProps } from "@/components/sala/SalaWorkCard";

vi.mock("next/image", () => ({
  default: ({ fill, priority, loader, ...rest }: ComponentProps<"img"> & { fill?: boolean; priority?: boolean; loader?: unknown }) => {
    void fill;
    void loader;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- doble de pruebas; `alt` va en `rest`
    return <img data-priority={String(Boolean(priority))} {...rest} />;
  },
}));

// El enlace interno es el de next-intl: aquí, un <a> marcado para reconocerlo.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: ComponentProps<"a">) => (
    <a href={href} data-i18n-link="" {...rest}>
      {children}
    </a>
  ),
}));

const OBRA: SalaWorkCardProps = {
  href: "/media/movie/496243",
  title: "Parásitos",
  originalTitle: { text: "기생충", lang: "ko" },
  format: "movie",
  formatLabel: "Película",
  year: 2019,
  poster: "https://image.tmdb.org/t/p/original/parasitos.jpg",
};

describe("SalaWorkCard", () => {
  describe("enlace", () => {
    it("un solo enlace, con el enlace con idioma del repo, y su nombre es el título y nada más", () => {
      render(<SalaWorkCard {...OBRA} detail="Tu nota: 9" />);
      const enlaces = screen.getAllByRole("link");
      expect(enlaces).toHaveLength(1);
      expect(enlaces[0]).toHaveAccessibleName("Parásitos");
      expect(enlaces[0]).toHaveAttribute("href", "/media/movie/496243");
      expect(enlaces[0]).toHaveAttribute("data-i18n-link");
    });

    it("cubre la tarjeta entera con un pseudoelemento y la caja es su referencia", () => {
      const { container } = render(<SalaWorkCard {...OBRA} />);
      expect(screen.getByRole("link").className).toContain("after:absolute after:inset-0");
      expect(container.firstElementChild!.className).toMatch(/(^|\s)relative(\s|$)/);
    });

    it("el foco rodea la tarjeta (en ::after) y el puntero marca el título", () => {
      render(<SalaWorkCard {...OBRA} />);
      const { className } = screen.getByRole("link");
      expect(className).toContain("sala-focused:after:sala-focus");
      expect(className).toContain("[&>span]:sala-hover:bg-sala-ink");
      expect(className).toContain("[&>span]:sala-pressed:bg-sala-ink-secondary");
      // Los estados van con las variantes de «Sala», no con las de Tailwind.
      expect(className).not.toMatch(/(^|\s|:)(hover|active|focus-visible):/);
    });

    it("el póster es adorno: ninguna imagen con nombre", () => {
      const { container } = render(<SalaWorkCard {...OBRA} />);
      expect(container.querySelector("img")).toHaveAttribute("alt", "");
      expect(screen.queryByRole("img")).toBeNull();
    });

    it("una dirección que no es una ruta de la app es un <a> a secas", () => {
      render(<SalaWorkCard {...OBRA} href="https://example.org/obra" />);
      expect(screen.getByRole("link")).not.toHaveAttribute("data-i18n-link");
    });

    it("ref y props nativas llegan al enlace; className, a la caja", () => {
      const ref = createRef<HTMLAnchorElement>();
      const onClick = vi.fn((event: React.MouseEvent) => event.preventDefault());
      const { container } = render(
        <SalaWorkCard {...OBRA} ref={ref} className="col-span-2" aria-current="page" data-sala-force="hover" onClick={onClick} />
      );
      const enlace = screen.getByRole("link");
      expect(ref.current).toBe(enlace);
      expect(enlace).toHaveAttribute("aria-current", "page");
      expect(enlace).toHaveAttribute("data-sala-force", "hover");
      expect(enlace.className).not.toContain("col-span-2");
      expect(container.firstElementChild!.className).toContain("col-span-2");
      fireEvent.click(enlace);
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("acción secundaria", () => {
    it("va fuera del enlace y después de él", () => {
      render(<SalaWorkCard {...OBRA} action={<button type="button">Guardar Parásitos</button>} />);
      const boton = screen.getByRole("button", { name: "Guardar Parásitos" });
      const enlace = screen.getByRole("link");
      expect(boton.closest("a")).toBeNull();
      expect(enlace.querySelector("button")).toBeNull();
      expect(enlace.compareDocumentPosition(boton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("sin acción no deja un hueco para ella", () => {
      const { container } = render(<SalaWorkCard {...OBRA} />);
      expect(container.querySelector("[data-sala-card-action]")).toBeNull();
    });
  });

  describe("título", () => {
    it("es un h3 por defecto, y el nivel se elige", () => {
      const { rerender } = render(<SalaWorkCard {...OBRA} />);
      expect(screen.getByRole("heading", { level: 3, name: "Parásitos" })).toBeInTheDocument();
      rerender(<SalaWorkCard {...OBRA} headingLevel={2} />);
      expect(screen.getByRole("heading", { level: 2, name: "Parásitos" })).toBeInTheDocument();
    });

    it('headingLevel="none" lo deja en un párrafo', () => {
      render(<SalaWorkCard {...OBRA} headingLevel="none" />);
      expect(screen.queryByRole("heading")).toBeNull();
      expect(screen.getByRole("link").parentElement!.tagName).toBe("P");
    });

    it("el título lleva su idioma, dentro del enlace", () => {
      render(<SalaWorkCard {...OBRA} title="千と千尋の神隠し" titleLang="ja" originalTitle={undefined} />);
      const enlace = screen.getByRole("link", { name: "千と千尋の神隠し" });
      expect(within(enlace).getByText("千と千尋の神隠し")).toHaveAttribute("lang", "ja");
    });

    it("el título original va fuera del enlace, marcado con su idioma", () => {
      render(<SalaWorkCard {...OBRA} />);
      const original = screen.getByText("기생충");
      expect(original).toHaveAttribute("lang", "ko");
      expect(original.closest("a")).toBeNull();
    });

    it("se corta a 3 líneas en la rejilla y a 2 en fila y compacta, y el título entero queda en title", () => {
      const { rerender } = render(<SalaWorkCard {...OBRA} />);
      expect(screen.getByRole("heading").className).toContain("line-clamp-3");
      expect(screen.getByRole("link")).toHaveAttribute("title", "Parásitos");
      rerender(<SalaWorkCard {...OBRA} variant="row" />);
      expect(screen.getByRole("heading").className).toContain("line-clamp-2");
      rerender(<SalaWorkCard {...OBRA} variant="compact" />);
      expect(screen.getByRole("heading").className).toContain("line-clamp-2");
    });

    it('clamp="none" no corta ni pone title', () => {
      render(<SalaWorkCard {...OBRA} clamp="none" />);
      expect(screen.getByRole("heading").className).not.toContain("line-clamp");
      expect(screen.getByRole("link")).not.toHaveAttribute("title");
    });

    it("una palabra más larga que la tarjeta se parte", () => {
      render(<SalaWorkCard {...OBRA} />);
      expect(screen.getByText("Parásitos", { selector: "a > span" }).className).toContain("[overflow-wrap:anywhere]");
    });
  });

  describe("datos", () => {
    it("el formato va con palabras, y el año y el detalle a la vista, fuera del enlace", () => {
      render(<SalaWorkCard {...OBRA} detail="Tu nota: 9" />);
      for (const texto of ["Película", "2019", "Tu nota: 9"]) {
        const dato = screen.getByText(texto);
        expect(dato).toBeInTheDocument();
        expect(dato.closest("a")).toBeNull();
      }
    });

    it("formato y año van separados por un espacio de verdad (no se leen pegados)", () => {
      render(<SalaWorkCard {...OBRA} />);
      expect(screen.getByText("Película").parentElement!.textContent).toBe("Película 2019");
    });

    it("sin año no deja nada en su sitio", () => {
      render(<SalaWorkCard {...OBRA} year={undefined} />);
      expect(screen.getByText("Película").parentElement!.textContent).toBe("Película");
    });
  });

  describe("póster", () => {
    it("toma la proporción del formato y ratio la fija", () => {
      const { container, rerender } = render(<SalaWorkCard {...OBRA} format="game" formatLabel="Videojuego" />);
      expect(container.querySelector("[data-sala-poster]")!.className).toContain("aspect-video");
      rerender(<SalaWorkCard {...OBRA} format="game" formatLabel="Videojuego" ratio="2/3" />);
      expect(container.querySelector("[data-sala-poster]")!.className).toContain("aspect-[2/3]");
    });

    it("sin portada: el campo de color con el título (rejilla) o solo el campo (fila y compacta)", () => {
      const { container, rerender } = render(<SalaWorkCard {...OBRA} poster={null} />);
      expect(container.querySelector("img")).toBeNull();
      expect(container.querySelector("[data-sala-poster-title]")).toHaveTextContent("Parásitos");
      rerender(<SalaWorkCard {...OBRA} poster={null} variant="row" />);
      expect(container.querySelector("[data-sala-poster-title]")).toBeNull();
      expect(container.querySelector("[data-sala-poster]")).toHaveAttribute("data-sala-poster", "empty");
    });

    it("si la portada falla, queda el sustituto y avisa", () => {
      const onPosterError = vi.fn();
      const { container } = render(<SalaWorkCard {...OBRA} onPosterError={onPosterError} />);
      fireEvent.error(container.querySelector("img")!);
      expect(container.querySelector("img")).toBeNull();
      expect(container.querySelector("[data-sala-poster]")).toHaveAttribute("data-sala-poster", "error");
      expect(onPosterError).toHaveBeenCalledTimes(1);
      // El enlace sigue igual.
      expect(screen.getByRole("link")).toHaveAccessibleName("Parásitos");
    });

    it("sizes: uno por defecto según la variante, y el que se pase", () => {
      const { container, rerender } = render(<SalaWorkCard {...OBRA} variant="compact" />);
      expect(container.querySelector("img")).toHaveAttribute("sizes", "40px");
      rerender(<SalaWorkCard {...OBRA} variant="row" />);
      expect(container.querySelector("img")).toHaveAttribute("sizes", "(min-width: 640px) 80px, 64px");
      rerender(<SalaWorkCard {...OBRA} sizes="160px" />);
      expect(container.querySelector("img")).toHaveAttribute("sizes", "160px");
    });

    it("priority llega a la imagen", () => {
      const { container, rerender } = render(<SalaWorkCard {...OBRA} />);
      expect(container.querySelector("img")).toHaveAttribute("data-priority", "false");
      rerender(<SalaWorkCard {...OBRA} priority />);
      expect(container.querySelector("img")).toHaveAttribute("data-priority", "true");
    });
  });

  describe("variantes", () => {
    it.each(["grid", "row", "compact"] as const)("%s: se marca en la caja", (variant) => {
      const { container } = render(<SalaWorkCard {...OBRA} variant={variant} />);
      expect(container.firstElementChild).toHaveAttribute("data-sala-card", variant);
    });

    it("compacta: 48 px de alto como poco", () => {
      const { container } = render(<SalaWorkCard {...OBRA} variant="compact" />);
      expect(container.firstElementChild!.className).toContain("min-h-sala-target");
    });
  });
});

describe("SalaWorkCardSkeleton", () => {
  it("es adorno, no lleva enlaces ni texto y se para solo", () => {
    const { container } = render(<SalaWorkCardSkeleton />);
    const caja = container.firstElementChild!;
    expect(caja).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("link")).toBeNull();
    expect(caja.textContent!.trim()).toBe("");
    // La animación de la espera: tres vueltas y se queda quieta; sin ella con movimiento reducido.
    expect(caja.className).toContain("animate-sala-wait");
    expect(caja.className).toContain("motion-reduce:animate-none");
  });

  it.each([
    ["2/3", "aspect-[2/3]"],
    ["16/9", "aspect-video"],
  ] as const)("reserva el póster a %s", (ratio, clase) => {
    const { container } = render(<SalaWorkCardSkeleton ratio={ratio} />);
    expect(container.querySelector(`.${CSS.escape(clase)}`)).not.toBeNull();
  });

  it("tiene la forma de su variante", () => {
    const { container } = render(<SalaWorkCardSkeleton variant="compact" className="mt-2" />);
    const caja = container.firstElementChild!;
    expect(caja).toHaveAttribute("data-sala-card-skeleton", "compact");
    expect(caja.className).toContain("min-h-sala-target");
    expect(caja.className).toContain("mt-2");
  });
});
