import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { IconoMas, Muestra, Muestras, NOTA_PALETA, OBRAS, Suelo, type ObraDeEjemplo } from "../../../.storybook/sala";
import { SalaButton } from "./SalaButton";
import { SalaLink } from "./SalaLink";

/**
 * Enlace de «Sala»: en línea, dentro de un texto, y suelto. Como en el botón,
 * cada historia va sobre los neutros y sobre el color de una obra, y las «en
 * claro» son las mismas para axe.
 */
const meta = {
  title: "Sala/Enlace",
  component: SalaLink,
  parameters: { layout: "fullscreen" },
  args: { href: "/library", children: "Tu biblioteca" },
  argTypes: {
    variant: { control: "inline-radio", options: ["inline", "standalone"] },
  },
} satisfies Meta<typeof SalaLink>;

export default meta;
type Story = StoryObj<typeof meta>;

const OBRA = OBRAS[1];
const TMDB = "https://www.themoviedb.org/movie/129";

function EnLosDosSuelos({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suelo titulo="Sin imagen">{children}</Suelo>
      <Suelo titulo={OBRA.titulo} nota={NOTA_PALETA} palette={OBRA.palette}>
        {children}
      </Suelo>
    </>
  );
}

// ------------------------------------------------------------
// En línea
// ------------------------------------------------------------

function Parrafo() {
  return (
    <div className="grid max-w-[62ch] gap-6">
      <p className="sala-type-lead">
        Chihiro, de diez años, se pierde en un mundo de dioses y tiene que trabajar para salir de él. Es la película más vista de{" "}
        <SalaLink href="/search?q=Hayao+Miyazaki">Hayao Miyazaki</SalaLink>, y en japonés se llama{" "}
        <SalaLink href="/media/129" lang="ja">
          千と千尋の神隠し
        </SalaLink>
        .
      </p>
      <p>
        Los datos de esta ficha salen de <SalaLink href={TMDB}>The Movie Database</SalaLink>. Si ves un error,{" "}
        <SalaLink href="mailto:hola@example.org">escríbenos</SalaLink> o vuelve a <SalaLink href="/library">tu biblioteca</SalaLink>.
      </p>
      <p className="sala-type-small text-sala-ink-secondary">
        En un texto pequeño el enlace hereda el tamaño: <SalaLink href="/privacy">cómo tratamos tus datos</SalaLink>.
      </p>
      {/* Una dirección como texto, en una columna estrecha: se parte, no desborda. */}
      <p data-testid="columna-estrecha" className="max-w-[18rem]">
        La fuente:{" "}
        <SalaLink href="https://www.themoviedb.org/movie/129-sen-to-chihiro-no-kamikakushi" newTab={false}>
          https://www.themoviedb.org/movie/129-sen-to-chihiro-no-kamikakushi
        </SalaLink>
      </p>
    </div>
  );
}

export const EnLinea: Story = {
  name: "En línea",
  render: () => (
    <EnLosDosSuelos>
      <Parrafo />
    </EnLosDosSuelos>
  ),
  play: async ({ canvas }) => {
    // Subrayado en reposo: no se distingue del texto solo por el color.
    const [enlace] = canvas.getAllByRole("link", { name: "Hayao Miyazaki" });
    await expect(getComputedStyle(enlace).textDecorationLine).toBe("underline");
    // En línea no hace falta la zona de 48 px, pero sí 24 (WCAG 2.5.8).
    await expect(enlace.getBoundingClientRect().height).toBeGreaterThanOrEqual(24);
    // Una URL como texto no se sale de su columna ni da scroll horizontal (WCAG 1.4.10).
    for (const columna of canvas.getAllByTestId("columna-estrecha")) {
      const limite = columna.getBoundingClientRect().right;
      for (const trozo of Array.from(columna.querySelector("a")!.getClientRects())) {
        await expect(trozo.right).toBeLessThanOrEqual(limite + 2);
      }
      await expect(columna.scrollWidth).toBeLessThanOrEqual(columna.clientWidth + 2);
    }
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
  },
};

// ------------------------------------------------------------
// Suelto
// ------------------------------------------------------------

function Sueltos() {
  return (
    <ul className="grid gap-1">
      <li>
        <SalaLink variant="standalone" href="/search?q=Hayao+Miyazaki">
          Ver todo lo de Hayao Miyazaki
        </SalaLink>
      </li>
      <li>
        <SalaLink variant="standalone" href={TMDB}>
          Ver la ficha en The Movie Database
        </SalaLink>
      </li>
      <li>
        <SalaLink variant="standalone" href="/media/129" lang="ja">
          千と千尋の神隠し
        </SalaLink>
      </li>
    </ul>
  );
}

export const Suelto: Story = {
  render: () => (
    <EnLosDosSuelos>
      <Sueltos />
    </EnLosDosSuelos>
  ),
  play: async ({ canvas }) => {
    const [enlace] = canvas.getAllByRole("link", { name: "Ver todo lo de Hayao Miyazaki" });
    await expect(Math.round(enlace.getBoundingClientRect().height)).toBeGreaterThanOrEqual(48);
  },
};

// ------------------------------------------------------------
// Estados
// ------------------------------------------------------------

function Estados() {
  const estados: Array<{ pie: string; force?: string }> = [
    { pie: "Reposo" },
    { pie: "Con el puntero encima", force: "hover" },
    { pie: "Con el foco del teclado", force: "focus" },
    { pie: "Pulsado", force: "pressed" },
    { pie: "Con el puntero y el foco", force: "hover focus" },
  ];
  return (
    <>
      <Muestras titulo="En línea">
        {estados.map(({ pie, force }) => (
          <Muestra key={pie} pie={pie}>
            <p>
              Dirigida por{" "}
              <SalaLink href="/search?q=Hayao+Miyazaki" data-sala-force={force}>
                Hayao Miyazaki
              </SalaLink>
            </p>
          </Muestra>
        ))}
      </Muestras>
      <Muestras titulo="Suelto">
        {estados.map(({ pie, force }) => (
          <Muestra key={pie} pie={pie}>
            <SalaLink variant="standalone" href="/search?q=Hayao+Miyazaki" data-sala-force={force}>
              Ver todo lo de Hayao Miyazaki
            </SalaLink>
          </Muestra>
        ))}
      </Muestras>
      <Muestras titulo="A otra web">
        {estados.map(({ pie, force }) => (
          <Muestra key={pie} pie={pie}>
            <SalaLink variant="standalone" href={TMDB} data-sala-force={force}>
              The Movie Database
            </SalaLink>
          </Muestra>
        ))}
      </Muestras>
    </>
  );
}

export const LosEstados: Story = {
  name: "Estados",
  render: () => (
    <EnLosDosSuelos>
      <Estados />
    </EnLosDosSuelos>
  ),
  play: async ({ canvas }) => {
    // En línea, el anillo va pegado; con el puntero encima se separa 2 px para
    // que no se funda con el bloque de tinta.
    const enLinea = canvas.getAllByRole("link", { name: "Hayao Miyazaki" });
    const foco = enLinea.find((a) => a.dataset.salaForce === "focus")!;
    const punteroYFoco = enLinea.find((a) => a.dataset.salaForce === "hover focus")!;
    await expect(getComputedStyle(foco).outlineOffset).toBe("0px");
    await expect(getComputedStyle(punteroYFoco).outlineOffset).toBe("2px");
    await expect(getComputedStyle(punteroYFoco).outlineWidth).toBe("3px");
  },
};

export const SobreUnPanel: Story = {
  name: "Sobre un panel",
  render: () => (
    <EnLosDosSuelos>
      <div className="bg-sala-panel p-6">
        <Estados />
      </div>
    </EnLosDosSuelos>
  ),
};

// ------------------------------------------------------------
// Interno y externo
// ------------------------------------------------------------

export const Destinos: Story = {
  name: "Interno y externo",
  render: () => (
    <Suelo titulo="Destinos" nota="Una ruta de la app usa el enlace con idioma. Una web externa se abre en otra pestaña, lo dice en su nombre y lleva la flecha.">
      <ul className="grid gap-1">
        <li>
          <SalaLink variant="standalone" href="/library">
            Tu biblioteca
          </SalaLink>
        </li>
        <li>
          <SalaLink variant="standalone" href={TMDB}>
            The Movie Database
          </SalaLink>
        </li>
        <li>
          <SalaLink variant="standalone" href={TMDB} newTab={false}>
            The Movie Database, en esta pestaña
          </SalaLink>
        </li>
        <li>
          <SalaLink variant="standalone" href="mailto:hola@example.org">
            Escríbenos
          </SalaLink>
        </li>
        <li>
          <SalaLink variant="standalone" href="https://www.ghibli.jp/works/chihiro/" lang="ja">
            千と千尋の神隠し
          </SalaLink>
        </li>
      </ul>
    </Suelo>
  ),
  play: async ({ canvas, userEvent }) => {
    const interno = canvas.getByRole("link", { name: "Tu biblioteca" });
    await expect(interno).not.toHaveAttribute("target");

    // En el navegador el espacio que separa el aviso es obligatorio.
    const externo = canvas.getByRole("link", { name: /^The Movie Database \(se abre en una pestaña nueva\)$/ });
    await expect(externo).toHaveAttribute("target", "_blank");
    await expect(externo).toHaveAttribute("rel", "noopener noreferrer");

    const mismaPestana = canvas.getByRole("link", { name: "The Movie Database, en esta pestaña" });
    await expect(mismaPestana).not.toHaveAttribute("target");
    await expect(mismaPestana).toHaveAttribute("rel", "noopener noreferrer");

    // El enlace va en japonés; su aviso, en el idioma de la interfaz (WCAG 3.1.2).
    const japones = canvas.getByRole("link", { name: /^千と千尋の神隠し \(se abre en una pestaña nueva\)$/ });
    await expect(japones).toHaveAttribute("lang", "ja");
    await expect(japones.querySelector(".sr-only")).toHaveAttribute("lang", "es");

    // Foco de teclado: el anillo de «Sala».
    await userEvent.tab();
    await expect(interno).toHaveFocus();
    await expect(getComputedStyle(interno).outlineStyle).toBe("solid");
    await expect(getComputedStyle(interno).outlineWidth).toBe("3px");
  },
};

// ------------------------------------------------------------
// Juntos, en un trozo de ficha
// ------------------------------------------------------------

function TrozoDeFicha({ obra }: { obra: ObraDeEjemplo }) {
  return (
    <Suelo titulo={obra.titulo} nota={`${obra.formato}. ${NOTA_PALETA}`} palette={obra.palette}>
      <div className="grid max-w-3xl gap-6">
        {obra.original ? (
          <p lang={obra.original.lang} className="font-sala-display text-3xl font-bold">
            {obra.original.texto}
          </p>
        ) : null}
        <p className="max-w-[62ch] sala-type-lead">
          {obra.sinopsis} <SalaLink href="/media/129">Leer la sinopsis entera</SalaLink>
        </p>
        <div className="flex flex-wrap gap-3">
          <SalaButton icon={<IconoMas />}>Guardar en la biblioteca</SalaButton>
          <SalaButton variant="secondary">Ver el tráiler</SalaButton>
          <SalaButton variant="quiet">Añadir a una lista</SalaButton>
        </div>
        <div className="bg-sala-panel p-5">
          <p>
            Datos de <SalaLink href={TMDB}>The Movie Database</SalaLink>.
          </p>
          <SalaLink variant="standalone" href="/discover">
            Ver obras parecidas
          </SalaLink>
        </div>
      </div>
    </Suelo>
  );
}

/** Botones y enlaces juntos, con tres obras de tres formatos y sus títulos originales. */
export const EnUnaFicha: Story = {
  name: "Con botones, en una ficha",
  render: () => (
    <>
      {OBRAS.map((obra) => (
        <TrozoDeFicha key={obra.titulo} obra={obra} />
      ))}
    </>
  ),
};

// ------------------------------------------------------------
// Las mismas en claro, para que axe las pase en los dos temas.
// ------------------------------------------------------------

const SOLO_PRUEBA = { globals: { tema: "claro" }, tags: ["!dev"] };

export const EnLineaEnClaro: Story = { ...EnLinea, ...SOLO_PRUEBA };
export const SueltoEnClaro: Story = { ...Suelto, ...SOLO_PRUEBA };
export const EstadosEnClaro: Story = { ...LosEstados, ...SOLO_PRUEBA };
export const SobreUnPanelEnClaro: Story = { ...SobreUnPanel, ...SOLO_PRUEBA };
export const EnUnaFichaEnClaro: Story = { ...EnUnaFicha, ...SOLO_PRUEBA };
export const DestinosEnClaro: Story = { ...Destinos, ...SOLO_PRUEBA };
