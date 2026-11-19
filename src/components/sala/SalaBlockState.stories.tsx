import * as React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, waitFor } from "storybook/test";
import { IconoLupa, NOTA_PALETA, OBRAS, Suelo, contraste, fondoDe } from "../../../.storybook/sala";
import { SalaBlockState } from "./SalaBlockState";
import { SalaButton } from "./SalaButton";
import { SalaLink } from "./SalaLink";

/**
 * Estado de un bloque: lo que va donde iba el contenido cuando no lo hay. El
 * de error es la pieza que comparten los `error.tsx` de la app (título,
 * explicación, reintentar y una salida); el neutro, un estado vacío.
 */
const meta = {
  title: "Sala/Estado de bloque",
  component: SalaBlockState,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SalaBlockState>;

export default meta;
type Story = StoryObj;

const OBRA = OBRAS[2];
const alReintentar = fn();

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
// Error de página: lo que pinta un `error.tsx`
// ------------------------------------------------------------

/**
 * Sustituye a la página entera: el título es el `h1` y recibe el foco al
 * aparecer, para que el lector de pantalla diga qué ha pasado. «Reintentar» es
 * la acción; la salida, un enlace.
 */
export const ErrorDePagina: Story = {
  name: "Error de página",
  render: () => (
    <main lang="es" className="min-h-screen bg-sala-background px-sala-margin text-sala-ink">
      <SalaBlockState
        tone="error"
        headingLevel={1}
        focusTitle
        className="min-h-[60vh] justify-center"
        title="Se nos ha escapado un error"
        description="No hemos podido cargar esta página. Lo que tenías guardado sigue en su sitio."
        action={<SalaButton onClick={alReintentar}>Reintentar</SalaButton>}
        secondary={
          <SalaLink variant="standalone" href="/home">
            Ir al inicio
          </SalaLink>
        }
      />
    </main>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    alReintentar.mockClear();
    const titulo = canvas.getByRole("heading", { level: 1, name: "Se nos ha escapado un error" });
    await waitFor(() => expect(titulo).toHaveFocus());
    await expect(titulo).toHaveAttribute("tabindex", "-1");
    // No es un `alert`: el foco ya hace que se lea, y con los dos se oiría dos veces.
    await expect(canvasElement.querySelector("[role=alert], [aria-live]")).toBeNull();
    // El error no es solo color: lleva su dibujo, de 3:1 o más.
    const dibujo = canvasElement.querySelector<SVGElement>("svg[data-sala-tone-icon=error]")!;
    await expect(contraste(getComputedStyle(dibujo).color, fondoDe(dibujo))).toBeGreaterThanOrEqual(3);
    // Con el teclado: del título a «Reintentar» y de ahí a la salida.
    await userEvent.tab();
    await expect(canvas.getByRole("button", { name: "Reintentar" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(alReintentar).toHaveBeenCalledTimes(1);
    await userEvent.tab();
    await expect(canvas.getByRole("link", { name: "Ir al inicio" })).toHaveFocus();
  },
};

// ------------------------------------------------------------
// Error de una sección y estado vacío
// ------------------------------------------------------------

/** Dentro de una página que sí ha cargado: encabezado de nivel 2 y sin mover el foco. */
export const ErrorDeSeccion: Story = {
  name: "Error de una sección",
  render: () => (
    <EnLosDosSuelos>
      <SalaBlockState
        tone="error"
        className="py-0"
        title="No se han podido cargar las reseñas"
        description="El resto de la ficha está bien. Puedes volver a intentarlo."
        action={<SalaButton variant="secondary">Reintentar</SalaButton>}
      />
    </EnLosDosSuelos>
  ),
  play: async ({ canvas }) => {
    const titulos = canvas.getAllByRole("heading", { level: 2, name: "No se han podido cargar las reseñas" });
    await expect(titulos).toHaveLength(2);
    for (const titulo of titulos) {
      await expect(titulo).not.toHaveAttribute("tabindex");
      await expect(titulo).not.toHaveFocus();
    }
  },
};

/** Todavía no hay nada: qué es este sitio y cuál es el primer paso. */
export const Vacio: Story = {
  name: "Estado vacío",
  render: () => (
    <EnLosDosSuelos>
      <SalaBlockState
        className="py-0"
        title="Tu biblioteca está vacía"
        description="Aquí va todo lo que ves, lees y juegas. Empieza por algo que hayas terminado hace poco."
        action={<SalaButton icon={<IconoLupa />}>Buscar una obra</SalaButton>}
        secondary={
          <SalaLink variant="standalone" href="/settings/import">
            Importar de otra app
          </SalaLink>
        }
      />
    </EnLosDosSuelos>
  ),
  play: async ({ canvasElement }) => {
    // El estado vacío no lleva dibujo de error ni color de peligro.
    await expect(canvasElement.querySelector("[data-sala-tone-icon]")).toBeNull();
    for (const texto of Array.from(canvasElement.querySelectorAll<HTMLElement>("[data-sala-block-state] > div.text-sala-ink-secondary"))) {
      await expect(contraste(getComputedStyle(texto).color, fondoDe(texto))).toBeGreaterThanOrEqual(4.5);
    }
  },
};

// ------------------------------------------------------------
// Textos largos, otras escrituras y 320 px
// ------------------------------------------------------------

export const TextoLargo: Story = {
  name: "Texto largo, otras escrituras y 320 px",
  render: () => (
    <EnLosDosSuelos>
      <div data-testid="columna" className="grid w-[288px] max-w-full gap-12">
        <SalaBlockState
          tone="error"
          className="py-0"
          title="No se ha podido cargar «El increíble castillo vagabundo» (https://kultura.example/media/movie/4935)"
          description="El catálogo ha tardado demasiado en contestar. No has perdido nada: tu nota, tu reseña y tus listas siguen guardadas."
          action={<SalaButton>Reintentar dentro de un momento</SalaButton>}
          secondary={
            <SalaLink variant="standalone" href="/home">
              Volver a la página de inicio
            </SalaLink>
          }
        />
        <div lang="ja">
          <SalaBlockState className="py-0" title="ライブラリはまだ空です" description="観た作品、読んだ本、遊んだゲームがここに並びます。" action={<SalaButton>作品を探す</SalaButton>} />
        </div>
        <div lang="ko">
          <SalaBlockState className="py-0" title="라이브러리가 비어 있습니다" description="본 작품, 읽은 책, 플레이한 게임이 여기에 모입니다." action={<SalaButton>작품 찾기</SalaButton>} />
        </div>
      </div>
    </EnLosDosSuelos>
  ),
  play: async ({ canvas }) => {
    for (const columna of canvas.getAllByTestId("columna")) {
      const limite = columna.getBoundingClientRect().right;
      await expect(columna.scrollWidth).toBeLessThanOrEqual(columna.clientWidth);
      for (const el of Array.from(columna.querySelectorAll<HTMLElement>("h2, div, a, button"))) {
        await expect(el.getBoundingClientRect().right).toBeLessThanOrEqual(limite + 1);
      }
    }
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
  },
};

// ------------------------------------------------------------
// Las mismas en claro, para que axe las pase en los dos temas.
// ------------------------------------------------------------

const SOLO_PRUEBA = { globals: { tema: "claro" }, tags: ["!dev"] };

export const ErrorDePaginaEnClaro: Story = { ...ErrorDePagina, ...SOLO_PRUEBA };
export const ErrorDeSeccionEnClaro: Story = { ...ErrorDeSeccion, ...SOLO_PRUEBA };
export const VacioEnClaro: Story = { ...Vacio, ...SOLO_PRUEBA };
export const TextoLargoEnClaro: Story = { ...TextoLargo, ...SOLO_PRUEBA };
