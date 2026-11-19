import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, waitFor } from "storybook/test";
import { EN_PRUEBAS, fijarDensidad, IMAGEN_ROTA, imagenDeEjemplo, Muestra, Muestras, NOTA_PALETA, OBRAS, Suelo } from "../../../.storybook/sala";
import { IMAGE_MAX_UPSCALE, posterFit } from "@/lib/design/image-fit";
import type { MediaType } from "@/types/media";
import { SalaPoster } from "./SalaPoster";

/**
 * Póster de «Sala»: la imagen de una obra. Las imágenes de estas historias
 * son inventadas (un SVG de colores planos en un `data:` URI): no se baja nada
 * de la red ni se enseñan portadas con derechos. La excepción es «Tope con
 * `srcset`», que necesita un archivo servido por HTTP para que `next/image`
 * genere el `srcset`: usa el icono de la app. Las historias «en claro» son las
 * mismas, para que axe las pase en los dos temas.
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
  waitFor(() => expect(canvasElement.querySelectorAll('[data-sala-poster-image="loaded"]')).toHaveLength(cuantos));

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
    await waitFor(() => expect(canvasElement.querySelectorAll('[data-sala-poster-image="error"]')).toHaveLength(2));
    await cargados(canvasElement, 4);
    // Cargada la imagen, el rótulo de debajo deja de pintarse (no asoma por una portada con transparencia).
    for (const imagen of Array.from(canvasElement.querySelectorAll('[data-sala-poster-image="loaded"]'))) {
      const rotulo = imagen.parentElement!.querySelector("[data-sala-poster-title]")!;
      await expect(getComputedStyle(rotulo).display).toBe("none");
    }
    for (const rota of canvas.getAllByTestId("rota")) {
      // Mientras, y si falla, el rótulo se ve.
      await expect(getComputedStyle(rota.querySelector("[data-sala-poster-title]")!).display).not.toBe("none");
      await expect(rota.querySelector("img")).toBeNull();
      await expect(rota).toHaveTextContent("El viaje de Chihiro");
      // El rótulo del sustituto es adorno: el título de verdad va al lado.
      await expect(rota.querySelector("[data-sala-poster-title]")).toHaveAttribute("aria-hidden", "true");
    }
    // Solo, con imagen: la nombra su `alt`. Sin imagen: la caja.
    await expect(canvas.getAllByRole("img", { name: "Cartel de Parásitos" })[0].tagName).toBe("IMG");
    await expect(canvas.getAllByRole("img", { name: "Cartel de Berserk" })[0].tagName).toBe("DIV");
    // Sin imagen, el campo de color es la franja: un fondo opaco, y la caja no lleva borde, sombra ni esquinas redondas.
    for (const caja of Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-sala-poster="empty"]'))) {
      const estilo = getComputedStyle(caja);
      await expect(estilo.backgroundColor).not.toMatch(/rgba?\(0, 0, 0, 0\)|transparent/);
      await expect(estilo.borderTopWidth).toBe("0px");
      await expect(estilo.borderTopLeftRadius).toBe("0px");
      await expect(estilo.boxShadow).toBe("none");
    }
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
      nota="Biblia §2: en la sala de la ficha ninguna imagen se amplía por encima de 1,25 veces su tamaño natural. Con capUpscale, la que no da para llenar la caja se compone como una pieza: entera, a su tamaño, centrada sobre el campo de color. En tarjetas y listas va apagado: la portada llena la caja, como hasta ahora."
      palette={OBRAS[2].palette}
    >
      <Muestras titulo="La misma caja, de 240 px, con capUpscale">
        <Muestra pie="Imagen de 720 × 1080: la llena">
          <Hueco ancho="w-60">
            <SalaPoster data-testid="grande" capUpscale alt="" title="Berserk" sizes="240px" src={imagenDeEjemplo(720, 1080, 258)} />
          </Hueco>
        </Muestra>
        <Muestra pie={`Imagen de ${PEQUENA.width} × ${PEQUENA.height}: pieza`}>
          <Hueco ancho="w-60">
            <SalaPoster
              data-testid="pequena"
              capUpscale
              alt=""
              title="Berserk"
              sizes="240px"
              src={imagenDeEjemplo(PEQUENA.width, PEQUENA.height, 258)}
            />
          </Hueco>
        </Muestra>
        <Muestra pie="La misma, con sus medidas por props (naturalSize)">
          <Hueco ancho="w-60">
            <SalaPoster
              data-testid="sabida"
              capUpscale
              naturalSize={PEQUENA}
              alt=""
              title="Berserk"
              sizes="240px"
              src={imagenDeEjemplo(PEQUENA.width, PEQUENA.height, 258)}
            />
          </Hueco>
        </Muestra>
        <Muestra pie="Apaisada de 320 × 180 en una caja vertical: pieza">
          <Hueco ancho="w-60">
            <SalaPoster data-testid="apaisada" capUpscale alt="" title="Elden Ring" sizes="240px" src={imagenDeEjemplo(320, 180, 50)} />
          </Hueco>
        </Muestra>
      </Muestras>
      <Muestras titulo="Sin tope (por defecto)">
        <Muestra pie="La pequeña llena la caja, ampliada">
          <Hueco ancho="w-60">
            <SalaPoster data-testid="sin-tope" alt="" title="Berserk" sizes="240px" src={imagenDeEjemplo(PEQUENA.width, PEQUENA.height, 258)} />
          </Hueco>
        </Muestra>
      </Muestras>
    </Suelo>
  ),
  play: async ({ canvas, canvasElement }) => {
    await cargados(canvasElement, 5);
    const dpr = window.devicePixelRatio || 1;
    const marco = (id: string) => canvas.getByTestId(id).querySelector<HTMLElement>("[data-sala-poster-frame]")!;
    /** Lo que ocupa la imagen pintada: el marco, ya encogido si es una pieza. */
    const pintado = (id: string) => marco(id).getBoundingClientRect();

    await expect(marco("grande")).toHaveAttribute("data-sala-poster-frame", "fill");
    await expect(marco("sin-tope")).toHaveAttribute("data-sala-poster-frame", "fill");
    // Sin tope, la pequeña llena la caja entera.
    await expect(Math.round(pintado("sin-tope").width)).toBe(Math.round(canvas.getByTestId("sin-tope").getBoundingClientRect().width));

    // La pequeña no pasa de 1,25 veces su tamaño natural, medido en píxeles físicos; la mida el componente o se le diga.
    for (const id of ["pequena", "sabida"]) {
      await waitFor(() => expect(marco(id)).toHaveAttribute("data-sala-poster-frame", "piece"));
      const pieza = pintado(id);
      await expect((pieza.width * dpr) / PEQUENA.width).toBeLessThanOrEqual(IMAGE_MAX_UPSCALE + 0.02);
      await expect(pieza.width / pieza.height).toBeCloseTo(PEQUENA.width / PEQUENA.height, 1);
      // Centrada en la caja.
      const caja = canvas.getByTestId(id).getBoundingClientRect();
      await expect(pieza.left + pieza.width / 2).toBeCloseTo(caja.left + caja.width / 2, 0);
      await expect(pieza.top + pieza.height / 2).toBeCloseTo(caja.top + caja.height / 2, 0);
      // Se ve, y entera.
      await expect(getComputedStyle(marco(id)).visibility).toBe("visible");
      await expect(getComputedStyle(marco(id).querySelector("img")!).objectFit).toBe("contain");
    }

    // La apaisada cabe entera en la caja vertical y tampoco pasa del tope.
    await waitFor(() => expect(marco("apaisada")).toHaveAttribute("data-sala-poster-frame", "piece"));
    const caja = canvas.getByTestId("apaisada").getBoundingClientRect();
    const apaisada = pintado("apaisada");
    await expect(apaisada.width).toBeLessThanOrEqual(caja.width + 1);
    await expect((apaisada.width * dpr) / 320).toBeLessThanOrEqual(IMAGE_MAX_UPSCALE + 0.02);

    // Componer la pieza no cambia la caja: todas miden lo mismo.
    const alto = canvas.getByTestId("grande").getBoundingClientRect().height;
    for (const id of ["pequena", "sabida", "apaisada", "sin-tope"]) {
      await expect(canvas.getByTestId(id).getBoundingClientRect().height).toBe(alto);
    }
  },
};

// ------------------------------------------------------------
// Tope de ampliación con `next/image` de verdad: `srcset` y `sizes`
// ------------------------------------------------------------

/** El icono de la app: un PNG de 192 × 192 servido por HTTP, así que `next/image` le pone `srcset`. */
const ICONO = { src: "/icons/icon-192.png", width: 192, height: 192 };

const CON_SRCSET = [
  // 60 px para un archivo de 192: sobra imagen a cualquier densidad (180 px físicos a densidad 3). Llena siempre.
  { id: "holgada", ancho: 60, pie: "Caja de 60 px: llena" },
  // 200 px: a densidad 1 cabe ampliada 1,04 veces y llena; a 2 y a 3 ya no (400 y 600 px físicos): pieza.
  { id: "justa", ancho: 200, pie: "Caja de 200 px: llena a densidad 1" },
  // 320 px: haría falta ampliarla 1,67 veces ya a densidad 1. Pieza de 240 px (192 × 1,25).
  { id: "corta", ancho: 320, pie: "Caja de 320 px: pieza" },
];

/** Lo que tiene que salir a cada densidad: de la cuenta a mano, no del componente. */
const ESPERADO: Record<number, Record<string, "fill" | number>> = {
  1: { holgada: "fill", justa: "fill", corta: 240 },
  2: { holgada: "fill", justa: 120, corta: 120 },
  3: { holgada: "fill", justa: 80, corta: 80 },
};

export const TopeConSrcset: Story = {
  name: "Tope con srcset (next/image de verdad)",
  render: () => (
    <Suelo
      titulo="Tope con srcset"
      nota="Las demás historias usan imágenes en data:, que next/image sirve sin srcset. Aquí el archivo llega por HTTP y lleva srcset y sizes, como una portada de verdad: el naturalWidth que da el navegador ya no es el del archivo (viene dividido por la densidad del candidato elegido), y el tope tiene que medir el archivo. La imagen es el icono de la app, de 192 × 192. La prueba lo repite a densidad 2 y 3."
    >
      <Muestras titulo="El mismo archivo de 192 px, entero (fit=contain)">
        {CON_SRCSET.map(({ id, ancho, pie }) => (
          <Muestra key={id} pie={pie}>
            <div style={{ width: ancho }}>
              <SalaPoster
                data-testid={id}
                capUpscale
                fit="contain"
                alt=""
                title="KULTURA"
                sizes={`${ancho}px`}
                src={ICONO.src}
                loading="eager"
                fallback="plain"
              />
            </div>
          </Muestra>
        ))}
      </Muestras>
    </Suelo>
  ),
  play: async ({ canvas, canvasElement }) => {
    await cargados(canvasElement, CON_SRCSET.length);
    const marcoDe = (id: string) => canvas.getByTestId(id).querySelector<HTMLElement>("[data-sala-poster-frame]")!;

    // La trampa está puesta: hay `srcset`, y lo que dice medir la imagen no es lo que mide el archivo.
    for (const { id } of CON_SRCSET) {
      const imagen = marcoDe(id).querySelector("img")!;
      await expect(imagen.srcset).toContain(" 256w");
      await expect(imagen.naturalWidth).not.toBe(ICONO.width);
    }

    const comprobar = async (dpr: number) => {
      for (const { id, ancho } of CON_SRCSET) {
        const caja = canvas.getByTestId(id);
        const { width, height } = caja.getBoundingClientRect();
        await expect(Math.round(width)).toBe(ancho);
        // Lo que toca según el archivo de verdad y la caja en píxeles físicos…
        const toca = posterFit(ICONO, { width: width * dpr, height: height * dpr }, dpr, "contain")!;
        // …que es lo que sale de la cuenta a mano…
        const esperado = ESPERADO[dpr]?.[id];
        if (esperado !== undefined) await expect(toca.frame === "piece" ? toca.width : "fill").toBe(esperado);
        // …y lo que el componente pinta. La imagen es cuadrada y va entera: ocupa el ancho del marco.
        await waitFor(() => expect(marcoDe(id)).toHaveAttribute("data-sala-poster-frame", toca.frame));
        await waitFor(() => expect(Math.round(marcoDe(id).getBoundingClientRect().width)).toBe(toca.frame === "piece" ? toca.width : ancho));
        // Nunca más de 1,25 veces el archivo.
        await expect((marcoDe(id).getBoundingClientRect().width * dpr) / ICONO.width).toBeLessThanOrEqual(IMAGE_MAX_UPSCALE + 0.02);
        await expect(getComputedStyle(marcoDe(id)).visibility).toBe("visible");
      }
    };

    const inicial = window.devicePixelRatio || 1;
    await comprobar(inicial);

    // A densidad 2 y 3, sin cambiar la caja: el póster se entera solo y vuelve a decidir.
    // (Solo en `npm run test:storybook`; en el Storybook de mirar no se puede cambiar la densidad.)
    try {
      for (const dpr of [2, 3]) {
        const puesta = await fijarDensidad(dpr);
        // En las pruebas tiene que poder: si no, esto pasaría sin haber medido nada.
        if (EN_PRUEBAS) await expect(puesta).toBe(true);
        if (!puesta) return;
        await comprobar(dpr);
      }
    } finally {
      await fijarDensidad(inicial);
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
export const TopeConSrcsetEnClaro: Story = { ...TopeConSrcset, ...SOLO_PRUEBA };
