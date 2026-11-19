import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { IconoCerrar, IconoLupa, Muestras, NOTA_PALETA, OBRAS, Suelo, contraste, fondoDe } from "../../../.storybook/sala";
import { SalaButton } from "./SalaButton";
import { SalaInput } from "./SalaInput";
import { SalaSelect } from "./SalaSelect";
import { SalaTextarea } from "./SalaTextarea";

/**
 * Campo de texto, área de texto y desplegable de «Sala»: la misma caja y la
 * misma pieza de campo (etiqueta, ayuda, error, contador). Cada historia va
 * sobre los neutros y sobre el color de una obra; las «en claro» son las
 * mismas, para que axe las pase en los dos temas.
 */
const meta = {
  title: "Sala/Campo de texto",
  component: SalaInput,
  parameters: { layout: "fullscreen" },
  args: { label: "Nombre de la lista", name: "nombre" },
  argTypes: {
    type: { control: "select", options: ["text", "email", "password", "search", "number", "tel", "url", "date"] },
  },
} satisfies Meta<typeof SalaInput>;

export default meta;
type Story = StoryObj<typeof meta>;

const OBRA = OBRAS[2];

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

/** Una muestra: el campo con su ancho y, debajo, qué estado es. */
function Caso({ pie, children }: { pie: string; children: React.ReactNode }) {
  return (
    <li className="grid w-72 max-w-full content-start gap-3">
      {children}
      <span className="text-sala-ink-secondary sala-type-small">{pie}</span>
    </li>
  );
}

const contador = (largo: number, tope: number) => `${largo} de ${tope}`;

const FORMATOS = (
  <>
    <option value="">Elige un formato</option>
    <option value="movie">Película</option>
    <option value="series">Serie</option>
    <option value="anime">Anime</option>
    <option value="manga">Manga</option>
    <option value="book">Libro</option>
    <option value="game">Videojuego</option>
  </>
);

// ------------------------------------------------------------
// Una sola pieza, con controles
// ------------------------------------------------------------

export const Principal: Story = {
  render: (args) => (
    <Suelo titulo="Campo de texto">
      <div className="max-w-md">
        <SalaInput {...args} />
      </div>
    </Suelo>
  ),
};

// ------------------------------------------------------------
// Tipos
// ------------------------------------------------------------

function Tipos() {
  return (
    <Muestras titulo="Lo que cubre">
      <Caso pie="Texto">
        <SalaInput label="Nombre de la lista" name="lista" autoComplete="off" defaultValue="Pendientes de este invierno" />
      </Caso>
      <Caso pie="Correo: teclado de correo, sin corrector">
        <SalaInput label="Correo" type="email" name="email" autoComplete="email" defaultValue="chihiro@example.org" />
      </Caso>
      <Caso pie="Contraseña, con botón para verla">
        <SalaInput
          label="Contraseña"
          type="password"
          name="password"
          autoComplete="current-password"
          revealLabel="Mostrar contraseña"
          defaultValue="aburaya-1988"
        />
      </Caso>
      <Caso pie="Búsqueda, con lupa de adorno y botón de borrar">
        <SalaInput
          label="Buscar una obra"
          type="search"
          name="q"
          autoComplete="off"
          enterKeyHint="search"
          defaultValue="Berserk"
          leading={<IconoLupa />}
          trailing={<SalaButton variant="quiet" icon={<IconoCerrar />} label="Borrar la búsqueda" />}
        />
      </Caso>
      <Caso pie="Número: teclado numérico">
        <SalaInput label="Capítulo por el que vas" type="number" name="capitulo" inputMode="numeric" min={0} max={364} defaultValue={128} />
      </Caso>
      <Caso pie="Fecha: el selector del sistema">
        <SalaInput label="Cuándo la terminaste" type="date" name="fecha" defaultValue="2026-11-18" />
      </Caso>
      <Caso pie="Área de texto">
        <SalaTextarea label="Tu reseña" name="resena" defaultValue="La vi de pequeña y me dio miedo. Ahora me da pena que se acabe." />
      </Caso>
      <Caso pie="Desplegable: el del sistema">
        <SalaSelect label="Formato" name="formato" defaultValue="anime">
          {FORMATOS}
        </SalaSelect>
      </Caso>
    </Muestras>
  );
}

export const LosTipos: Story = {
  name: "Tipos",
  render: () => (
    <EnLosDosSuelos>
      <Tipos />
    </EnLosDosSuelos>
  ),
  play: async ({ canvas }) => {
    const controles = [...canvas.getAllByRole("textbox"), ...canvas.getAllByRole("searchbox"), ...canvas.getAllByRole("spinbutton"), ...canvas.getAllByRole("combobox")];
    // Seis campos de texto (la contraseña y la fecha no tienen papel de «textbox») y el desplegable, en cada suelo.
    await expect(controles).toHaveLength(12);
    for (const control of [...controles, ...canvas.getAllByLabelText("Contraseña"), ...canvas.getAllByLabelText("Cuándo la terminaste")]) {
      const estilo = getComputedStyle(control);
      // Biblia §9: 48 px o más. iOS: letra de 16 px o más para no ampliar la página.
      await expect(control.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
      await expect(parseFloat(estilo.fontSize)).toBeGreaterThanOrEqual(16);
      // Biblia §1: esquinas rectas, sin sombras.
      await expect(estilo.borderRadius).toBe("0px");
      await expect(estilo.boxShadow).toBe("none");
      // WCAG 1.4.11: el borde, 3:1 o más contra lo que tiene detrás.
      await expect(contraste(estilo.borderTopColor, fondoDe(control))).toBeGreaterThanOrEqual(3);
      // Y la letra, 4,5:1 o más.
      await expect(contraste(estilo.color, fondoDe(control))).toBeGreaterThanOrEqual(4.5);
    }
    // WCAG 1.3.5: el tipo y el autocompletado llegan al control.
    const [correo] = canvas.getAllByLabelText("Correo");
    await expect(correo).toHaveAttribute("type", "email");
    await expect(correo).toHaveAttribute("autocomplete", "email");
    await expect(correo).toHaveAttribute("autocapitalize", "none");
    await expect(canvas.getAllByLabelText("Capítulo por el que vas")[0]).toHaveAttribute("inputmode", "numeric");
    // El botón de dentro del campo también mide 48 × 48.
    for (const boton of canvas.getAllByRole("button")) {
      await expect(Math.round(boton.getBoundingClientRect().width)).toBe(48);
      await expect(Math.round(boton.getBoundingClientRect().height)).toBe(48);
    }
  },
};

// ------------------------------------------------------------
// Estados
// ------------------------------------------------------------

/**
 * Hover y foco se enseñan quietos con `data-sala-force`, que solo existe en
 * Storybook. Las reglas son las mismas que las del estado de verdad.
 */
function Estados() {
  return (
    <>
      <Muestras titulo="Campo">
        <Caso pie="Reposo, vacío">
          <SalaInput label="Nombre de la lista" name="e1" />
        </Caso>
        <Caso pie="Con el puntero encima">
          <SalaInput label="Nombre de la lista" name="e2" data-sala-force="hover" />
        </Caso>
        <Caso pie="Con el foco">
          <SalaInput label="Nombre de la lista" name="e3" data-sala-force="focus" />
        </Caso>
        <Caso pie="Relleno">
          <SalaInput label="Nombre de la lista" name="e4" defaultValue="Pendientes de este invierno" />
        </Caso>
        <Caso pie="Con ejemplo dentro (no es la etiqueta)">
          <SalaInput label="Nombre de la lista" name="e5" placeholder="Pendientes de este invierno" />
        </Caso>
        <Caso pie="Con ayuda">
          <SalaInput label="Nombre de usuario" name="e6" hint="Entre 3 y 20 letras, números o guiones. Se ve en tu perfil." defaultValue="chihiro" />
        </Caso>
        <Caso pie="Obligatorio">
          <SalaInput label="Nombre de la lista" name="e7" required requirement="obligatorio" />
        </Caso>
        <Caso pie="Opcional">
          <SalaInput label="Enlace a tu web" name="e8" type="url" requirement="opcional" />
        </Caso>
        <Caso pie="Error: icono y texto, no solo el borde">
          <SalaInput label="Correo" name="e9" type="email" defaultValue="chihiro@" error="Falta lo que va detrás de la arroba. Por ejemplo: chihiro@example.org" />
        </Caso>
        <Caso pie="Error con el foco">
          <SalaInput label="Correo" name="e10" type="email" defaultValue="chihiro@" error="Falta lo que va detrás de la arroba." data-sala-force="focus" />
        </Caso>
        <Caso pie="Solo lectura: una raya, sin caja">
          <SalaInput label="Correo de la cuenta" name="e11" readOnly defaultValue="chihiro@example.org" hint="Se cambia desde Ajustes." />
        </Caso>
        <Caso pie="Deshabilitado: borde discontinuo">
          <SalaInput label="Nombre de la lista" name="e12" disabled defaultValue="Pendientes de este invierno" />
        </Caso>
        <Caso pie="Contador">
          <SalaInput label="Nombre de la lista" name="e13" maxLength={60} counter={contador} defaultValue="Pendientes de este invierno" />
        </Caso>
        <Caso pie="Contador en el tope: tinta y negrita">
          <SalaInput label="Etiqueta" name="e14" maxLength={12} counter={contador} defaultValue="Para llorar." />
        </Caso>
        <Caso pie="Contraseña deshabilitada">
          <SalaInput label="Contraseña" name="e15" type="password" revealLabel="Mostrar contraseña" disabled defaultValue="aburaya" />
        </Caso>
      </Muestras>
      <Muestras titulo="Área de texto">
        <Caso pie="Reposo">
          <SalaTextarea label="Tu reseña" name="a1" />
        </Caso>
        <Caso pie="Con el foco">
          <SalaTextarea label="Tu reseña" name="a2" data-sala-force="focus" />
        </Caso>
        <Caso pie="Con ayuda y contador">
          <SalaTextarea
            label="Tu reseña"
            name="a3"
            requirement="opcional"
            hint="Sin destripar el final."
            maxLength={500}
            counter={contador}
            defaultValue="La vi de pequeña y me dio miedo."
          />
        </Caso>
        <Caso pie="Error">
          <SalaTextarea label="Qué ha pasado" name="a4" required requirement="obligatorio" error="Cuéntanos qué ha pasado, aunque sea en una frase." />
        </Caso>
        <Caso pie="Solo lectura">
          <SalaTextarea label="Tu reseña" name="a5" readOnly rows={2} defaultValue="La vi de pequeña y me dio miedo." />
        </Caso>
        <Caso pie="Deshabilitado">
          <SalaTextarea label="Tu reseña" name="a6" disabled defaultValue="La vi de pequeña y me dio miedo." />
        </Caso>
      </Muestras>
      <Muestras titulo="Desplegable">
        <Caso pie="Reposo, sin elegir">
          <SalaSelect label="Formato" name="s1">
            {FORMATOS}
          </SalaSelect>
        </Caso>
        <Caso pie="Con el puntero encima">
          <SalaSelect label="Formato" name="s2" data-sala-force="hover">
            {FORMATOS}
          </SalaSelect>
        </Caso>
        <Caso pie="Con el foco">
          <SalaSelect label="Formato" name="s3" data-sala-force="focus">
            {FORMATOS}
          </SalaSelect>
        </Caso>
        <Caso pie="Elegido">
          <SalaSelect label="Formato" name="s4" defaultValue="manga">
            {FORMATOS}
          </SalaSelect>
        </Caso>
        <Caso pie="Error">
          <SalaSelect label="Formato" name="s5" required requirement="obligatorio" error="Elige un formato para poder guardarla.">
            {FORMATOS}
          </SalaSelect>
        </Caso>
        <Caso pie="Deshabilitado">
          <SalaSelect label="Formato" name="s6" disabled defaultValue="manga">
            {FORMATOS}
          </SalaSelect>
        </Caso>
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
    // El borde de cada control que se puede usar: 3:1 o más contra su fondo, en cualquier estado.
    for (const control of canvas.getAllByRole("textbox").concat(canvas.getAllByRole("combobox"))) {
      const estilo = getComputedStyle(control);
      const borde = control.hasAttribute("readonly") ? estilo.borderBottomColor : estilo.borderTopColor;
      await expect(contraste(borde, fondoDe(control))).toBeGreaterThanOrEqual(3);
    }
    // El ejemplo de dentro (placeholder): 4,5:1 o más.
    const [conEjemplo] = canvas.getAllByPlaceholderText("Pendientes de este invierno");
    await expect(contraste(getComputedStyle(conEjemplo, "::placeholder").color, fondoDe(conEjemplo))).toBeGreaterThanOrEqual(4.5);

    // Error: no válido, descrito por su mensaje, y el mensaje lleva icono además de texto.
    const [conError] = canvas.getAllByRole("textbox", { name: "Correo" });
    await expect(conError).toHaveAttribute("aria-invalid", "true");
    await expect(conError).toHaveAccessibleDescription(/Falta lo que va detrás de la arroba/);
    const mensaje = document.getElementById(conError.getAttribute("aria-describedby")!.split(" ")[0])!;
    await expect(mensaje.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    await expect(contraste(getComputedStyle(mensaje).color, fondoDe(mensaje))).toBeGreaterThanOrEqual(4.5);

    // Obligatorio: lo dice el control; la palabra de al lado es para la vista. Opcional: entra en la descripción.
    const [obligatorio] = canvas.getAllByRole("textbox", { name: "Nombre de la lista" }).filter((c) => c.hasAttribute("required"));
    await expect(obligatorio).toBeRequired();
    const [opcional] = canvas.getAllByRole("textbox", { name: "Enlace a tu web" });
    await expect(opcional).toHaveAccessibleDescription("opcional");

    // Foco: el anillo de «Sala».
    const [conFoco] = canvas.getAllByRole("textbox").filter((c) => c.getAttribute("data-sala-force") === "focus");
    await expect(getComputedStyle(conFoco).outlineStyle).toBe("solid");
    await expect(getComputedStyle(conFoco).outlineWidth).toBe("3px");

    // Solo lectura: sin borde a los lados; se distingue por la forma.
    const [lectura] = canvas.getAllByRole("textbox", { name: "Correo de la cuenta" });
    await expect(getComputedStyle(lectura).borderLeftWidth).toBe("0px");
    await expect(getComputedStyle(lectura).borderBottomWidth).toBe("2px");
    // Deshabilitado: trazo discontinuo.
    const [parado] = canvas.getAllByRole("textbox").filter((c) => (c as HTMLInputElement).disabled);
    await expect(getComputedStyle(parado).borderTopStyle).toBe("dashed");
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
  play: async ({ canvas }) => {
    for (const control of canvas.getAllByRole("textbox").concat(canvas.getAllByRole("combobox"))) {
      const estilo = getComputedStyle(control);
      const borde = control.hasAttribute("readonly") ? estilo.borderBottomColor : estilo.borderTopColor;
      await expect(contraste(borde, fondoDe(control))).toBeGreaterThanOrEqual(3);
    }
    const [conEjemplo] = canvas.getAllByPlaceholderText("Pendientes de este invierno");
    await expect(contraste(getComputedStyle(conEjemplo, "::placeholder").color, fondoDe(conEjemplo))).toBeGreaterThanOrEqual(4.5);
  },
};

// ------------------------------------------------------------
// Contraseña
// ------------------------------------------------------------

export const Contrasena: Story = {
  name: "Contraseña: mostrar y ocultar",
  render: () => (
    <Suelo
      titulo="Contraseña"
      nota="El botón no cambia de nombre: «Mostrar contraseña», pulsado o sin pulsar. Cambia el dibujo (ojo tachado, ojo abierto). Al verla no se corrige ni se pone mayúscula."
    >
      <div className="max-w-md">
        <SalaInput
          label="Contraseña"
          type="password"
          name="password"
          autoComplete="new-password"
          hint="Ocho caracteres como poco."
          revealLabel="Mostrar contraseña"
          defaultValue="aburaya-1988"
        />
      </div>
    </Suelo>
  ),
  play: async ({ canvas, userEvent }) => {
    const campo = canvas.getByLabelText("Contraseña");
    const boton = canvas.getByRole("button", { name: "Mostrar contraseña" });
    await expect(campo).toHaveAttribute("type", "password");
    await expect(boton).toHaveAttribute("aria-pressed", "false");
    await expect(boton).toHaveAttribute("aria-controls", campo.id);
    // El botón cabe dentro del campo y no tapa lo escrito.
    const caja = campo.getBoundingClientRect();
    const b = boton.getBoundingClientRect();
    await expect(b.right).toBeLessThanOrEqual(caja.right);
    await expect(b.top).toBeGreaterThanOrEqual(caja.top);
    await expect(parseFloat(getComputedStyle(campo).paddingRight)).toBeGreaterThanOrEqual(b.width);

    await userEvent.click(boton);
    await expect(campo).toHaveAttribute("type", "text");
    await expect(boton).toHaveAttribute("aria-pressed", "true");
    await expect(canvas.getByRole("button", { name: "Mostrar contraseña" })).toBe(boton);
    await expect(campo).toHaveValue("aburaya-1988");
    await expect(campo).toHaveAttribute("spellcheck", "false");
    await expect(campo).toHaveAttribute("autocomplete", "new-password");

    // Con el teclado: Tab llega del campo al botón; Espacio la vuelve a ocultar.
    campo.focus();
    await userEvent.tab();
    await expect(boton).toHaveFocus();
    await userEvent.keyboard(" ");
    await expect(campo).toHaveAttribute("type", "password");
    await expect(boton).toHaveAttribute("aria-pressed", "false");
  },
};

// ------------------------------------------------------------
// Contador
// ------------------------------------------------------------

export const Contador: Story = {
  render: () => (
    <Suelo titulo="Contador" nota="Se lee al llegar al campo, no a cada tecla. Al tocar el tope se anuncia una vez y el texto pasa a tinta y negrita.">
      <div className="grid max-w-md gap-8">
        <SalaInput label="Etiqueta" name="etiqueta" maxLength={12} counter={contador} defaultValue="Para llorar" />
        <SalaTextarea label="Nota de la lista" name="nota" requirement="opcional" maxLength={140} counter={contador} />
      </div>
    </Suelo>
  ),
  play: async ({ canvas, userEvent }) => {
    const campo = canvas.getByRole("textbox", { name: "Etiqueta" });
    await expect(campo).toHaveAccessibleDescription("11 de 12");
    await userEvent.type(campo, "!!");
    // El tope lo pone el navegador (`maxLength`): no pasa de 12.
    await expect(campo).toHaveValue("Para llorar!");
    await expect(campo).toHaveAccessibleDescription("12 de 12");
    const cuenta = canvas.getByText("12 de 12", { selector: "p" });
    await expect(cuenta).toHaveAttribute("data-full", "true");
    await expect(Number(getComputedStyle(cuenta).fontWeight)).toBeGreaterThanOrEqual(700);

    const nota = canvas.getByRole("textbox", { name: "Nota de la lista" });
    await expect(nota).toHaveAccessibleDescription("opcional 0 de 140");
    await userEvent.type(nota, "Para ver con manta.");
    await expect(nota).toHaveAccessibleDescription("opcional 19 de 140");
  },
};

// ------------------------------------------------------------
// Textos largos, otras escrituras y 320 px
// ------------------------------------------------------------

function Largos() {
  return (
    <div className="grid w-[288px] max-w-full gap-8">
      <SalaInput
        label="Nombre con el que te van a ver tus amigos cuando compartas una lista con ellos"
        name="l1"
        required
        requirement="obligatorio"
        hint="Puedes cambiarlo cuando quieras desde Ajustes, en la sección de perfil."
        error="Ese nombre ya lo tiene otra persona. Prueba con otro o añade un número al final: chihiro2, chihiro_ogino…"
        maxLength={60}
        counter={(largo, tope) => `${largo} de ${tope} caracteres`}
        defaultValue="Donaudampfschifffahrtsgesellschaftskapitän"
      />
      <SalaInput lang="ja" label="リストの名前" name="l2" hint="あとから設定で変更できます。" error="この名前はすでに使われています。別の名前を入力してください。" defaultValue="千と千尋の神隠し" />
      <SalaInput lang="ko" label="목록 이름" name="l3" hint="나중에 설정에서 바꿀 수 있습니다." error="이미 사용 중인 이름입니다. 다른 이름을 입력해 주세요." defaultValue="기생충" />
      <SalaTextarea
        label="Enlace"
        name="l4"
        defaultValue="https://kultura.example/listas/pendientes-de-este-invierno-y-del-que-viene-si-no-me-da-tiempo"
        error="kultura.example/listas/pendientes-de-este-invierno-y-del-que-viene-si-no-me-da-tiempo no existe."
      />
      <SalaSelect label="Formato de la obra que quieres añadir a tu biblioteca" name="l5" defaultValue="largo">
        <option value="largo">Película de animación japonesa de más de dos horas</option>
      </SalaSelect>
    </div>
  );
}

/** Etiquetas, ayudas y errores largos saltan de línea; una palabra sin cortes se parte. Nada da scroll horizontal. */
export const TextoLargo: Story = {
  name: "Texto largo, otras escrituras y 320 px",
  render: () => (
    <EnLosDosSuelos>
      <Largos />
    </EnLosDosSuelos>
  ),
  play: async ({ canvasElement }) => {
    // La columna mide 288 px: lo que queda a 320 px con el margen de página.
    for (const columna of Array.from(canvasElement.querySelectorAll<HTMLElement>("section > div > div"))) {
      const limite = columna.getBoundingClientRect().right;
      await expect(columna.scrollWidth).toBeLessThanOrEqual(columna.clientWidth);
      for (const el of Array.from(columna.querySelectorAll<HTMLElement>("label, p, input, textarea, select, span"))) {
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

export const TiposEnClaro: Story = { ...LosTipos, ...SOLO_PRUEBA };
export const EstadosEnClaro: Story = { ...LosEstados, ...SOLO_PRUEBA };
export const SobreUnPanelEnClaro: Story = { ...SobreUnPanel, ...SOLO_PRUEBA };
export const ContrasenaEnClaro: Story = { ...Contrasena, ...SOLO_PRUEBA };
export const ContadorEnClaro: Story = { ...Contador, ...SOLO_PRUEBA };
export const TextoLargoEnClaro: Story = { ...TextoLargo, ...SOLO_PRUEBA };
