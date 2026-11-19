import * as React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, waitFor } from "storybook/test";
import { NOTA_PALETA, OBRAS, Suelo } from "../../../.storybook/sala";
import type { ImagePalette } from "@/lib/design/image-palette";
import { SalaButton } from "./SalaButton";
import { SalaCheckbox } from "./SalaCheckbox";
import { SalaInput } from "./SalaInput";
import { SalaRadio, SalaRadioGroup } from "./SalaRadioGroup";
import { SalaSelect } from "./SalaSelect";
import { SalaSwitch } from "./SalaSwitch";
import { SalaTextarea } from "./SalaTextarea";

/**
 * Un formulario de ejemplo con todos los campos de «Sala» y validación de
 * verdad: «Crear una lista». Enseña cómo se usan juntos, no es una pantalla
 * (esas llegan en la 8.5).
 *
 * - Valida al salir de cada campo y al enviar. Los mensajes dicen qué falta y
 *   cómo arreglarlo (WCAG 3.3.1 y 3.3.3).
 * - Al enviar con errores, el foco va al primero: el lector lee el campo con
 *   su error, una vez.
 * - El resultado lo anuncia el formulario (`role="status"`), no el botón.
 */
const meta = {
  title: "Sala/Formulario",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

type Campo = "nombre" | "formato" | "visibilidad" | "normas";
type Errores = Partial<Record<Campo, string>>;

const ORDEN: Campo[] = ["nombre", "formato", "visibilidad", "normas"];

function validar(datos: FormData): Errores {
  const errores: Errores = {};
  const nombre = String(datos.get("nombre") ?? "").trim();
  if (!nombre) errores.nombre = "Ponle un nombre a la lista. Por ejemplo: «Pendientes de este invierno».";
  else if (nombre.length < 3) errores.nombre = "El nombre es muy corto: escribe 3 letras o más.";
  if (!datos.get("formato")) errores.formato = "Elige qué va a tener la lista. Si va a tener de todo, elige «De todo».";
  if (!datos.get("visibilidad")) errores.visibilidad = "Elige quién puede verla. Puedes cambiarlo después.";
  if (datos.get("visibilidad") === "public" && !datos.get("normas")) {
    errores.normas = "Para que la vea cualquiera, marca que cumple las normas.";
  }
  return errores;
}

const contador = (largo: number, tope: number) => `${largo} de ${tope}`;

/** Los errores sin los de esos campos. */
function sin(errores: Errores, ...campos: Campo[]): Errores {
  return Object.fromEntries(Object.entries(errores).filter(([campo]) => !campos.includes(campo as Campo)));
}

function CrearUnaLista({ palette }: { palette?: ImagePalette }) {
  const [errores, setErrores] = React.useState<Errores>({});
  const [enviando, setEnviando] = React.useState(false);
  const [hecho, setHecho] = React.useState("");
  const [publica, setPublica] = React.useState(false);
  const formulario = React.useRef<HTMLFormElement>(null);

  /** Al salir de un campo se revisa solo ese: no se riñe por lo que aún no se ha tocado. */
  const alSalir = (campo: Campo) => () => {
    const todos = validar(new FormData(formulario.current!));
    setErrores((antes) => ({ ...antes, [campo]: todos[campo] }));
  };

  const alEnviar = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHecho("");
    const datos = new FormData(event.currentTarget);
    const nuevos = validar(datos);
    setErrores(nuevos);
    const primero = ORDEN.find((campo) => nuevos[campo]);
    if (primero) {
      // En un grupo de radios, `[name]` da el primero: desde ahí las flechas eligen.
      event.currentTarget.querySelector<HTMLElement>(`[name="${primero}"]`)?.focus();
      return;
    }
    setEnviando(true);
    window.setTimeout(() => {
      setEnviando(false);
      setHecho(`Lista «${String(datos.get("nombre")).trim()}» creada.`);
    }, 600);
  };

  return (
    <Suelo titulo="Crear una lista" nota={palette ? NOTA_PALETA : undefined} palette={palette}>
      <form ref={formulario} noValidate onSubmit={alEnviar} className="grid max-w-xl gap-8">
        <SalaInput
          label="Nombre"
          name="nombre"
          required
          requirement="obligatorio"
          autoComplete="off"
          maxLength={60}
          counter={contador}
          error={errores.nombre}
          onBlur={alSalir("nombre")}
        />
        <SalaTextarea
          label="Descripción"
          name="descripcion"
          requirement="opcional"
          hint="Para qué es la lista, en una o dos frases."
          maxLength={280}
          counter={contador}
          rows={3}
        />
        <SalaSelect label="Qué va a tener" name="formato" required requirement="obligatorio" defaultValue="" error={errores.formato} onBlur={alSalir("formato")}>
          <option value="">Elige un formato</option>
          <option value="all">De todo</option>
          <option value="movie">Películas</option>
          <option value="series">Series</option>
          <option value="anime">Anime</option>
          <option value="manga">Manga</option>
          <option value="book">Libros</option>
          <option value="game">Videojuegos</option>
        </SalaSelect>
        <SalaRadioGroup
          legend="Quién puede verla"
          name="visibilidad"
          required
          requirement="obligatorio"
          error={errores.visibilidad}
          onChange={(valor) => {
            setPublica(valor === "public");
            setErrores((antes) => sin(antes, "visibilidad", "normas"));
          }}
        >
          <SalaRadio value="private" label="Solo yo" />
          <SalaRadio value="friends" label="Mis amigos" />
          <SalaRadio value="public" label="Cualquiera" hint="Aparece en tu perfil y se puede compartir con un enlace." />
        </SalaRadioGroup>
        {publica ? (
          <SalaCheckbox
            label="La lista cumple las normas de la comunidad"
            name="normas"
            required
            requirement="obligatorio"
            error={errores.normas}
            onChange={(event) => {
              if (event.target.checked) setErrores((antes) => sin(antes, "normas"));
            }}
          />
        ) : null}
        <SalaSwitch label="Avísame cuando alguien la guarde" name="avisos" hint="Un aviso en la app, sin correo." />
        <div className="flex flex-wrap items-center gap-4">
          <SalaButton type="submit" loading={enviando} loadingLabel="Creando la lista…">
            Crear la lista
          </SalaButton>
          <SalaButton variant="quiet" type="reset" onClick={() => {
              setErrores({});
              setHecho("");
              setPublica(false);
            }}>
            Vaciar
          </SalaButton>
        </div>
        <p role="status" className="min-h-6 text-sala-success sala-type-label">
          {hecho}
        </p>
      </form>
    </Suelo>
  );
}

const sinErrorAnunciado = () =>
  Array.from(document.querySelectorAll("[data-sala-announcer]")).every((region) => region.textContent === "");

export const Crear: Story = {
  name: "Crear una lista",
  render: () => <CrearUnaLista />,
  play: async ({ canvas, userEvent }) => {
    const nombre = canvas.getByRole("textbox", { name: "Nombre" });
    const formato = canvas.getByRole("combobox", { name: "Qué va a tener" });
    const grupo = canvas.getByRole("radiogroup", { name: /Quién puede verla/ });
    const crear = canvas.getByRole("button", { name: "Crear la lista" });

    // Las regiones vivas de los errores existen antes de que haya errores, y están vacías.
    await expect(document.querySelectorAll("[data-sala-announcer]").length).toBeGreaterThanOrEqual(5);
    await expect(sinErrorAnunciado()).toBe(true);

    // 1. Enviar vacío: tres errores y el foco en el primero.
    await userEvent.click(crear);
    await expect(nombre).toHaveFocus();
    await expect(nombre).toHaveAttribute("aria-invalid", "true");
    await expect(nombre).toHaveAccessibleDescription(/^Ponle un nombre a la lista\. .* 0 de 60$/);
    await expect(formato).toHaveAttribute("aria-invalid", "true");
    await expect(formato).toHaveAccessibleDescription(/Elige qué va a tener la lista/);
    await expect(grupo).toHaveAttribute("aria-invalid", "true");
    await expect(grupo).toHaveAccessibleDescription("Elige quién puede verla. Puedes cambiarlo después.");
    // Cada error lleva su icono: no se dice solo con el color del borde.
    for (const control of [nombre, formato, grupo]) {
      const mensaje = document.getElementById(control.getAttribute("aria-describedby")!.split(" ")[0])!;
      await expect(mensaje.querySelector("svg")).not.toBeNull();
    }
    // El campo con el foco no se anuncia aparte: el lector ya lo lee como descripción. Los otros dos sí.
    await waitFor(() => expect(Array.from(document.querySelectorAll("[data-sala-announcer]")).filter((r) => r.textContent).length).toBe(2));
    const regionDelNombre = nombre.closest("div.grid")!.querySelector("[data-sala-announcer]")!;
    await expect(regionDelNombre).toBeEmptyDOMElement();
    // Y se retiran: recorriendo la página, cada error se lee una sola vez.
    await waitFor(() => expect(sinErrorAnunciado()).toBe(true), { timeout: 4000 });

    // 2. Un nombre corto: al salir del campo, el error cambia y dice cómo arreglarlo; ahora sí se anuncia.
    await userEvent.type(nombre, "Ya");
    await userEvent.tab();
    await expect(nombre).toHaveAccessibleDescription(/El nombre es muy corto: escribe 3 letras o más\./);
    await waitFor(() => expect(regionDelNombre).toHaveTextContent("El nombre es muy corto: escribe 3 letras o más."));

    // 3. Arreglarlo todo.
    await userEvent.type(nombre, " vistas en 2026");
    await userEvent.tab();
    await expect(nombre).not.toHaveAttribute("aria-invalid");
    await expect(nombre).toHaveAccessibleDescription("17 de 60");
    await userEvent.selectOptions(formato, "anime");
    await userEvent.click(canvas.getByRole("radio", { name: "Cualquiera" }));
    await expect(grupo).not.toHaveAttribute("aria-invalid");

    // 4. Pública: aparece una casilla obligatoria. Sin marcarla, el foco va a ella.
    const normas = canvas.getByRole("checkbox", { name: "La lista cumple las normas de la comunidad" });
    await userEvent.click(crear);
    await expect(normas).toHaveFocus();
    await expect(normas).toHaveAttribute("aria-invalid", "true");
    await expect(normas).toHaveAccessibleDescription("Para que la vea cualquiera, marca que cumple las normas.");
    await userEvent.keyboard(" ");
    await expect(normas).toBeChecked();
    await expect(normas).not.toHaveAttribute("aria-invalid");

    // 5. Enviar: el botón espera y el resultado lo anuncia el formulario.
    await userEvent.click(crear);
    await expect(crear).toHaveAttribute("aria-busy", "true");
    await waitFor(() => expect(canvas.getByText("Lista «Ya vistas en 2026» creada.")).toBeVisible(), { timeout: 3000 });
    await expect(crear).not.toHaveAttribute("aria-busy");
  },
};

export const CrearEnUnaObra: Story = {
  ...Crear,
  name: "Crear una lista, en una obra",
  render: () => <CrearUnaLista palette={OBRAS[1].palette} />,
};

/** Con los errores a la vista, para axe y para las capturas. */
export const ConErrores: Story = {
  name: "Con errores",
  render: () => (
    <>
      <CrearUnaLista />
      <CrearUnaLista palette={OBRAS[0].palette} />
    </>
  ),
  play: async ({ canvas, userEvent }) => {
    for (const crear of canvas.getAllByRole("button", { name: "Crear la lista" })) await userEvent.click(crear);
    await expect(canvas.getAllByRole("textbox", { name: "Nombre" })[0]).toHaveAttribute("aria-invalid", "true");
    await expect(canvas.getAllByRole("textbox", { name: "Nombre" })[1]).toHaveFocus();
  },
};

// ------------------------------------------------------------
// Las mismas en claro, para que axe las pase en los dos temas.
// ------------------------------------------------------------

const SOLO_PRUEBA = { globals: { tema: "claro" }, tags: ["!dev"] };

export const CrearEnClaro: Story = { ...Crear, ...SOLO_PRUEBA };
export const CrearEnUnaObraEnClaro: Story = { ...CrearEnUnaObra, ...SOLO_PRUEBA };
export const ConErroresEnClaro: Story = { ...ConErrores, ...SOLO_PRUEBA };
