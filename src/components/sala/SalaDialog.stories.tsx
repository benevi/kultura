import * as React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, screen, waitFor, within } from "storybook/test";
import { EN_PRUEBAS, IconoPapelera, NOTA_PALETA, OBRAS, Suelo, contraste, fijarVentana } from "../../../.storybook/sala";
import type { ImagePalette } from "@/lib/design/image-palette";
import { SalaButton } from "./SalaButton";
import { SalaConfirmDialog } from "./SalaConfirmDialog";
import { SalaDialog } from "./SalaDialog";
import { SalaForm } from "./SalaForm";
import { SalaInput } from "./SalaInput";
import { SalaTextarea } from "./SalaTextarea";

/**
 * Diálogo de «Sala». Cada historia lo abre con un botón, como en la app, para
 * probar el foco de ida y de vuelta. Las que acaban con el diálogo abierto
 * son además las que mide axe y las de las capturas.
 *
 * El velo es el color de fondo al 90 %: lo de detrás se adivina y no se lee
 * (está fuera del árbol de accesibilidad y no recibe clics). El texto del
 * diálogo va sobre `sala-panel`, opaco: axe lo mide entero, sin excepciones.
 */
const meta = {
  title: "Sala/Diálogo",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const OBRA = OBRAS[1];

/** Una página con scroll detrás: así se ve que se bloquea y que nada salta. */
function Pagina({ palette, children }: { palette?: ImagePalette; children: React.ReactNode }) {
  return (
    <div className="min-h-[160vh] bg-sala-background">
      <Suelo titulo={palette ? OBRA.titulo : "Sin imagen"} nota={palette ? NOTA_PALETA : undefined} palette={palette}>
        <p className="mb-6 max-w-prose">{OBRA.sinopsis}</p>
        {children}
      </Suelo>
    </div>
  );
}

/** El diálogo, ya entrado del todo (la entrada empieza en opacidad 0). */
async function dialogo(nombre: string | RegExp, role: "dialog" | "alertdialog" = "dialog") {
  const caja = await screen.findByRole(role, { name: nombre });
  await waitFor(() => expect(getComputedStyle(caja).opacity).toBe("1"));
  return caja;
}
const cerrado = () => waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
/** Chromium tarda un cuadro en pintar el foco que devuelve Radix. */
const conFoco = (elemento: HTMLElement) => waitFor(() => expect(elemento).toHaveFocus());

// ------------------------------------------------------------
// Abrir y cerrar
// ------------------------------------------------------------

function Sencillo({ palette }: { palette?: ImagePalette }) {
  const [abierto, setAbierto] = React.useState(false);
  return (
    <Pagina palette={palette}>
      <SalaButton variant="secondary" onClick={() => setAbierto(true)}>
        Ver las normas
      </SalaButton>
      <SalaDialog
        open={abierto}
        onClose={() => setAbierto(false)}
        title="Normas de las listas públicas"
        description="Valen para cualquier lista que pueda ver otra persona."
        closeLabel="Cerrar"
        palette={palette}
        footer={
          <>
            <SalaButton variant="quiet" onClick={() => setAbierto(false)}>
              Ahora no
            </SalaButton>
            <SalaButton onClick={() => setAbierto(false)}>Entendido</SalaButton>
          </>
        }
      >
        <p>Sin destripes en el nombre ni en la descripción, y sin enlaces a copias que no sean oficiales.</p>
      </SalaDialog>
    </Pagina>
  );
}

/**
 * Lo básico: se abre con el teclado, el foco entra y no sale, el fondo queda
 * inerte y sin scroll (sin que nada salte), y se cierra con Escape, con el
 * botón y pulsando fuera. El foco vuelve siempre al botón que lo abrió.
 */
export const Abrir: Story = {
  name: "Abrir y cerrar",
  render: () => <Sencillo />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const abrir = canvas.getByRole("button", { name: "Ver las normas" });
    // Con las fuentes ya puestas: si llegan a media prueba, el botón cambia de ancho él solo.
    await document.fonts.ready;
    const antes = abrir.getBoundingClientRect();

    abrir.focus();
    await userEvent.keyboard("{Enter}");
    const caja = await dialogo("Normas de las listas públicas");
    await expect(caja).toHaveAttribute("aria-modal", "true");
    await expect(caja).toHaveAccessibleDescription("Valen para cualquier lista que pueda ver otra persona.");

    // Foco inicial: el cuerpo es solo texto y cabe, así que va a la primera acción del pie.
    await conFoco(within(caja).getByRole("button", { name: "Ahora no" }));
    // Tab y Mayús+Tab no salen.
    for (let i = 0; i < 8; i++) {
      await userEvent.tab();
      await expect(caja).toContainElement(document.activeElement as HTMLElement);
    }
    for (let i = 0; i < 4; i++) {
      await userEvent.tab({ shift: true });
      await expect(caja).toContainElement(document.activeElement as HTMLElement);
    }

    // Fondo inerte: la página sale del árbol de accesibilidad (el botón ya no se encuentra por su papel).
    await expect(canvasElement.closest('[aria-hidden="true"]')).not.toBeNull();
    await expect(canvas.queryByRole("button", { name: "Ver las normas" })).toBeNull();
    await expect(getComputedStyle(document.body).pointerEvents).toBe("none");

    // Scroll bloqueado sin salto: el botón de detrás sigue en el mismo píxel.
    await expect(getComputedStyle(document.body).overflow).toBe("hidden");
    await expect(Math.abs(abrir.getBoundingClientRect().left - antes.left)).toBeLessThan(0.5);
    await expect(Math.abs(abrir.getBoundingClientRect().width - antes.width)).toBeLessThan(0.5);

    // Color plano: ni sombra ni desenfoque, y esquinas rectas.
    const velo = caja.parentElement!;
    for (const pieza of [caja, velo]) {
      const estilo = getComputedStyle(pieza);
      await expect(estilo.boxShadow).toBe("none");
      await expect(estilo.backdropFilter).toBe("none");
      await expect(estilo.borderRadius).toBe("0px");
    }
    // El borde del panel se distingue del panel y del velo (3:1 o más).
    const borde = getComputedStyle(caja).borderTopColor;
    await expect(contraste(borde, getComputedStyle(caja).backgroundColor)).toBeGreaterThanOrEqual(3);

    // Escape cierra y devuelve el foco.
    await userEvent.keyboard("{Escape}");
    await cerrado();
    await conFoco(abrir);
    await expect(getComputedStyle(document.body).overflow).not.toBe("hidden");
    await expect(Math.abs(abrir.getBoundingClientRect().left - antes.left)).toBeLessThan(0.5);

    // El botón de cerrar, con su nombre, también.
    await userEvent.click(abrir);
    await userEvent.click(within(await dialogo("Normas de las listas públicas")).getByRole("button", { name: "Cerrar" }));
    await cerrado();
    await conFoco(abrir);

    // Pulsar dentro no cierra; pulsar el velo, sí.
    await userEvent.click(abrir);
    const otra = await dialogo("Normas de las listas públicas");
    await userEvent.click(within(otra).getByText(/Sin destripes/));
    await expect(otra).toBeVisible();
    await userEvent.click(otra.parentElement!);
    await cerrado();
    await conFoco(abrir);
  },
};

export const AbrirEnUnaObra: Story = {
  ...Abrir,
  name: "Abrir y cerrar, en una obra",
  render: () => <Sencillo palette={OBRA.palette} />,
};

// ------------------------------------------------------------
// Con un formulario dentro
// ------------------------------------------------------------

const porCorregir = (campos: number) => (campos === 1 ? "Hay 1 campo por corregir." : `Hay ${campos} campos por corregir.`);

function NuevaLista({ palette }: { palette?: ImagePalette }) {
  const [abierto, setAbierto] = React.useState(false);
  const [errorNombre, setErrorNombre] = React.useState<string>();
  const [guardando, setGuardando] = React.useState(false);
  const [fallo, setFallo] = React.useState<string | null>(null);
  const [hecho, setHecho] = React.useState("");
  const id = React.useId();

  const cerrar = () => {
    setAbierto(false);
    setErrorNombre(undefined);
    setFallo(null);
  };

  return (
    <Pagina palette={palette}>
      <SalaButton onClick={() => setAbierto(true)}>Nueva lista</SalaButton>
      <p role="status" className="mt-4 min-h-6 text-sala-success sala-type-label">
        {hecho}
      </p>
      <SalaDialog
        open={abierto}
        onClose={cerrar}
        variant="sheet"
        title="Crear una lista"
        closeLabel="Cerrar"
        dismissible={!guardando}
        error={fallo}
        palette={palette}
        footer={
          <>
            <SalaButton variant="quiet" onClick={cerrar} disabled={guardando}>
              Cancelar
            </SalaButton>
            <SalaButton type="submit" form={id} loading={guardando} loadingLabel="Creando la lista…">
              Crear la lista
            </SalaButton>
          </>
        }
      >
        <SalaForm
          id={id}
          errorSummary={porCorregir}
          className="grid gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            const nombre = String(new FormData(event.currentTarget).get("nombre") ?? "").trim();
            setFallo(null);
            setErrorNombre(nombre ? undefined : "Ponle un nombre a la lista.");
            if (!nombre) return;
            setGuardando(true);
            window.setTimeout(() => {
              setGuardando(false);
              // Para la historia: un nombre que el servidor rechaza.
              if (nombre === "Falla") return setFallo("No se ha podido crear la lista. Inténtalo otra vez dentro de un momento.");
              setHecho(`Lista «${nombre}» creada.`);
              cerrar();
            }, 400);
          }}
        >
          <SalaInput label="Nombre" name="nombre" required requirement="obligatorio" autoComplete="off" error={errorNombre} />
          <SalaTextarea label="Descripción" name="descripcion" requirement="opcional" rows={3} />
        </SalaForm>
      </SalaDialog>
    </Pagina>
  );
}

/**
 * Con `SalaForm` dentro: el foco empieza en el primer campo, no en el aspa. El
 * botón de enviar va en el pie (`form={id}`), fuera del scroll. Un fallo al
 * guardar se ve y se anuncia dentro del diálogo, que sigue abierto.
 */
export const ConFormulario: Story = {
  name: "Con un formulario",
  render: () => <NuevaLista />,
  play: async ({ canvas, userEvent }) => {
    const abrir = canvas.getByRole("button", { name: "Nueva lista" });
    await userEvent.click(abrir);
    const caja = await dialogo("Crear una lista");
    const dentro = within(caja);
    const nombre = dentro.getByRole("textbox", { name: "Nombre" });
    await conFoco(nombre);

    // La región del error existe desde que se abre, vacía.
    const alerta = caja.querySelector("[data-sala-dialog-error]")!;
    await expect(alerta).toHaveAttribute("role", "alert");
    await expect(alerta).toBeEmptyDOMElement();

    // Enviar vacío: el foco al campo, con su error.
    await userEvent.click(dentro.getByRole("button", { name: "Crear la lista" }));
    await conFoco(nombre);
    await expect(nombre).toHaveAttribute("aria-invalid", "true");

    // El servidor falla: el aviso sale dentro, una sola vez, y el diálogo sigue abierto.
    await userEvent.type(nombre, "Falla");
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(alerta).toHaveTextContent("No se ha podido crear la lista."), { timeout: 3000 });
    await expect(within(caja).getAllByRole("alert")).toHaveLength(1);
    await expect(alerta.querySelector("[aria-live]")).toBeNull();
    await expect(caja).toBeVisible();
    // No solo color: el aviso lleva su dibujo.
    await expect(alerta.querySelector("svg")).not.toBeNull();
  },
};

export const ConFormularioEnUnaObra: Story = {
  ...ConFormulario,
  name: "Con un formulario, en una obra",
  render: () => <NuevaLista palette={OBRAS[0].palette} />,
};

/** El camino bueno: guarda, se cierra, el foco vuelve y el resultado lo anuncia la página. */
export const FormularioGuardado: Story = {
  name: "Con un formulario: guardar",
  render: () => <NuevaLista />,
  play: async ({ canvas, userEvent }) => {
    const abrir = canvas.getByRole("button", { name: "Nueva lista" });
    await userEvent.click(abrir);
    const caja = await dialogo("Crear una lista");
    await userEvent.type(within(caja).getByRole("textbox", { name: "Nombre" }), "Para el invierno");
    await userEvent.keyboard("{Enter}");
    // Mientras guarda no se puede cerrar: ni Escape ni el aspa.
    await expect(within(caja).getByRole("button", { name: "Cerrar" })).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    await expect(caja).toBeVisible();
    await cerrado();
    await conFoco(abrir);
    await expect(canvas.getByRole("status")).toHaveTextContent("Lista «Para el invierno» creada.");
  },
};

// ------------------------------------------------------------
// Contenido que no cabe
// ------------------------------------------------------------

const PARRAFOS = [
  "Una lista pública la puede ver cualquiera que tenga el enlace, tenga cuenta o no. Aparece en tu perfil y en el de quien la guarde.",
  "El nombre y la descripción no llevan destripes: quien llega a la lista todavía no ha visto lo que hay dentro. Las notas de cada obra sí pueden llevarlos, marcadas como destripe.",
  "No se admiten enlaces a copias que no sean oficiales, ni en la descripción ni en las notas. Los enlaces a tiendas, plataformas y páginas de los autores sí.",
  "Una lista con el título de una obra que no existe, o que mezcla obras para confundir con otra lista conocida, se puede retirar.",
  "Si alguien denuncia tu lista, la revisa una persona. Mientras tanto sigue a la vista; si se retira, te avisamos y te decimos por qué.",
  "Puedes pasar una lista de pública a privada cuando quieras. Quien la tuviera guardada deja de verla, y se le avisa.",
  "Estas normas valen también para las listas de un grupo. El grupo puede poner las suyas, más estrictas, en su descripción.",
];

function Largo({ palette, titulo = "Normas de las listas públicas" }: { palette?: ImagePalette; titulo?: string }) {
  const [abierto, setAbierto] = React.useState(false);
  return (
    <Pagina palette={palette}>
      <SalaButton variant="secondary" onClick={() => setAbierto(true)}>
        Leer las normas
      </SalaButton>
      <SalaDialog
        open={abierto}
        onClose={() => setAbierto(false)}
        title={titulo}
        description="Léelas antes de publicar la primera."
        closeLabel="Cerrar"
        palette={palette}
        footer={<SalaButton onClick={() => setAbierto(false)}>Entendido</SalaButton>}
      >
        <div className="grid gap-4">
          {/* Dos veces: que no quepa tampoco en una ventana alta. */}
          {[...PARRAFOS, ...PARRAFOS].map((parrafo, i) => (
            <p key={i}>{parrafo}</p>
          ))}
        </div>
      </SalaDialog>
    </Pagina>
  );
}

/** Todo lo que el diálogo pinta queda dentro de la ventana. */
async function cabeEnLaVentana(caja: HTMLElement) {
  const ventana = { ancho: document.documentElement.clientWidth, alto: window.innerHeight };
  const marco = caja.getBoundingClientRect();
  await expect(marco.left).toBeGreaterThanOrEqual(0);
  await expect(marco.right).toBeLessThanOrEqual(ventana.ancho + 0.5);
  await expect(marco.top).toBeGreaterThanOrEqual(-0.5);
  await expect(marco.bottom).toBeLessThanOrEqual(ventana.alto + 0.5);
  await expect(caja.scrollWidth).toBeLessThanOrEqual(caja.clientWidth);
  await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(ventana.ancho);
  return marco;
}

/**
 * El cuerpo tiene su scroll; la cabecera, con el botón de cerrar, y el pie se
 * quedan. Como dentro no hay ningún control, el foco va al propio cuerpo: las
 * flechas lo desplazan. A 320 px y con el texto al 200 % el diálogo sigue
 * dentro de la ventana y el botón de cerrar, a la vista.
 */
export const ContenidoLargo: Story = {
  name: "Contenido largo",
  parameters: {
    contraste: {
      revisado: {
        elmPartiallyObscured:
          "Son los párrafos del cuerpo que quedan por debajo de su scroll: axe los da por tapados por el pie. Es el mismo texto que los que sí se ven (tinta sobre sala-panel), y el `play` lo mide en todos: 4,5:1 o más.",
      },
    },
  },
  render: () => <Largo />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Leer las normas" }));
    const caja = await dialogo("Normas de las listas públicas");
    const cuerpo = caja.querySelector<HTMLElement>("[data-sala-dialog-body]")!;
    const cerrar = within(caja).getByRole("button", { name: "Cerrar" });
    const entendido = within(caja).getByRole("button", { name: "Entendido" });

    const comprobar = async () => {
      const marco = await cabeEnLaVentana(caja);
      // La cabecera y el pie no se desplazan: los dos botones están a la vista.
      for (const boton of [cerrar, entendido]) {
        const sitio = boton.getBoundingClientRect();
        await expect(sitio.top).toBeGreaterThanOrEqual(marco.top - 0.5);
        await expect(sitio.bottom).toBeLessThanOrEqual(marco.bottom + 0.5);
        await expect(sitio.height).toBeGreaterThanOrEqual(47.9);
      }
    };

    await waitFor(() => expect(cuerpo.scrollHeight).toBeGreaterThan(cuerpo.clientHeight + 1));
    await comprobar();
    // Solo texto que no cabe: el cuerpo recibe el foco y se desplaza con el teclado.
    await waitFor(() => expect(cuerpo).toHaveAttribute("tabindex", "0"));
    await conFoco(cuerpo);
    // (Las teclas de la prueba son simuladas y no desplazan: se comprueba que el cuerpo es quien se desplaza.)
    await expect(getComputedStyle(cuerpo).overflowY).toBe("auto");
    cuerpo.scrollTop = 200;
    await expect(cuerpo.scrollTop).toBe(200);
    cuerpo.scrollTop = 0;
    // Todos los párrafos, se vean ahora o no: tinta sobre el panel, 4,5:1 o más.
    for (const parrafo of Array.from(cuerpo.querySelectorAll("p"))) {
      await expect(contraste(getComputedStyle(parrafo).color, getComputedStyle(caja).backgroundColor)).toBeGreaterThanOrEqual(4.5);
    }
    // La raya que dice que hay más es de 3:1 o más contra el panel.
    await expect(contraste(getComputedStyle(cuerpo).borderTopColor, getComputedStyle(caja).backgroundColor)).toBeGreaterThanOrEqual(3);

    if (!EN_PRUEBAS) return;
    const { innerWidth: ancho, innerHeight: alto } = window;
    const raiz = document.documentElement;
    try {
      // Reflow a 320 px (WCAG 1.4.10).
      await expect(await fijarVentana(320, 568)).toBe(true);
      await comprobar();
      // Texto al 200 % (WCAG 1.4.4), todavía a 320 px.
      raiz.style.fontSize = "200%";
      await waitFor(() => expect(parseFloat(getComputedStyle(entendido).fontSize)).toBeGreaterThan(20));
      // La cabecera y el pie ya no dejan sitio al cuerpo: se desplaza el diálogo
      // entero, sigue dentro de la ventana y el botón de cerrar no se mueve.
      const rollo = caja.querySelector<HTMLElement>("[data-sala-dialog-scroll]")!;
      const desplazadoEntero = async () => {
        await waitFor(() => expect(rollo).toHaveAttribute("data-sala-dialog-scroll", "panel"));
        await expect(getComputedStyle(rollo).overflowY).toBe("auto");
        for (const hasta of [0, rollo.scrollHeight]) {
          rollo.scrollTop = hasta;
          const marco = await cabeEnLaVentana(caja);
          const sitio = cerrar.getBoundingClientRect();
          await expect(sitio.top).toBeGreaterThanOrEqual(marco.top - 0.5);
          await expect(sitio.bottom).toBeLessThanOrEqual(marco.bottom + 0.5);
          await expect(sitio.right).toBeLessThanOrEqual(marco.right + 0.5);
          // Nada lo tapa: lo que hay en su centro es él.
          await expect(cerrar.contains(document.elementFromPoint(sitio.left + sitio.width / 2, sitio.top + sitio.height / 2))).toBe(true);
        }
        // Al final del todo, la acción del pie está a la vista.
        await expect(entendido.getBoundingClientRect().bottom).toBeLessThanOrEqual(caja.getBoundingClientRect().bottom + 0.5);
      };
      await desplazadoEntero();
      // Ventana muy baja (móvil apaisado), con el texto a su tamaño: lo mismo.
      raiz.style.fontSize = "";
      await fijarVentana(568, 320);
      await desplazadoEntero();
    } finally {
      raiz.style.fontSize = "";
      await fijarVentana(ancho, alto);
      // De vuelta a como estaba: el cuerpo con su scroll, arriba del todo.
      const rollo = caja.querySelector<HTMLElement>("[data-sala-dialog-scroll]")!;
      await waitFor(() => expect(rollo).toHaveAttribute("data-sala-dialog-scroll", "body"));
      rollo.scrollTop = 0;
      cuerpo.scrollTop = 0;
    }
  },
};

/** Títulos largos y en otras escrituras: se parten y el botón de cerrar no se mueve de su esquina. */
export const TitulosLargos: Story = {
  name: "Títulos largos, japonés y coreano",
  render: () => {
    const TITULOS = [
      { boton: "Largo", titulo: "¿Quitar «El increíble castillo vagabundo y todas sus secuelas imaginarias» de la lista «Pendientes de este invierno y del que viene»?" },
      { boton: "Japonés", titulo: "千と千尋の神隠しをリストから削除しますか", lang: "ja" },
      { boton: "Coreano", titulo: "기생충을 목록에서 삭제하시겠습니까", lang: "ko" },
      { boton: "Sin espacios", titulo: "https://kultura.example/listas/pendientes-de-este-invierno-y-del-que-viene" },
    ];
    function Titulos() {
      const [cual, setCual] = React.useState<number | null>(null);
      const actual = cual === null ? null : TITULOS[cual];
      return (
        <Pagina>
          <div className="flex flex-wrap gap-3">
            {TITULOS.map((t, i) => (
              <SalaButton key={t.boton} variant="secondary" onClick={() => setCual(i)}>
                {t.boton}
              </SalaButton>
            ))}
          </div>
          <SalaDialog
            open={actual !== null}
            onClose={() => setCual(null)}
            title={<span lang={actual?.lang}>{actual?.titulo}</span>}
            closeLabel="Cerrar"
            footer={<SalaButton onClick={() => setCual(null)}>Vale</SalaButton>}
          />
        </Pagina>
      );
    }
    return <Titulos />;
  },
  play: async ({ canvas, userEvent }) => {
    for (const nombre of ["Largo", "Japonés", "Coreano", "Sin espacios"]) {
      const abrir = canvas.getByRole("button", { name: nombre });
      await userEvent.click(abrir);
      const caja = await screen.findByRole("dialog");
      await cabeEnLaVentana(caja);
      const cerrar = within(caja).getByRole("button", { name: "Cerrar" });
      // El botón de cerrar queda entero dentro del panel, arriba a la derecha.
      const marco = caja.getBoundingClientRect();
      const sitio = cerrar.getBoundingClientRect();
      await expect(sitio.right).toBeLessThanOrEqual(marco.right + 0.5);
      await expect(sitio.top - marco.top).toBeLessThan(12);
      await expect(sitio.width).toBeGreaterThanOrEqual(48);
      if (nombre === "Sin espacios") break;
      await userEvent.keyboard("{Escape}");
      await cerrado();
    }
  },
};

// ------------------------------------------------------------
// Confirmación destructiva
// ------------------------------------------------------------

function QuitarObra({ palette }: { palette?: ImagePalette }) {
  const [abierto, setAbierto] = React.useState(false);
  const [quitando, setQuitando] = React.useState(false);
  const [quitada, setQuitada] = React.useState(false);
  const volver = React.useRef<HTMLHeadingElement>(null);
  return (
    <Pagina palette={palette}>
      <h3 ref={volver} tabIndex={-1} className="mb-4 outline-none sala-type-data sala-focused:sala-focus">
        Tu biblioteca
      </h3>
      {quitada ? (
        <p role="status">«{OBRA.titulo}» ya no está en tu biblioteca.</p>
      ) : (
        <SalaButton variant="secondary" icon={<IconoPapelera />} onClick={() => setAbierto(true)}>
          Quitar de la biblioteca
        </SalaButton>
      )}
      <SalaConfirmDialog
        open={abierto}
        danger
        title={`¿Quitar «${OBRA.titulo}» de tu biblioteca?`}
        message="Se pierden tu nota, tu reseña y las fechas en que la viste. No se puede deshacer."
        cancelLabel="No, dejarla"
        confirmLabel="Quitar de la biblioteca"
        loading={quitando}
        loadingLabel="Quitando de la biblioteca…"
        finalFocusRef={volver}
        palette={palette}
        onCancel={() => setAbierto(false)}
        onConfirm={() => {
          setQuitando(true);
          window.setTimeout(() => {
            setQuitando(false);
            setQuitada(true);
            setAbierto(false);
          }, 400);
        }}
      />
    </Pagina>
  );
}

/**
 * `alertdialog`. El foco empieza en lo seguro; pulsar fuera no cierra; Escape
 * cancela. Al confirmar, el botón que lo abrió desaparece y el foco va a
 * donde diga `finalFocusRef`.
 */
export const Confirmacion: Story = {
  name: "Confirmación destructiva",
  render: () => <QuitarObra />,
  play: async ({ canvas, userEvent }) => {
    const abrir = canvas.getByRole("button", { name: "Quitar de la biblioteca" });
    await userEvent.click(abrir);
    const caja = await dialogo(/¿Quitar «El viaje de Chihiro»/, "alertdialog");
    await expect(caja).toHaveAttribute("aria-modal", "true");
    await expect(caja).toHaveAccessibleDescription(/Se pierden tu nota/);
    // Lo seguro primero, y sin aspa que repita «cancelar».
    await conFoco(within(caja).getByRole("button", { name: "No, dejarla" }));
    await expect(within(caja).getAllByRole("button")).toHaveLength(2);

    // Sin cierre accidental: pulsar fuera no hace nada.
    await userEvent.click(caja.parentElement!);
    await expect(caja).toBeVisible();
    // Escape cancela y el foco vuelve.
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await conFoco(abrir);

    // Confirmar: espera, no se puede cerrar y, al acabar, el foco va al encabezado.
    await userEvent.click(abrir);
    const otra = await dialogo(/¿Quitar/, "alertdialog");
    const quitar = within(otra).getByRole("button", { name: "Quitar de la biblioteca" });
    await userEvent.click(quitar);
    await expect(quitar).toHaveAttribute("aria-busy", "true");
    await userEvent.keyboard("{Escape}");
    await expect(otra).toBeVisible();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull(), { timeout: 3000 });
    await conFoco(canvas.getByRole("heading", { name: "Tu biblioteca" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("ya no está en tu biblioteca");
  },
};

/** Abierta y quieta: para axe y para las capturas. */
export const ConfirmacionAbierta: Story = {
  name: "Confirmación destructiva, abierta",
  render: () => <QuitarObra />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Quitar de la biblioteca" }));
    const caja = await dialogo(/¿Quitar/, "alertdialog");
    // El botón de peligro: su texto, 4,5:1 o más sobre su fondo.
    const quitar = within(caja).getByRole("button", { name: "Quitar de la biblioteca" });
    const estilo = getComputedStyle(quitar);
    await expect(contraste(estilo.color, estilo.backgroundColor)).toBeGreaterThanOrEqual(4.5);
  },
};

export const ConfirmacionAbiertaEnUnaObra: Story = {
  ...ConfirmacionAbierta,
  name: "Confirmación destructiva, abierta, en una obra",
  render: () => <QuitarObra palette={OBRA.palette} />,
};

// ------------------------------------------------------------
// Las mismas en claro, para que axe las pase en los dos temas.
// ------------------------------------------------------------

const SOLO_PRUEBA = { globals: { tema: "claro" }, tags: ["!dev"] };

export const AbrirEnClaro: Story = { ...Abrir, ...SOLO_PRUEBA };
export const AbrirEnUnaObraEnClaro: Story = { ...AbrirEnUnaObra, ...SOLO_PRUEBA };
export const ConFormularioEnClaro: Story = { ...ConFormulario, ...SOLO_PRUEBA };
export const ConFormularioEnUnaObraEnClaro: Story = { ...ConFormularioEnUnaObra, ...SOLO_PRUEBA };
export const ContenidoLargoEnClaro: Story = { ...ContenidoLargo, ...SOLO_PRUEBA };
export const TitulosLargosEnClaro: Story = { ...TitulosLargos, ...SOLO_PRUEBA };
export const ConfirmacionAbiertaEnClaro: Story = { ...ConfirmacionAbierta, ...SOLO_PRUEBA };
export const ConfirmacionAbiertaEnUnaObraEnClaro: Story = { ...ConfirmacionAbiertaEnUnaObra, ...SOLO_PRUEBA };
