import { createRef, type ComponentProps } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pieceSize, SALA_POSTER_RATIO, SalaPoster, salaPosterStretch } from "@/components/sala/SalaPoster";
import { IMAGE_MAX_UPSCALE } from "@/lib/design/image-fit";
import { NEUTRAL_PALETTE } from "@/lib/design/image-palette";
import { posterLoader } from "@/lib/images/poster-url";

// `next/image` como un <img> a secas que deja ver lo que recibe.
vi.mock("next/image", () => ({
  default: ({
    fill,
    priority,
    loader,
    ...rest
  }: ComponentProps<"img"> & { fill?: boolean; priority?: boolean; loader?: unknown }) => (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- doble de pruebas; `alt` va en `rest`
    <img data-fill={String(Boolean(fill))} data-priority={String(Boolean(priority))} data-loader={loader === posterLoader ? "poster" : "otro"} {...rest} />
  ),
}));

const SRC = "https://image.tmdb.org/t/p/original/parasitos.jpg";

/** La imagen termina de cargar con este tamaño natural. */
function cargar(imagen: HTMLElement, ancho: number, alto: number) {
  Object.defineProperty(imagen, "naturalWidth", { value: ancho, configurable: true });
  Object.defineProperty(imagen, "naturalHeight", { value: alto, configurable: true });
  fireEvent.load(imagen);
}

/** La caja mide esto en pantalla (jsdom no maqueta). */
function conCaja(ancho: number, alto: number) {
  return vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: ancho,
    height: alto,
    top: 0,
    left: 0,
    right: ancho,
    bottom: alto,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

afterEach(() => vi.restoreAllMocks());

describe("SalaPoster", () => {
  describe("texto alternativo", () => {
    it("con el título al lado, la imagen es adorno: alt vacío y la caja sin papel", () => {
      const { container } = render(<SalaPoster src={SRC} alt="" title="Parásitos" sizes="160px" />);
      const imagen = container.querySelector("img")!;
      expect(imagen).toHaveAttribute("alt", "");
      expect(screen.queryByRole("img")).toBeNull();
      expect(container.firstElementChild).not.toHaveAttribute("role");
    });

    it("sola, la nombra su alt, una sola vez", () => {
      render(<SalaPoster src={SRC} alt="Cartel de Parásitos" title="Parásitos" sizes="160px" />);
      const imagenes = screen.getAllByRole("img", { name: "Cartel de Parásitos" });
      expect(imagenes).toHaveLength(1);
      expect(imagenes[0].tagName).toBe("IMG");
    });
  });

  describe("sustituto", () => {
    it("sin imagen: el campo de color con el título como rótulo de adorno, y ningún <img>", () => {
      const { container } = render(<SalaPoster alt="" title="Berserk" sizes="160px" />);
      expect(container.querySelector("img")).toBeNull();
      const caja = container.firstElementChild!;
      expect(caja).toHaveAttribute("data-sala-poster", "empty");
      expect(caja.className).toContain("bg-sala-band");
      const rotulo = screen.getByText("Berserk");
      expect(rotulo.parentElement).toHaveAttribute("aria-hidden", "true");
      expect(rotulo.className).toContain("sala-type-title");
    });

    it.each([null, undefined, ""])("src=%j vale por «sin imagen»", (src) => {
      const { container } = render(<SalaPoster src={src} alt="" title="Berserk" sizes="160px" />);
      expect(container.querySelector("img")).toBeNull();
    });

    it("sin imagen y con alt: el nombre lo lleva la caja", () => {
      render(<SalaPoster alt="Cartel de Berserk" title="Berserk" sizes="160px" />);
      expect(screen.getByRole("img", { name: "Cartel de Berserk" }).tagName).toBe("DIV");
    });

    it("mientras la imagen llega, el rótulo ya está detrás; al cargar, se retira", () => {
      const { container } = render(<SalaPoster src={SRC} alt="" title="Parásitos" sizes="160px" />);
      expect(container.firstElementChild).toHaveAttribute("data-sala-poster", "loading");
      expect(screen.getByText("Parásitos")).toBeInTheDocument();
      // Primero en el DOM: la imagen se pinta encima.
      expect(container.firstElementChild!.firstElementChild).toHaveAttribute("data-sala-poster-title");
      cargar(container.querySelector("img")!, 480, 720);
      expect(container.firstElementChild).toHaveAttribute("data-sala-poster", "loaded");
      expect(screen.queryByText("Parásitos")).toBeNull();
    });

    it("si la imagen falla: se quita, queda el sustituto y avisa una vez", () => {
      const onLoadError = vi.fn();
      const { container } = render(<SalaPoster src={SRC} alt="" title="Parásitos" sizes="160px" onLoadError={onLoadError} />);
      fireEvent.error(container.querySelector("img")!);
      expect(container.querySelector("img")).toBeNull();
      expect(container.firstElementChild).toHaveAttribute("data-sala-poster", "error");
      expect(screen.getByText("Parásitos")).toBeInTheDocument();
      expect(onLoadError).toHaveBeenCalledTimes(1);
    });

    it("si falla y lleva alt, el nombre pasa a la caja", () => {
      const { container } = render(<SalaPoster src={SRC} alt="Cartel de Parásitos" title="Parásitos" sizes="160px" />);
      fireEvent.error(container.querySelector("img")!);
      expect(screen.getByRole("img", { name: "Cartel de Parásitos" }).tagName).toBe("DIV");
    });

    it("otra imagen después de un fallo vuelve a intentarlo", () => {
      const { container, rerender } = render(<SalaPoster src={SRC} alt="" title="Parásitos" sizes="160px" />);
      fireEvent.error(container.querySelector("img")!);
      rerender(<SalaPoster src="https://image.tmdb.org/t/p/original/otra.jpg" alt="" title="Parásitos" sizes="160px" />);
      expect(container.querySelector("img")).toHaveAttribute("src", "https://image.tmdb.org/t/p/original/otra.jpg");
      expect(container.firstElementChild).toHaveAttribute("data-sala-poster", "loading");
    });

    it("fallback=plain: solo el campo de color (miniaturas)", () => {
      const { container } = render(<SalaPoster alt="" title="Berserk" sizes="40px" fallback="plain" />);
      expect(screen.queryByText("Berserk")).toBeNull();
      expect(container.firstElementChild!.className).toContain("bg-sala-band");
    });

    it("el rótulo lleva el idioma del título", () => {
      render(<SalaPoster alt="" title="千と千尋の神隠し" titleLang="ja" sizes="160px" />);
      expect(screen.getByText("千と千尋の神隠し")).toHaveAttribute("lang", "ja");
    });

    it("la anchura del rótulo baja con la longitud del título, entre 75 y 110 %", () => {
      expect(salaPosterStretch("Her")).toBe(110);
      expect(salaPosterStretch("Birdman o (la inesperada virtud de la ignorancia)")).toBe(75);
      const medio = salaPosterStretch("El viaje de Chihiro");
      expect(medio).toBeGreaterThan(75);
      expect(medio).toBeLessThan(110);
    });
  });

  describe("proporciones", () => {
    it("cada formato tiene la suya: vertical 2:3 salvo el videojuego, apaisado", () => {
      expect(SALA_POSTER_RATIO).toEqual({
        movie: "2/3",
        tv: "2/3",
        anime: "2/3",
        book: "2/3",
        comic: "2/3",
        manga: "2/3",
        game: "16/9",
      });
    });

    it.each([
      ["movie", "aspect-[2/3]"],
      ["manga", "aspect-[2/3]"],
      ["game", "aspect-video"],
    ] as const)("format=%s reserva su caja con %s, con imagen o sin ella", (format, clase) => {
      const { container, rerender } = render(<SalaPoster format={format} alt="" title="Obra" sizes="160px" />);
      expect(container.firstElementChild!.className).toContain(clase);
      rerender(<SalaPoster format={format} src={SRC} alt="" title="Obra" sizes="160px" />);
      expect(container.firstElementChild!.className).toContain(clase);
    });

    it("ratio gana al formato, y sin ninguno es 2:3", () => {
      const { container, rerender } = render(<SalaPoster format="game" ratio="2/3" alt="" title="Elden Ring" sizes="160px" />);
      expect(container.firstElementChild!.className).toContain("aspect-[2/3]");
      rerender(<SalaPoster alt="" title="Elden Ring" sizes="160px" />);
      expect(container.firstElementChild!.className).toContain("aspect-[2/3]");
    });
  });

  describe("imagen", () => {
    it("usa el cargador de portadas del repo, llena la caja y pasa sizes", () => {
      const { container } = render(<SalaPoster src={SRC} alt="" title="Parásitos" sizes="(max-width: 640px) 45vw, 20vw" />);
      const imagen = container.querySelector("img")!;
      expect(imagen).toHaveAttribute("data-loader", "poster");
      expect(imagen).toHaveAttribute("data-fill", "true");
      expect(imagen).toHaveAttribute("sizes", "(max-width: 640px) 45vw, 20vw");
      expect(imagen.className).toContain("object-cover");
      expect(imagen).toHaveAttribute("data-priority", "false");
    });

    it("priority la precarga y no admite loading a la vez", () => {
      const { container } = render(<SalaPoster src={SRC} alt="" title="Parásitos" sizes="160px" priority loading="lazy" />);
      const imagen = container.querySelector("img")!;
      expect(imagen).toHaveAttribute("data-priority", "true");
      expect(imagen).not.toHaveAttribute("loading");
    });

    it("loading llega a la imagen", () => {
      const { container } = render(<SalaPoster src={SRC} alt="" title="Parásitos" sizes="160px" loading="eager" />);
      expect(container.querySelector("img")).toHaveAttribute("loading", "eager");
    });

    it("fit=contain enseña la portada entera y focus mueve el recorte", () => {
      const { container, rerender } = render(<SalaPoster src={SRC} alt="" title="Parásitos" sizes="160px" fit="contain" />);
      expect(container.querySelector("img")!.className).toContain("object-contain");
      rerender(<SalaPoster src={SRC} alt="" title="Parásitos" sizes="160px" focus="50% 20%" />);
      expect(container.querySelector("img")!.style.objectPosition).toBe("50% 20%");
    });
  });

  describe("tope de ampliación (biblia §2)", () => {
    it("pieceSize: una imagen que da para la caja no se toca", () => {
      expect(pieceSize({ width: 480, height: 720 }, { width: 320, height: 480 }, 1, "cover")).toBeNull();
      // Justo en el tope también vale.
      expect(pieceSize({ width: 256, height: 384 }, { width: 320, height: 480 }, 1, "cover")).toBeNull();
    });

    it("pieceSize: la que se queda corta va entera, a 1,25 veces su tamaño como mucho, en píxeles físicos", () => {
      expect(pieceSize({ width: 96, height: 144 }, { width: 240, height: 360 }, 1, "cover")).toEqual({ width: 120, height: 180 });
      // En una pantalla de densidad 2 la misma imagen ocupa la mitad de píxeles CSS.
      expect(pieceSize({ width: 96, height: 144 }, { width: 480, height: 720 }, 2, "cover")).toEqual({ width: 60, height: 90 });
    });

    it("pieceSize: una apaisada en una caja vertical cabe entera y no pasa del tope", () => {
      const pieza = pieceSize({ width: 320, height: 180 }, { width: 240, height: 360 }, 1, "cover")!;
      expect(pieza.width).toBeLessThanOrEqual(240);
      expect(pieza.width / 320).toBeLessThanOrEqual(IMAGE_MAX_UPSCALE);
      expect(pieza.width / pieza.height).toBeCloseTo(320 / 180, 1);
    });

    it("pieceSize: con contain solo cuenta que quepa entera; sin medidas, nada", () => {
      expect(pieceSize({ width: 320, height: 180 }, { width: 240, height: 360 }, 1, "contain")).toBeNull();
      expect(pieceSize({ width: 96, height: 144 }, { width: 240, height: 360 }, 1, "contain")).toEqual({ width: 120, height: 180 });
      expect(pieceSize({ width: 0, height: 0 }, { width: 240, height: 360 }, 1, "cover")).toBeNull();
      expect(pieceSize({ width: 96, height: 144 }, { width: 0, height: 0 }, 1, "cover")).toBeNull();
    });

    it("una imagen pequeña se compone como pieza: entera, centrada y a su tamaño", () => {
      conCaja(240, 360);
      const { container } = render(<SalaPoster src={SRC} alt="" title="Berserk" sizes="240px" />);
      act(() => cargar(container.querySelector("img")!, 96, 144));
      const marco = container.querySelector<HTMLElement>("[data-sala-poster-frame]")!;
      expect(marco).toHaveAttribute("data-sala-poster-frame", "piece");
      expect(marco.style.width).toBe("120px");
      expect(marco.style.height).toBe("180px");
      expect(container.querySelector("img")!.className).toContain("object-contain");
    });

    it("una imagen que da para la caja la llena", () => {
      conCaja(240, 360);
      const { container } = render(<SalaPoster src={SRC} alt="" title="Berserk" sizes="240px" />);
      act(() => cargar(container.querySelector("img")!, 720, 1080));
      expect(container.querySelector("[data-sala-poster-frame]")).toHaveAttribute("data-sala-poster-frame", "fill");
      expect(container.querySelector("img")!.className).toContain("object-cover");
    });

    it("capUpscale={false} deja ampliarla", () => {
      conCaja(240, 360);
      const { container } = render(<SalaPoster src={SRC} alt="" title="Berserk" sizes="240px" capUpscale={false} />);
      act(() => cargar(container.querySelector("img")!, 96, 144));
      expect(container.querySelector("[data-sala-poster-frame]")).toHaveAttribute("data-sala-poster-frame", "fill");
    });
  });

  describe("caja", () => {
    it("pasa la ref, className, style y el resto de atributos", () => {
      const ref = createRef<HTMLDivElement>();
      const { container } = render(
        <SalaPoster ref={ref} alt="" title="Berserk" sizes="160px" className="mt-4" style={{ maxWidth: 200 }} data-testid="poster" id="p1" />
      );
      expect(ref.current).toBe(container.firstElementChild);
      expect(ref.current).toHaveAttribute("id", "p1");
      expect(ref.current).toHaveAttribute("data-testid", "poster");
      expect(ref.current!.className).toContain("mt-4");
      expect(ref.current!.style.maxWidth).toBe("200px");
    });

    it("esquinas rectas, sin sombra ni borde", () => {
      const { container } = render(<SalaPoster alt="" title="Berserk" sizes="160px" />);
      expect(container.firstElementChild!.className).not.toMatch(/(^|\s)(rounded|shadow|border)(-|\s|$)/);
    });

    it("con palette, el campo de color es el de la obra", () => {
      const { container } = render(<SalaPoster alt="" title="Berserk" sizes="160px" palette={NEUTRAL_PALETTE} style={{ maxWidth: 200 }} />);
      const caja = container.firstElementChild as HTMLElement;
      expect(caja.className).toContain("sala-work");
      expect(caja.style.getPropertyValue("--sala-work-light-band")).not.toBe("");
      expect(caja.style.maxWidth).toBe("200px");
    });

    it("sin palette no crea un contenedor de obra: hereda el de fuera", () => {
      const { container } = render(<SalaPoster alt="" title="Berserk" sizes="160px" />);
      expect(container.firstElementChild!.className).not.toContain("sala-work");
    });
  });
});
