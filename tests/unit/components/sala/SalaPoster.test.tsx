import { createRef, type ComponentProps } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SALA_POSTER_RATIO, SalaPoster } from "@/components/sala/SalaPoster";
import { NEUTRAL_PALETTE } from "@/lib/design/image-palette";
import { forgetMeasuredFiles } from "@/lib/images/file-size";
import { posterLoader } from "@/lib/images/poster-url";

// `next/image` como un <img> a secas que deja ver lo que recibe. Lo que hace
// el `next/image` de verdad (su `srcset`, y lo que el navegador contesta con
// él) se prueba en el navegador: historia «Tope con srcset» de Sala/Póster.
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

/** El estado de la imagen: `loading`, `loaded` o `error`. */
const estado = (container: HTMLElement) => container.querySelector("[data-sala-poster-image]")?.getAttribute("data-sala-poster-image");
const marco = (container: HTMLElement) => container.querySelector<HTMLElement>("[data-sala-poster-frame]")!;

/** La imagen termina de cargar diciendo que mide esto. */
function cargar(imagen: HTMLElement, ancho: number, alto: number) {
  Object.defineProperty(imagen, "naturalWidth", { value: ancho, configurable: true });
  Object.defineProperty(imagen, "naturalHeight", { value: alto, configurable: true });
  fireEvent.load(imagen);
}

/** Deja pasar las promesas pendientes (la medida del archivo). */
const asentar = () => act(async () => {});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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
    it("sin imagen: el título como rótulo de adorno, y ningún <img> ni nada de cliente", () => {
      const { container } = render(<SalaPoster alt="" title="Berserk" sizes="160px" />);
      expect(container.querySelector("img")).toBeNull();
      expect(container.firstElementChild).toHaveAttribute("data-sala-poster", "empty");
      expect(container.querySelector("[data-sala-poster-image]")).toBeNull();
      expect(screen.getByText("Berserk").closest("[aria-hidden]")).toHaveAttribute("aria-hidden", "true");
    });

    it.each([null, undefined, ""])("src=%j vale por «sin imagen»", (src) => {
      const { container } = render(<SalaPoster src={src} alt="" title="Berserk" sizes="160px" />);
      expect(container.querySelector("img")).toBeNull();
    });

    it("sin imagen y con alt: el nombre lo lleva la caja", () => {
      render(<SalaPoster alt="Cartel de Berserk" title="Berserk" sizes="160px" />);
      expect(screen.getByRole("img", { name: "Cartel de Berserk" }).tagName).toBe("DIV");
    });

    it("mientras la imagen llega, el rótulo ya está detrás; al cargar, la imagen lo dice (y el CSS lo esconde)", () => {
      const { container } = render(<SalaPoster src={SRC} alt="" title="Parásitos" sizes="160px" />);
      expect(container.firstElementChild).toHaveAttribute("data-sala-poster", "image");
      expect(estado(container)).toBe("loading");
      expect(screen.getByText("Parásitos")).toBeInTheDocument();
      // Primero en el DOM: la imagen se pinta encima.
      expect(container.firstElementChild!.firstElementChild).toHaveAttribute("data-sala-poster-title");
      cargar(container.querySelector("img")!, 480, 720);
      expect(estado(container)).toBe("loaded");
      // Que deja de pintarse lo mide la historia «Estados», en el navegador.
    });

    it("si la imagen falla: se quita, queda el sustituto y avisa una vez", () => {
      const onLoadError = vi.fn();
      const { container } = render(<SalaPoster src={SRC} alt="" title="Parásitos" sizes="160px" onLoadError={onLoadError} />);
      fireEvent.error(container.querySelector("img")!);
      expect(container.querySelector("img")).toBeNull();
      expect(estado(container)).toBe("error");
      expect(screen.getByText("Parásitos")).toBeInTheDocument();
      expect(screen.queryByRole("img")).toBeNull();
      expect(onLoadError).toHaveBeenCalledTimes(1);
    });

    it("si falla y lleva alt, el nombre no se pierde", () => {
      const { container } = render(<SalaPoster src={SRC} alt="Cartel de Parásitos" title="Parásitos" sizes="160px" />);
      fireEvent.error(container.querySelector("img")!);
      const sustituto = screen.getByRole("img", { name: "Cartel de Parásitos" });
      expect(sustituto.tagName).not.toBe("IMG");
      expect(container.firstElementChild).toContainElement(sustituto);
    });

    it("otra imagen después de un fallo vuelve a intentarlo", () => {
      const { container, rerender } = render(<SalaPoster src={SRC} alt="" title="Parásitos" sizes="160px" />);
      fireEvent.error(container.querySelector("img")!);
      rerender(<SalaPoster src="https://image.tmdb.org/t/p/original/otra.jpg" alt="" title="Parásitos" sizes="160px" />);
      expect(container.querySelector("img")).toHaveAttribute("src", "https://image.tmdb.org/t/p/original/otra.jpg");
      expect(estado(container)).toBe("loading");
    });

    it("otra imagen después de cargar empieza de cero", () => {
      const { container, rerender } = render(<SalaPoster src={SRC} alt="" title="Parásitos" sizes="160px" />);
      cargar(container.querySelector("img")!, 480, 720);
      rerender(<SalaPoster src="https://image.tmdb.org/t/p/original/otra.jpg" alt="" title="Parásitos" sizes="160px" />);
      expect(estado(container)).toBe("loading");
    });

    it("fallback=plain: solo el campo de color (miniaturas)", () => {
      const { container } = render(<SalaPoster alt="" title="Berserk" sizes="40px" fallback="plain" />);
      expect(screen.queryByText("Berserk")).toBeNull();
      expect(container.querySelector("[data-sala-poster-title]")).toBeNull();
    });

    it("el rótulo lleva el idioma del título", () => {
      const { container } = render(<SalaPoster alt="" title="千と千尋の神隠し" titleLang="ja" sizes="160px" />);
      expect(container.querySelector("[data-sala-title-text]")).toHaveAttribute("lang", "ja");
      // Partido sin espacios: también el texto oculto con el título tal cual (nombre accesible).
      for (const el of screen.getAllByText("千と千尋の神隠し")) expect(el).toHaveAttribute("lang", "ja");
    });

    it("el rótulo es el de la ficha, compuesto para una caja pequeña: anchura por longitud y tamaño según la caja", () => {
      const { container } = render(<SalaPoster alt="" title="El viaje de Chihiro" sizes="160px" />);
      const rotulo = container.querySelector<HTMLElement>("[data-sala-title-text]")!;
      // La anchura y el tamaño los pone `planSalaTitle` (lo prueba tests/unit/design/sala-title.test.ts).
      expect(rotulo.style.getPropertyValue("--sala-title-n-stretch")).toMatch(/^\d+%$/);
      expect(Number(rotulo.style.getPropertyValue("--sala-title-n-size"))).toBeGreaterThan(0);
      // No baja de 14 px ni pasa de 48: el suelo y el tope van en `rem`.
      expect(rotulo.style.getPropertyValue("--sala-title-floor")).toBe("0.875rem");
      expect(rotulo.style.getPropertyValue("--sala-title-cap")).toBe("3rem");
      // Su tamaño sale del ancho de su caja, no del de la página.
      expect(rotulo.parentElement!.className).toContain("[container-type:inline-size]");
    });
  });

  describe("proporciones", () => {
    // Que cada caja mide lo que dice su proporción lo miden las historias, en el navegador.
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

    it("ratio gana al formato, y sin ninguno es 2:3", () => {
      const { container, rerender } = render(<SalaPoster format="game" alt="" title="Elden Ring" sizes="160px" />);
      const apaisada = container.firstElementChild!.className;
      rerender(<SalaPoster format="game" ratio="2/3" alt="" title="Elden Ring" sizes="160px" />);
      const vertical = container.firstElementChild!.className;
      expect(vertical).not.toBe(apaisada);
      rerender(<SalaPoster alt="" title="Elden Ring" sizes="160px" />);
      expect(container.firstElementChild!.className).toBe(vertical);
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

  describe("color de la imagen (readPalette, I2b)", () => {
    it("por defecto se pide sin CORS", () => {
      const { container } = render(<SalaPoster src={SRC} alt="" title="Parásitos" sizes="160px" />);
      expect(container.querySelector("img")).not.toHaveAttribute("crossorigin");
    });

    it("con readPalette se pide con CORS; si así falla, otra vez sin él, y solo después se da por rota", () => {
      const onLoadError = vi.fn();
      const { container } = render(
        <div className="sala-work">
          <SalaPoster src={SRC} alt="" title="Parásitos" sizes="160px" readPalette onLoadError={onLoadError} />
        </div>
      );
      expect(container.querySelector("img")).toHaveAttribute("crossorigin", "anonymous");
      fireEvent.error(container.querySelector("img")!);
      const segunda = container.querySelector("img")!;
      expect(segunda).not.toHaveAttribute("crossorigin");
      expect(onLoadError).not.toHaveBeenCalled();
      fireEvent.error(segunda);
      expect(container.querySelector("img")).toBeNull();
      expect(onLoadError).toHaveBeenCalledTimes(1);
    });

    it("un origen que no deja leer la imagen (Google Books) se pide sin CORS", () => {
      const { container } = render(
        <SalaPoster src="https://books.google.com/books/content?id=x" alt="" title="Libro" sizes="160px" readPalette />
      );
      expect(container.querySelector("img")).not.toHaveAttribute("crossorigin");
    });

    it("al cargar, si el lienzo no se puede leer, el contenedor se queda en los neutros", () => {
      const { container } = render(
        <div className="sala-work" data-testid="obra">
          <SalaPoster src={SRC} alt="" title="Parásitos" sizes="160px" readPalette />
        </div>
      );
      fireEvent.load(container.querySelector("img")!);
      const obra = screen.getByTestId("obra");
      expect(obra).not.toHaveAttribute("data-sala-palette");
      expect(estado(container)).toBe("loaded");
    });
  });

  describe("sin tope de ampliación (por defecto)", () => {
    it("la portada llena la caja mida lo que mida, sin medir nada ni observar la caja", () => {
      const observador = vi.fn();
      const sonda = vi.fn();
      vi.stubGlobal("ResizeObserver", observador);
      vi.stubGlobal("Image", sonda);
      const medirCaja = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect");
      const { container } = render(<SalaPoster src={SRC} alt="" title="Berserk" sizes="240px" />);
      const imagen = container.querySelector("img")!;
      imagen.setAttribute("srcset", `${SRC} 256w, ${SRC} 640w`);
      cargar(imagen, 96, 144);
      expect(marco(container)).toHaveAttribute("data-sala-poster-frame", "fill");
      expect(marco(container).style.transform).toBe("");
      expect(imagen.className).toContain("object-cover");
      expect(observador).not.toHaveBeenCalled();
      expect(sonda).not.toHaveBeenCalled();
      expect(medirCaja).not.toHaveBeenCalled();
    });
  });

  describe("con tope de ampliación (capUpscale, biblia §2)", () => {
    /** Los `Image` sueltos con los que se mide el archivo. */
    let sondas: Array<{ src: string; cargar: (ancho: number, alto: number) => void; fallar: () => void }>;
    let observadores: number;
    let cambiarDensidad: (dpr: number) => void;

    /** La caja mide esto en pantalla (jsdom no maqueta). */
    function conCaja(ancho: number, alto: number) {
      return vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: ancho, height: alto } as DOMRect);
    }

    beforeEach(() => {
      sondas = [];
      observadores = 0;
      forgetMeasuredFiles();
      vi.stubGlobal("devicePixelRatio", 1);
      vi.stubGlobal(
        "Image",
        class {
          naturalWidth = 0;
          naturalHeight = 0;
          onload: (() => void) | null = null;
          onerror: (() => void) | null = null;
          set src(valor: string) {
            sondas.push({
              src: valor,
              cargar: (ancho, alto) => {
                this.naturalWidth = ancho;
                this.naturalHeight = alto;
                this.onload?.();
              },
              fallar: () => this.onerror?.(),
            });
          }
        }
      );
      vi.stubGlobal(
        "ResizeObserver",
        class {
          constructor() {
            observadores++;
          }
          observe() {}
          unobserve() {}
          disconnect() {}
        }
      );
      const escuchas = new Set<() => void>();
      vi.stubGlobal("matchMedia", () => ({
        addEventListener: (_tipo: string, aviso: () => void) => escuchas.add(aviso),
        removeEventListener: (_tipo: string, aviso: () => void) => escuchas.delete(aviso),
      }));
      cambiarDensidad = (dpr) => {
        vi.stubGlobal("devicePixelRatio", dpr);
        act(() => Array.from(escuchas).forEach((aviso) => aviso()));
      };
    });

    const poster = (props: Partial<ComponentProps<typeof SalaPoster>> = {}) => (
      <SalaPoster src={SRC} alt="" title="Berserk" sizes="240px" capUpscale {...props} />
    );

    it("hasta saber cuánto mide el archivo, la imagen no se pinta y el rótulo sigue", () => {
      conCaja(240, 360);
      const { container } = render(poster());
      expect(marco(container)).toHaveAttribute("data-sala-poster-frame", "pending");
      expect(marco(container).className).toContain("invisible");
      expect(estado(container)).toBe("loading");
    });

    it("una imagen pequeña se compone como pieza: entera, encogida con transform y sin cambiar la caja del marco", async () => {
      conCaja(240, 360);
      const { container } = render(poster());
      cargar(container.querySelector("img")!, 96, 144);
      await asentar();
      expect(marco(container)).toHaveAttribute("data-sala-poster-frame", "piece");
      // 96 px × 1,25 = 120 px en una caja de 240: la mitad.
      expect(marco(container).style.transform).toBe("scale(0.5)");
      expect(marco(container).style.width).toBe("");
      expect(marco(container).className).not.toContain("invisible");
      expect(container.querySelector("img")!.className).toContain("object-contain");
      expect(estado(container)).toBe("loaded");
    });

    it("una imagen que da para la caja la llena", async () => {
      conCaja(240, 360);
      const { container } = render(poster());
      cargar(container.querySelector("img")!, 720, 1080);
      await asentar();
      expect(marco(container)).toHaveAttribute("data-sala-poster-frame", "fill");
      expect(marco(container).style.transform).toBe("");
      expect(container.querySelector("img")!.className).toContain("object-cover");
    });

    it("con srcset no se fía de lo que dice el <img>: mide el archivo que eligió el navegador", async () => {
      // Móvil a densidad 3: caja de 171 px CSS, 513 físicos. TMDB sirve w780 y el <img> dice medir 183.
      vi.stubGlobal("devicePixelRatio", 3);
      conCaja(171, 256.5);
      const { container } = render(poster({ sizes: "45vw" }));
      const imagen = container.querySelector("img")!;
      const elegido = "https://image.tmdb.org/t/p/w780/parasitos.jpg";
      imagen.setAttribute("srcset", `https://image.tmdb.org/t/p/w500/parasitos.jpg 640w, ${elegido} 750w`);
      Object.defineProperty(imagen, "currentSrc", { value: elegido });
      cargar(imagen, 183, 274);
      await asentar();
      // Aún no se sabe: ni llena ni pieza.
      expect(marco(container)).toHaveAttribute("data-sala-poster-frame", "pending");
      expect(sondas.map((s) => s.src)).toEqual([elegido]);
      await act(async () => sondas[0].cargar(780, 1170));
      // 513 px físicos con un archivo de 780: sobra. Con los 183 que dice el <img> habría salido pieza.
      expect(marco(container)).toHaveAttribute("data-sala-poster-frame", "fill");
      expect(estado(container)).toBe("loaded");
    });

    it("con srcset y un archivo pequeño de verdad (Google Books, 128 px), pieza a 1,25 veces el archivo", async () => {
      vi.stubGlobal("devicePixelRatio", 3);
      conCaja(171, 256.5);
      const { container } = render(poster({ src: "https://books.google.com/books/content?id=x" }));
      const imagen = container.querySelector("img")!;
      imagen.setAttribute("srcset", "https://books.google.com/books/content?id=x 640w");
      Object.defineProperty(imagen, "currentSrc", { value: "https://books.google.com/books/content?id=x" });
      cargar(imagen, 35, 53);
      await asentar();
      await act(async () => sondas[0].cargar(128, 192));
      expect(marco(container)).toHaveAttribute("data-sala-poster-frame", "piece");
      // 128 × 1,25 = 160 px físicos de los 513 de la caja.
      expect(marco(container).style.transform).toBe(`scale(${Math.round((160 / 513) * 10000) / 10000})`);
    });

    it("si el archivo no se puede medir, la imagen se enseña llenando la caja", async () => {
      conCaja(240, 360);
      const { container } = render(poster());
      const imagen = container.querySelector("img")!;
      imagen.setAttribute("srcset", `${SRC} 640w`);
      Object.defineProperty(imagen, "currentSrc", { value: SRC });
      cargar(imagen, 90, 135);
      await asentar();
      await act(async () => sondas[0].fallar());
      expect(marco(container)).toHaveAttribute("data-sala-poster-frame", "fill");
      expect(estado(container)).toBe("loaded");
    });

    it("con naturalSize decide al montar, antes de que la imagen cargue, y no vuelve a leer el archivo", async () => {
      conCaja(240, 360);
      const { container } = render(poster({ naturalSize: { width: 96, height: 144 } }));
      expect(marco(container)).toHaveAttribute("data-sala-poster-frame", "piece");
      expect(marco(container).style.transform).toBe("scale(0.5)");
      // Colocada pero sin cargar: el rótulo sigue.
      expect(estado(container)).toBe("loading");
      const imagen = container.querySelector("img")!;
      imagen.setAttribute("srcset", `${SRC} 640w`);
      cargar(imagen, 36, 54);
      await asentar();
      expect(sondas).toHaveLength(0);
      expect(marco(container)).toHaveAttribute("data-sala-poster-frame", "piece");
      expect(estado(container)).toBe("loaded");
    });

    it("recalcula si cambia la densidad de la pantalla sin cambiar la caja", () => {
      conCaja(240, 360);
      // 400 × 600 en 240 px CSS: a densidad 1 sobra; a 2 son 480 px, ampliada 1,2 veces, aún llena; a 3 son 720 px, 1,8 veces: pieza.
      const { container } = render(poster({ naturalSize: { width: 400, height: 600 } }));
      expect(marco(container)).toHaveAttribute("data-sala-poster-frame", "fill");
      cambiarDensidad(2);
      expect(marco(container)).toHaveAttribute("data-sala-poster-frame", "fill");
      cambiarDensidad(3);
      expect(marco(container)).toHaveAttribute("data-sala-poster-frame", "piece");
      // 400 × 1,25 = 500 px físicos de los 720 de la caja.
      expect(marco(container).style.transform).toBe(`scale(${Math.round((500 / 720) * 10000) / 10000})`);
      cambiarDensidad(1);
      expect(marco(container)).toHaveAttribute("data-sala-poster-frame", "fill");
    });

    it("un solo observador para todos los pósteres", () => {
      conCaja(240, 360);
      render(
        <>
          {Array.from({ length: 20 }, (_, i) => (
            <SalaPoster key={i} src={`${SRC}?${i}`} alt="" title="Berserk" sizes="240px" capUpscale naturalSize={{ width: 96, height: 144 }} />
          ))}
        </>
      );
      // Como mucho uno: el del módulo, que puede venir ya creado de una prueba anterior.
      expect(observadores).toBeLessThanOrEqual(1);
    });

    it("si la imagen falla, queda el sustituto", () => {
      conCaja(240, 360);
      const onLoadError = vi.fn();
      const { container } = render(poster({ alt: "Cartel de Berserk", onLoadError }));
      fireEvent.error(container.querySelector("img")!);
      expect(container.querySelector("img")).toBeNull();
      expect(estado(container)).toBe("error");
      expect(screen.getByRole("img", { name: "Cartel de Berserk" })).toBeInTheDocument();
      expect(onLoadError).toHaveBeenCalledTimes(1);
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

    it("las clases de colores forzados llegan al DOM (cn no se queda con una sola)", () => {
      const { container } = render(<SalaPoster alt="" title="Berserk" sizes="160px" />);
      const clases = container.firstElementChild!.className.split(/\s+/).filter((c) => c.startsWith("forced-colors:"));
      expect(clases).toEqual(["forced-colors:[outline:1px_solid_CanvasText]", "forced-colors:[outline-offset:-1px]"]);
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
