import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";
import { Link } from "@/i18n/navigation";
import { IconoCerrar, IconoMas, IconoPapelera, IconoSeguir, Muestra, Muestras, NOTA_PALETA, OBRAS, Suelo } from "../../../.storybook/sala";
import { SalaButton, type SalaButtonVariant } from "./SalaButton";

/**
 * Botón de «Sala». Cada historia se ve sobre los neutros y sobre el color de
 * una obra; el tema se cambia con «Tema» en la barra. Las historias «en claro»
 * no salen en la barra lateral: son las mismas, para que axe las pase en los
 * dos temas.
 */
const meta = {
  title: "Sala/Botón",
  component: SalaButton,
  parameters: { layout: "fullscreen" },
  args: { children: "Guardar en la biblioteca", onClick: fn() },
  argTypes: {
    variant: { control: "inline-radio", options: ["primary", "secondary", "quiet", "danger"] },
  },
} satisfies Meta<typeof SalaButton>;

export default meta;
type Story = StoryObj<typeof meta>;

const OBRA = OBRAS[0];

const VARIANTES: Array<{ variant: SalaButtonVariant; nombre: string; texto: string; uso: string }> = [
  { variant: "primary", nombre: "Principal", texto: "Guardar en la biblioteca", uso: "La acción de la pantalla. Una por vista." },
  { variant: "secondary", nombre: "Secundario", texto: "Ver el tráiler", uso: "La que acompaña a la principal." },
  { variant: "quiet", nombre: "Discreto", texto: "Cancelar", uso: "La que no debe competir: cancelar, barras de iconos." },
  { variant: "danger", nombre: "Peligro", texto: "Quitar de la biblioteca", uso: "Borrar o salir sin vuelta atrás." },
];

/** El mismo contenido sobre los neutros y dentro de una obra. */
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
// Una sola pieza, con controles
// ------------------------------------------------------------

export const Principal: Story = {
  render: (args) => (
    <Suelo titulo="Botón">
      <SalaButton {...args} />
    </Suelo>
  ),
};

// ------------------------------------------------------------
// Variantes
// ------------------------------------------------------------

function Variantes() {
  return (
    <dl className="grid gap-8 sm:grid-cols-2">
      {VARIANTES.map(({ variant, nombre, texto, uso }) => (
        <div key={variant}>
          <dt className="sala-type-data">{nombre}</dt>
          <dd className="mt-1 text-sala-ink-secondary sala-type-small">{uso}</dd>
          <dd className="mt-4">
            <SalaButton variant={variant}>{texto}</SalaButton>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export const LasVariantes: Story = {
  name: "Variantes",
  render: () => (
    <EnLosDosSuelos>
      <Variantes />
    </EnLosDosSuelos>
  ),
};

// ------------------------------------------------------------
// Estados
// ------------------------------------------------------------

/**
 * Hover, foco y pulsado se enseñan quietos con `data-sala-force`, que solo
 * existe en Storybook. Las reglas son las mismas que las del estado de verdad.
 */
function Estados() {
  return (
    <>
      {VARIANTES.map(({ variant, nombre, texto }) => (
        <Muestras key={variant} titulo={nombre}>
          <Muestra pie="Reposo">
            <SalaButton variant={variant}>{texto}</SalaButton>
          </Muestra>
          <Muestra pie="Con el puntero encima">
            <SalaButton variant={variant} data-sala-force="hover">
              {texto}
            </SalaButton>
          </Muestra>
          <Muestra pie="Con el foco del teclado">
            <SalaButton variant={variant} data-sala-force="focus">
              {texto}
            </SalaButton>
          </Muestra>
          <Muestra pie="Pulsado">
            <SalaButton variant={variant} data-sala-force="pressed">
              {texto}
            </SalaButton>
          </Muestra>
          <Muestra pie="Deshabilitado">
            <SalaButton variant={variant} disabled>
              {texto}
            </SalaButton>
          </Muestra>
          <Muestra pie="Cargando">
            <SalaButton variant={variant} loading loadingLabel="Cargando…">
              {texto}
            </SalaButton>
          </Muestra>
        </Muestras>
      ))}
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
};

/** Los mismos estados sobre un panel, que es un paso de tono sobre el fondo. */
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
// Icono
// ------------------------------------------------------------

function Iconos() {
  return (
    <>
      <Muestras titulo="Con icono">
        <Muestra pie="Icono delante">
          <SalaButton icon={<IconoMas />}>Añadir a una lista</SalaButton>
        </Muestra>
        <Muestra pie="Icono detrás">
          <SalaButton variant="secondary" icon={<IconoSeguir />} iconPosition="end">
            Seguir por donde ibas
          </SalaButton>
        </Muestra>
        <Muestra pie="Peligro">
          <SalaButton variant="danger" icon={<IconoPapelera />}>
            Quitar de la biblioteca
          </SalaButton>
        </Muestra>
      </Muestras>
      <Muestras titulo="Solo icono, de 48 por 48">
        {VARIANTES.map(({ variant, nombre }) => (
          <Muestra key={variant} pie={nombre}>
            <SalaButton variant={variant} icon={variant === "danger" ? <IconoPapelera /> : <IconoCerrar />} label={variant === "danger" ? "Quitar de la biblioteca" : "Cerrar"} />
          </Muestra>
        ))}
        <Muestra pie="Con el puntero encima">
          <SalaButton variant="quiet" icon={<IconoCerrar />} label="Cerrar" data-sala-force="hover" />
        </Muestra>
        <Muestra pie="Con el foco">
          <SalaButton variant="quiet" icon={<IconoCerrar />} label="Cerrar" data-sala-force="focus" />
        </Muestra>
        <Muestra pie="Deshabilitado">
          <SalaButton variant="quiet" icon={<IconoCerrar />} label="Cerrar" disabled />
        </Muestra>
        <Muestra pie="Cargando">
          <SalaButton variant="secondary" icon={<IconoMas />} label="Añadir a una lista" loading loadingLabel="Cargando…" />
        </Muestra>
      </Muestras>
    </>
  );
}

export const ConIcono: Story = {
  name: "Con icono y solo icono",
  render: () => (
    <EnLosDosSuelos>
      <Iconos />
    </EnLosDosSuelos>
  ),
  play: async ({ canvas }) => {
    // El nombre de un botón de solo icono es su `label`; mide 48 × 48.
    const [cerrar] = canvas.getAllByRole("button", { name: "Cerrar" });
    const caja = cerrar.getBoundingClientRect();
    await expect(Math.round(caja.width)).toBe(48);
    await expect(Math.round(caja.height)).toBe(48);
  },
};

// ------------------------------------------------------------
// Como enlace
// ------------------------------------------------------------

function ComoEnlaces() {
  return (
    <Muestras titulo="Un enlace con el aspecto del botón">
      <Muestra pie="Principal">
        <SalaButton asChild>
          <Link href="/library">Ir a tu biblioteca</Link>
        </SalaButton>
      </Muestra>
      <Muestra pie="Secundario, con icono">
        <SalaButton asChild variant="secondary" icon={<IconoSeguir />} iconPosition="end">
          <Link href="/discover">Descubrir más obras</Link>
        </SalaButton>
      </Muestra>
      <Muestra pie="Solo icono">
        <SalaButton asChild variant="quiet" icon={<IconoCerrar />} label="Volver a la biblioteca">
          <Link href="/library" />
        </SalaButton>
      </Muestra>
      <Muestra pie="Deshabilitado">
        <SalaButton asChild disabled>
          <Link href="/library">Ir a tu biblioteca</Link>
        </SalaButton>
      </Muestra>
    </Muestras>
  );
}

export const ComoEnlace: Story = {
  name: "Como enlace",
  render: () => (
    <EnLosDosSuelos>
      <ComoEnlaces />
    </EnLosDosSuelos>
  ),
  play: async ({ canvas }) => {
    const [enlace] = canvas.getAllByRole("link", { name: "Ir a tu biblioteca" });
    await expect(enlace.tagName).toBe("A");
    // El enlace de next-intl pone el idioma.
    await expect(enlace).toHaveAttribute("href", "/es/library");
    await expect(Math.round(enlace.getBoundingClientRect().height)).toBeGreaterThanOrEqual(48);
  },
};

// ------------------------------------------------------------
// Textos largos y otras escrituras
// ------------------------------------------------------------

function Textos() {
  return (
    <div className="grid max-w-xs gap-4">
      <SalaButton>Guardar «El viaje de Chihiro» en tu biblioteca y marcarla como pendiente</SalaButton>
      <SalaButton variant="secondary" lang="ja">
        千と千尋の神隠しを保存
      </SalaButton>
      <SalaButton variant="secondary" lang="ko">
        기생충 저장하기
      </SalaButton>
      <SalaButton variant="quiet" icon={<IconoMas />} className="w-full">
        A todo el ancho
      </SalaButton>
    </div>
  );
}

/** Un texto largo salta de línea y el botón crece: nunca se corta ni se sale. */
export const TextoLargo: Story = {
  name: "Texto largo y otras escrituras",
  render: () => (
    <EnLosDosSuelos>
      <Textos />
    </EnLosDosSuelos>
  ),
};

// ------------------------------------------------------------
// Comportamiento: teclado, foco y carga
// ------------------------------------------------------------

export const Teclado: Story = {
  name: "Teclado y foco",
  render: (args) => (
    <Suelo titulo="Teclado" nota="Tab lo enfoca; Enter y Espacio lo pulsan. El foco es un anillo de 3 px con la tinta.">
      <SalaButton {...args} />
    </Suelo>
  ),
  play: async ({ args, canvas, userEvent }) => {
    const boton = canvas.getByRole("button", { name: "Guardar en la biblioteca" });
    await userEvent.tab();
    await expect(boton).toHaveFocus();
    const estilo = getComputedStyle(boton);
    await expect(estilo.outlineStyle).toBe("solid");
    await expect(estilo.outlineWidth).toBe("3px");
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    await expect(args.onClick).toHaveBeenCalledTimes(2);
  },
};

export const Cargando: Story = {
  render: (args) => (
    <Suelo titulo="Cargando" nota="No se puede volver a pulsar, conserva el foco y el ancho, y el lector de pantalla oye «Guardando…».">
      <div className="flex flex-wrap gap-4">
        <SalaButton loading loadingLabel="Guardando…" onClick={args.onClick}>
          Guardar en la biblioteca
        </SalaButton>
        <SalaButton loading={false} loadingLabel="Guardando…" onClick={args.onClick}>
          Guardar en la biblioteca
        </SalaButton>
      </div>
    </Suelo>
  ),
  play: async ({ args, canvas, userEvent }) => {
    const [cargando, reposo] = canvas.getAllByRole("button", { name: "Guardar en la biblioteca" });
    // Mismo ancho que en reposo.
    await expect(cargando.getBoundingClientRect().width).toBe(reposo.getBoundingClientRect().width);
    await expect(cargando).toHaveAttribute("aria-busy", "true");
    await expect(canvas.getAllByRole("status")[0]).toHaveTextContent("Guardando…");
    // Ni el ratón ni el teclado lo vuelven a enviar, y no pierde el foco.
    await userEvent.click(cargando);
    await expect(cargando).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

export const Deshabilitado: Story = {
  args: { disabled: true },
  render: (args) => (
    <Suelo titulo="Deshabilitado" nota="Borde discontinuo y gris en todas las variantes: no se dice solo con el color.">
      <SalaButton {...args} />
    </Suelo>
  ),
  play: async ({ args, canvas, userEvent }) => {
    const boton = canvas.getByRole("button", { name: "Guardar en la biblioteca" });
    await expect(boton).toBeDisabled();
    await userEvent.click(boton);
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

// ------------------------------------------------------------
// Las mismas en claro, para que axe las pase en los dos temas.
// ------------------------------------------------------------

const SOLO_PRUEBA = { globals: { tema: "claro" }, tags: ["!dev"] };

export const VariantesEnClaro: Story = { ...LasVariantes, ...SOLO_PRUEBA };
export const EstadosEnClaro: Story = { ...LosEstados, ...SOLO_PRUEBA };
export const SobreUnPanelEnClaro: Story = { ...SobreUnPanel, ...SOLO_PRUEBA };
export const ConIconoEnClaro: Story = { ...ConIcono, ...SOLO_PRUEBA };
export const ComoEnlaceEnClaro: Story = { ...ComoEnlace, ...SOLO_PRUEBA };
export const TextoLargoEnClaro: Story = { ...TextoLargo, ...SOLO_PRUEBA };
