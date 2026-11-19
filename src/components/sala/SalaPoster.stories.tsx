import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, waitFor } from "storybook/test";
import { IMAGEN_ROTA, imagenDeEjemplo, Muestra, Muestras, NOTA_PALETA, OBRAS, Suelo } from "../../../.storybook/sala";
import type { MediaType } from "@/types/media";
import { SalaPoster } from "./SalaPoster";

/**
 * Póster de «Sala»: la imagen de una obra. Las imágenes de estas historias
 * son inventadas (un SVG de colores planos en un `data:` URI): no se baja nada
 * de la red ni se enseñan portadas con derechos. Las historias «en claro» son
 * las mismas, para que axe las pase en los dos temas.
 */
const meta = {
  title: "Sala/Póster",
  component: SalaPoster,
  parameters: { layout: "fullscreen" },
  args: { alt: "", title: "Parásitos", sizes: "160px", src: imagenDeEjemplo(480, 720, 165) },
} satisfies Meta<typeof SalaPoster>;

export default meta;
type Story = StoryObj<typeof meta>;

const OBRA = OBRAS[1];

const FORMATOS: Array<{ format: MediaType; nombre: string; titulo: string; tono: number }> = [
  { format: "movie", nombre: "Película", titulo: "Parásitos", tono: 165 },
  { format: "tv", nombre: "Serie", titulo: "Breaking Bad", tono: 120 },
  { format: "anime", nombre: "Anime", titulo: "El viaje de Chihiro", tono: 28 },
  { format: "book", nombre: "Libro", titulo: "Cien años de soledad", tono: 70 },
  { format: "comic", nombre: "Cómic", titulo: "Watchmen", tono: 95 },
  { format: "manga", nombre: "Manga", titulo: "Berserk", tono: 258 },
  { format: "game", nombre: "Videojuego", titulo: "Elden Ring", tono: 50 },
];

/** Una caja de ancho fijo: el póster llena el ancho que le dan. */
function Hueco({ ancho = "w-40", children }: { ancho?: string; children: React.ReactNode }) {
  return <div className={ancho}>{children}</div>;
}

const cargados = (canvasElement: HTMLElement, cuantos: number) =>
  waitFor(() => expect(canvasElement.querySelectorAll('[data-sala-poster="loaded"]')).toHaveLength(cuantos));

// ------------------------------------------------------------
// Una sola pieza, con controles
// ------------------------------------------------------------

export const Uno: Story = {
  name: "Póster",
  render: (args) => (
    <Suelo titulo="Póster">
      <Hueco>
        <SalaPoster {...args} />
      </Hueco>
    </Suelo>
  ),
  // axe mide con la imagen ya puesta: mientras llega, tapa a medias el rótulo de debajo.
  play: ({ canvasElement }) => cargados(canvasElement, 1),
};

// ------------------------------------------------------------
// Proporciones
// ------------------------------------------------------------

function Proporciones({ conImagen }: { conImagen: boolean }) {
  return (
    <Muestras titulo={conImagen ? "Con imagen" : "Sin imagen"}>
      {FORMATOS.map(({ format, nombre, titulo, tono }) => {
        const apaisado = format === "game";
        return (
          <Muestra key={format} pie={`${nombre}, ${apaisado ? "16:9" : "2:3"}`}>
            <Hueco ancho={apaisado ? "w-64" : "w-40"}>
              <SalaPoster
                data-testid={`poster-${format}`}
                format={format}
                alt=""
                title={titulo}
                sizes={apaisado ? "256px" : "160px"}
                src={conImagen ? (apaisado ? imagenDeEjemplo(1280, 720, tono) : imagenDeEjemplo(480, 720, tono)) : null}
              />
            </Hueco>
          </Muestra>
        );
      })}
    </Muestras>
  );
}

export const LasProporciones: Story = {
  name: "Proporciones por formato",
  render: () => (
    <Suelo
      titulo="Proporciones"
      nota="Todos los proveedores dan una portada vertical cercana a 2:3 salvo el de videojuegos, que da arte apaisado. La caja reserva su sitio antes de que llegue la imagen: con ella y sin ella mide lo mismo."
    >
      <Proporciones conImagen />
      <Proporciones conImagen={false} />
    </Suelo>
  ),
  play: async ({ canvas, canvasElement }) => {
    await cargados(canvasElement, FORMATOS.length);
    for (const { format } of FORMATOS) {
      const [con, sin] = canvas.getAllByTestId(`poster-${format}`).map((caja) => caja.getBoundingClientRect());
      const proporcion = format === "game" ? 16 / 9 : 2 / 3;
      await expect(con.width / con.height).toBeCloseTo(proporcion, 2);
      // Sin salto de maquetación: la caja con imagen mide lo mismo que la que no la tiene.
      await expect(con.width).toBe(sin.width);
      await expect(con.height).toBe(sin.height);
    }
    // En una tarjeta el título va al lado: la imagen es adorno.
    for (const imagen of Array.from(canvasElement.querySelectorAll("img"))) {
      await expect(imagen).toHaveAttribute("alt", "");
    }
  },
};

// ------------------------------------------------------------
// Estados
// ------------------------------------------------------------

function Estados() {
  return (
    <>
      <Muestras titulo="Con el título al lado (adorno)">
        <Muestra pie="Con imagen">
          <Hueco>
            <SalaPoster alt="" title="Parásitos" sizes="160px" src={imagenDeEjemplo(480, 720, 165)} />
          </Hueco>
        </Muestra>
        <Muestra pie="Sin imagen, o mientras llega">
          <Hueco>
            <SalaPoster alt="" title="Parásitos" sizes="160px" />
          </Hueco>
        </Muestra>
        <Muestra pie="La imagen ha fallado">
          <Hueco>
            <SalaPoster data-testid="rota" alt="" title="El viaje de Chihiro" sizes="160px" src={IMAGEN_ROTA} />
          </Hueco>
        </Muestra>
        <Muestra pie="Título original, en japonés">
          <Hueco>
            <SalaPoster alt="" title="千と千尋の神隠し" titleLang="ja" sizes="160px" />
          </Hueco>
        </Muestra>
        <Muestra pie="En coreano">
          <Hueco>
            <SalaPoster alt="" title="기생충" titleLang="ko" sizes="160px" />
          </Hueco>
        </Muestra>
        <Muestra pie="Un título largo">
          <Hueco>
            <SalaPoster alt="" title="Birdman o (la inesperada virtud de la ignorancia)" sizes="160px" />
          </Hueco>
        </Muestra>
        <Muestra pie="Miniatura: solo el campo de color">
          <Hueco ancho="w-10">
            <SalaPoster alt="" title="Berserk" sizes="40px" fallback="plain" />
          </Hueco>
        </Muestra>
      </Muestras>
      <Muestras titulo="Solo (la imagen lleva el nombre)">
        <Muestra pie="Con imagen">
          <Hueco>
            <SalaPoster alt="Cartel de Parásitos" title="Parásitos" sizes="160px" src={imagenDeEjemplo(480, 720, 165)} />
          </Hueco>
        </Muestra>
        <Muestra pie="Sin imagen: el sustituto lleva el nombre">
          <Hueco>
            <SalaPoster alt="Cartel de Berserk" title="Berserk" sizes="160px" />
          </Hueco>
        </Muestra>
      </Muestras>
    </>
  );
}

export const LosEstados: Story = {
  name: "Estados",
  render: () => (
    <>
      <Suelo titulo="Sin paleta" nota="El campo de color es la franja del contenedor: aquí, la neutra.">
        <Estados />
      </Suelo>
      <Suelo titulo={OBRA.titulo} nota={NOTA_PALETA} palette={OBRA.palette}>
        <Estados />
      </Suelo>
    </>
  ),
  play: async ({ canvas, canvasElement }) => {
    // La imagen rota no deja un hueco ni un icono de imagen rota: queda el campo con el título.
    await waitFor(() => expect(canvasElement.querySelectorAll('[data-sala-poster="error"]')).toHaveLength(2));
    for (const rota of canvas.getAllByTestId("rota")) {
      await expect(rota.querySelector("img")).toBeNull();
      await expect(rota).toHaveTextContent("El viaje de Chihiro");
      // El rótulo del sustituto es adorno: el título de verdad va al lado.
      await expect(rota.querySelector("[data-sala-poster-title]")).toHaveAttribute("aria-hidden", "true");
    }
    // Solo, con imagen: la nombra su `alt`. Sin imagen: la caja.
    await expect(canvas.getAllByRole("img", { name: "Cartel de Parásitos" })[0].tagName).toBe("IMG");
    await expect(canvas.getAllByRole("img", { name: "Cartel de Berserk" })[0].tagName).toBe("DIV");
    // El rótulo no baja de 14 px ni en la caja más estrecha, y no se sale de ella.
    for (const rotulo of Array.from(canvasElement.querySelectorAll<HTMLElement>("[data-sala-poster-title] > span"))) {
      await expect(parseFloat(getComputedStyle(rotulo).fontSize)).toBeGreaterThanOrEqual(14);
      const caja = rotulo.closest("[data-sala-poster]")!.getBoundingClientRect();
      await expect(rotulo.getBoundingClientRect().right).toBeLessThanOrEqual(caja.right + 1);
    }
    // Cada escritura con su fuente.
    const [japones] = canvas.getAllByText("千と千尋の神隠し");
    await expect(japones).toHaveAttribute("lang", "ja");
    const [coreano] = canvas.getAllByText("기생충");
    await expect(getComputedStyle(coreano).fontFamily).toMatch(/Noto Sans KR.*Noto Sans JP/);
  },
};

// ------------------------------------------------------------
// Tope de ampliación
// ------------------------------------------------------------

/** Tamaño natural de las imágenes de esta historia, en píxeles. */
const PEQUENA = { width: 96, height: 144 };

export const TopeDeAmpliacion: Story = {
  name: "Tope de ampliación (1,25×)",
  render: () => (
    <Suelo
      titulo="Tope de ampliación"
      nota="Biblia §2: ninguna imagen se amplía por encima de 1,25 veces su tamaño natural. La que no da para llenar la caja se compone como una pieza: entera, a su tamaño, centrada sobre el campo de color. Las de Google Books llegan con unos 128 px de ancho."
      palette={OBRAS[2].palette}
    >
      <Muestras titulo="La misma caja, de 240 px">
        <Muestra pie="Imagen de 720 × 1080: la llena">
          <Hueco ancho="w-60">
            <SalaPoster data-testid="grande" alt="" title="Berserk" sizes="240px" src={imagenDeEjemplo(720, 1080, 258)} />
          </Hueco>
        </Muestra>
        <Muestra pie={`Imagen de ${PEQUENA.width} × ${PEQUENA.height}: pieza`}>
          <Hueco ancho="w-60">
            <SalaPoster
              data-testid="pequena"
              alt=""
              title="Berserk"
              sizes="240px"
              src={imagenDeEjemplo(PEQUENA.width, PEQUENA.height, 258)}
            />
          </Hueco>
        </Muestra>
        <Muestra pie="Apaisada de 320 × 180 en una caja vertical: pieza">
          <Hueco ancho="w-60">
            <SalaPoster data-testid="apaisada" alt="" title="Elden Ring" sizes="240px" src={imagenDeEjemplo(320, 180, 50)} />
          </Hueco>
        </Muestra>
        <Muestra pie="La pequeña, sin tope (capUpscale=false)">
          <Hueco ancho="w-60">
            <SalaPoster
              data-testid="sin-tope"
              alt=""
              title="Berserk"
              sizes="240px"
              capUpscale={false}
              src={imagenDeEjemplo(PEQUENA.width, PEQUENA.height, 258)}
            />
          </Hueco>
        </Muestra>
      </Muestras>
    </Suelo>
  ),
  play: async ({ canvas, canvasElement }) => {
    await cargados(canvasElement, 4);
    const dpr = window.devicePixelRatio || 1;
    const marco = (id: string) => canvas.getByTestId(id).querySelector<HTMLElement>("[data-sala-poster-frame]")!;

    await expect(marco("grande")).toHaveAttribute("data-sala-poster-frame", "fill");
    await expect(marco("sin-tope")).toHaveAttribute("data-sala-poster-frame", "fill");

    // La pequeña no pasa de 1,25 veces su tamaño natural, medido en píxeles físicos.
    await waitFor(() => expect(marco("pequena")).toHaveAttribute("data-sala-poster-frame", "piece"));
    const pequena = marco("pequena").getBoundingClientRect();
    await expect((pequena.width * dpr) / PEQUENA.width).toBeLessThanOrEqual(1.25 + 0.02);
    await expect(pequena.width / pequena.height).toBeCloseTo(PEQUENA.width / PEQUENA.height, 1);

    // La apaisada cabe entera en la caja vertical y tampoco pasa del tope.
    await waitFor(() => expect(marco("apaisada")).toHaveAttribute("data-sala-poster-frame", "piece"));
    const caja = canvas.getByTestId("apaisada").getBoundingClientRect();
    const apaisada = marco("apaisada").getBoundingClientRect();
    await expect(apaisada.width).toBeLessThanOrEqual(caja.width + 1);
    await expect((apaisada.width * dpr) / 320).toBeLessThanOrEqual(1.25 + 0.02);

    // Componer la pieza no cambia la caja: las cuatro miden lo mismo.
    const alto = canvas.getByTestId("grande").getBoundingClientRect().height;
    for (const id of ["pequena", "apaisada", "sin-tope"]) {
      await expect(canvas.getByTestId(id).getBoundingClientRect().height).toBe(alto);
    }
  },
};

// ------------------------------------------------------------
// Las mismas en claro, para que axe las pase en los dos temas.
// ------------------------------------------------------------

const SOLO_PRUEBA = { globals: { tema: "claro" }, tags: ["!dev"] };

export const ProporcionesEnClaro: Story = { ...LasProporciones, ...SOLO_PRUEBA };
export const EstadosEnClaro: Story = { ...LosEstados, ...SOLO_PRUEBA };
export const TopeDeAmpliacionEnClaro: Story = { ...TopeDeAmpliacion, ...SOLO_PRUEBA };
