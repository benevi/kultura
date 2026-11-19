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
  play: async ({ canvas }) => {
    // Biblia §9: 48 px o más de alto, medidos en el navegador, en cada variante.
    const botones = canvas.getAllByRole("button");
    await expect(botones).toHaveLength(VARIANTES.length * 2);
    for (const boton of botones) {
      await expect(boton.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    }
  },
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

/**
 * Al pulsar encoge el contenido, no la caja. Si encogiera la caja, quien pulsa
 * a 1 px del borde soltaría fuera y el clic se perdería.
 */
export const PulsadoEnElBorde: Story = {
  name: "Pulsado: la caja no encoge",
  render: (args) => (
    <Suelo titulo="Pulsado" nota="Tinta y el contenido un punto más pequeño. La caja mide lo mismo que en reposo: un clic en el mismo borde cuenta.">
      <div className="flex flex-wrap gap-4">
        {VARIANTES.map(({ variant, texto }) => (
          <div key={variant} className="grid gap-4">
            <SalaButton variant={variant}>{texto}</SalaButton>
            <SalaButton variant={variant} data-sala-force="pressed" data-testid={`pulsado-${variant}`} onClick={args.onClick}>
              {texto}
            </SalaButton>
          </div>
        ))}
      </div>
    </Suelo>
  ),
  play: async ({ args, canvas, userEvent }) => {
    for (const { variant, texto } of VARIANTES) {
      const [reposo, pulsado] = canvas.getAllByRole("button", { name: texto });
      await expect(pulsado).toBe(canvas.getByTestId(`pulsado-${variant}`));
      const caja = pulsado.getBoundingClientRect();
      // La caja pulsada mide lo mismo que en reposo y no lleva transformación…
      await expect(caja.width).toBe(reposo.getBoundingClientRect().width);
      await expect(caja.height).toBe(reposo.getBoundingClientRect().height);
      await expect(getComputedStyle(pulsado).transform).toBe("none");
      // …la lleva el contenido.
      await expect(getComputedStyle(pulsado.firstElementChild!).transform).toBe("matrix(0.96, 0, 0, 0.96, 0, 0)");
      // A 1 px de cada esquina, lo que hay bajo el puntero sigue siendo el botón.
      pulsado.scrollIntoView({ block: "center" });
      const { left, top, right, bottom } = pulsado.getBoundingClientRect();
      const esquinas = [
        [left + 1, top + 1],
        [right - 1, top + 1],
        [left + 1, bottom - 1],
        [right - 1, bottom - 1],
      ];
      for (const [x, y] of esquinas) {
        const debajo = document.elementFromPoint(x, y);
        await expect(debajo?.closest("button")).toBe(pulsado);
        // Y un clic ahí, con el botón pulsado, llega a `onClick`.
        await userEvent.pointer([
          { keys: "[MouseLeft>]", target: debajo!, coords: { clientX: x, clientY: y } },
          { keys: "[/MouseLeft]", target: debajo!, coords: { clientX: x, clientY: y } },
        ]);
      }
    }
    await expect(args.onClick).toHaveBeenCalledTimes(VARIANTES.length * 4);
  },
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
  play: async ({ canvas, userEvent }) => {
    const [enlace] = canvas.getAllByRole("link", { name: "Ir a tu biblioteca" });
    await expect(enlace.tagName).toBe("A");
    // El enlace de next-intl pone el idioma.
    await expect(enlace).toHaveAttribute("href", "/es/library");
    await expect(Math.round(enlace.getBoundingClientRect().height)).toBeGreaterThanOrEqual(48);

    // Deshabilitado sigue en el orden de tabulación, pero Enter no navega.
    const parado = canvas.getAllByRole("link", { name: "Ir a tu biblioteca" }).find((a) => a.getAttribute("aria-disabled") === "true")!;
    const clics: boolean[] = [];
    const escucha = (event: MouseEvent) => {
      clics.push(event.defaultPrevented);
      event.preventDefault();
    };
    document.addEventListener("click", escucha);
    try {
      parado.focus();
      await expect(parado).toHaveFocus();
      await userEvent.keyboard("{Enter}");
    } finally {
      document.removeEventListener("click", escucha);
    }
    // Enter llegó como clic y el botón ya lo había anulado al subir.
    await expect(clics).toEqual([true]);
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
      {/* Una sola palabra más ancha que la columna: se parte. */}
      <SalaButton variant="secondary" icon={<IconoMas />}>
        Guardar Donaudampfschifffahrtsgesellschaftskapitänsmütze
      </SalaButton>
      <SalaButton asChild variant="quiet">
        <Link href="/library">kultura.example/listas/pendientes-de-este-invierno-y-del-que-viene</Link>
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
  play: async ({ canvas }) => {
    // Ningún botón es más ancho que su columna (20rem), ni con una palabra sin cortes.
    for (const control of [...canvas.getAllByRole("button"), ...canvas.getAllByRole("link")]) {
      const columna = control.parentElement!.getBoundingClientRect();
      const caja = control.getBoundingClientRect();
      await expect(caja.width).toBeLessThanOrEqual(columna.width);
      await expect(caja.right).toBeLessThanOrEqual(columna.right);
      await expect(control.scrollWidth).toBeLessThanOrEqual(control.clientWidth);
    }
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
  },
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

const alEnviar = fn((event: React.FormEvent) => event.preventDefault());

export const Cargando: Story = {
  render: (args) => (
    <>
      <Suelo
        titulo="Cargando"
        nota="El texto sigue a la vista y debajo se encienden tres cuadrados por turnos; a los 4,4 s se quedan los tres encendidos y quietos (con movimiento reducido, desde el principio). No se puede volver a pulsar, conserva el foco y la medida, y el lector de pantalla oye «Guardando…»."
      >
        <div className="flex flex-wrap gap-4">
          <SalaButton loading loadingLabel="Guardando…" onClick={args.onClick}>
            Guardar en la biblioteca
          </SalaButton>
          <SalaButton loading={false} loadingLabel="Guardando…" onClick={args.onClick}>
            Guardar en la biblioteca
          </SalaButton>
        </div>
        <form onSubmit={alEnviar} className="mt-10 flex max-w-xl flex-wrap items-end gap-4">
          <label className="grid flex-1 gap-2 sala-type-label">
            Nombre de la lista
            <input
              name="lista"
              defaultValue="Pendientes"
              className="min-h-sala-target border-2 border-sala-ink bg-transparent px-3 text-sala-ink sala-type-text sala-focused:sala-focus"
            />
          </label>
          <SalaButton type="submit" loading loadingLabel="Creando la lista…">
            Crear la lista
          </SalaButton>
        </form>
      </Suelo>
      <EnLosDosSuelos>
        <Muestras titulo="En cada variante">
          {VARIANTES.map(({ variant, nombre, texto }) => (
            <Muestra key={variant} pie={nombre}>
              <SalaButton variant={variant} loading loadingLabel="Cargando…">
                {texto}
              </SalaButton>
            </Muestra>
          ))}
          <Muestra pie="Con icono">
            <SalaButton icon={<IconoMas />} loading loadingLabel="Cargando…">
              Añadir a una lista
            </SalaButton>
          </Muestra>
          <Muestra pie="Solo icono">
            <SalaButton variant="secondary" icon={<IconoMas />} label="Añadir a una lista" loading loadingLabel="Cargando…" />
          </Muestra>
          <Muestra pie="En dos líneas">
            <SalaButton variant="secondary" className="max-w-[14rem]" loading loadingLabel="Cargando…">
              Guardar y marcar como pendiente
            </SalaButton>
          </Muestra>
        </Muestras>
      </EnLosDosSuelos>
    </>
  ),
  play: async ({ args, canvas, userEvent }) => {
    alEnviar.mockClear();
    const [cargando, reposo] = canvas.getAllByRole("button", { name: "Guardar en la biblioteca" });
    // Misma medida que en reposo.
    await expect(cargando.getBoundingClientRect().width).toBe(reposo.getBoundingClientRect().width);
    await expect(cargando.getBoundingClientRect().height).toBe(reposo.getBoundingClientRect().height);
    await expect(cargando).toHaveAttribute("aria-busy", "true");
    await expect(canvas.getAllByRole("status")[0]).toHaveTextContent("Guardando…");

    // Biblia §6, nada oculto: el texto se ve entero, sin atenuar.
    const texto = canvas.getAllByText("Guardar en la biblioteca")[0];
    for (let el: HTMLElement | null = texto; el && el !== cargando.parentElement; el = el.parentElement) {
      await expect(getComputedStyle(el).opacity).toBe("1");
      await expect(getComputedStyle(el).visibility).toBe("visible");
    }

    // La espera: tres cuadrados que caben bajo el texto, dentro del botón.
    const cuadrados = Array.from(cargando.querySelectorAll<HTMLElement>("[data-sala-loader] > span"));
    await expect(cuadrados).toHaveLength(3);
    const caja = cargando.getBoundingClientRect();
    for (const cuadrado of cuadrados) {
      const c = cuadrado.getBoundingClientRect();
      await expect(c.top).toBeGreaterThanOrEqual(texto.getBoundingClientRect().bottom - 1);
      await expect(c.bottom).toBeLessThanOrEqual(caja.bottom - 2);
    }
    const animaciones = cuadrados.flatMap((cuadrado) => cuadrado.getAnimations());
    if (animaciones.length > 0) {
      await expect(animaciones).toHaveLength(3);
      // Biblia §6 y WCAG 2.2.2: se para sola antes de 5 s.
      const fin = Math.max(...animaciones.map((a) => Number(a.effect!.getComputedTiming().endTime)));
      await expect(fin).toBeLessThanOrEqual(5000);
      // WCAG 1.4.11: en cualquier momento hay al menos un cuadrado encendido del todo.
      animaciones.forEach((a) => a.pause());
      let minimo = 1;
      for (let t = 0; t <= fin; t += 20) {
        animaciones.forEach((a) => (a.currentTime = t));
        minimo = Math.min(minimo, Math.max(...cuadrados.map((c) => Number(getComputedStyle(c).opacity))));
      }
      await expect(minimo).toBeGreaterThanOrEqual(0.99);
      // Y al acabar se quedan los tres encendidos.
      animaciones.forEach((a) => (a.currentTime = fin));
      for (const cuadrado of cuadrados) await expect(getComputedStyle(cuadrado).opacity).toBe("1");
      animaciones.forEach((a) => {
        a.currentTime = 0;
        a.play();
      });
    } else {
      // Con movimiento reducido: quietos y encendidos.
      for (const cuadrado of cuadrados) await expect(getComputedStyle(cuadrado).opacity).toBe("1");
    }

    // Ni el ratón ni el teclado lo vuelven a enviar, y no pierde el foco.
    await userEvent.click(cargando);
    await expect(cargando).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    await expect(args.onClick).not.toHaveBeenCalled();

    // Envío implícito: Enter en un campo del formulario pulsa su botón de
    // enviar; cargando, no envía.
    await userEvent.click(canvas.getByRole("textbox", { name: "Nombre de la lista" }));
    await userEvent.keyboard("{Enter}");
    await expect(alEnviar).not.toHaveBeenCalled();
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
export const PulsadoEnElBordeEnClaro: Story = { ...PulsadoEnElBorde, ...SOLO_PRUEBA };
export const TecladoEnClaro: Story = { ...Teclado, ...SOLO_PRUEBA };
export const CargandoEnClaro: Story = { ...Cargando, ...SOLO_PRUEBA };
export const DeshabilitadoEnClaro: Story = { ...Deshabilitado, ...SOLO_PRUEBA };
