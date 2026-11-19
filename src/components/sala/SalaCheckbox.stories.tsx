import * as React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";
import { Muestras, NOTA_PALETA, OBRAS, Suelo, contraste, fondoDe } from "../../../.storybook/sala";
import { SalaCheckbox } from "./SalaCheckbox";
import { SalaLink } from "./SalaLink";
import { SalaRadio, SalaRadioGroup } from "./SalaRadioGroup";
import { SalaSwitch } from "./SalaSwitch";

/**
 * Casilla, grupo de radios e interruptor de «Sala». Los tres son controles
 * nativos con otro dibujo: la fila entera se pulsa y mide 48 px o más. Cada
 * historia va sobre los neutros y sobre el color de una obra; las «en claro»
 * son las mismas, para que axe las pase en los dos temas.
 */
const meta = {
  title: "Sala/Selección",
  component: SalaCheckbox,
  parameters: { layout: "fullscreen" },
  args: { label: "Avísame cuando salga un capítulo nuevo", name: "avisos", onChange: fn() },
} satisfies Meta<typeof SalaCheckbox>;

export default meta;
type Story = StoryObj<typeof meta>;

const OBRA = OBRAS[0];

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

function Caso({ pie, children }: { pie: string; children: React.ReactNode }) {
  return (
    <li className="grid w-72 max-w-full content-start gap-2">
      {children}
      <span className="text-sala-ink-secondary sala-type-small">{pie}</span>
    </li>
  );
}

// ------------------------------------------------------------
// Una sola pieza, con controles
// ------------------------------------------------------------

export const Principal: Story = {
  render: (args) => (
    <Suelo titulo="Casilla">
      <SalaCheckbox {...args} />
    </Suelo>
  ),
};

// ------------------------------------------------------------
// Estados
// ------------------------------------------------------------

function Visibilidad({ nombre, ...grupo }: { nombre: string } & Partial<React.ComponentProps<typeof SalaRadioGroup>>) {
  return (
    <SalaRadioGroup legend="Quién puede ver la lista" name={nombre} {...grupo}>
      <SalaRadio value="private" label="Solo yo" />
      <SalaRadio value="friends" label="Mis amigos" />
      <SalaRadio value="public" label="Cualquiera" />
    </SalaRadioGroup>
  );
}

function Estados() {
  // Los dos suelos pintan los mismos grupos: sin esto compartirían `name` y solo uno tendría opción elegida.
  const suelo = React.useId();
  return (
    <>
      <Muestras titulo="Casilla">
        <Caso pie="Sin marcar">
          <SalaCheckbox label="Avísame de los estrenos" name="c1" />
        </Caso>
        <Caso pie="Con el puntero en la fila">
          <SalaCheckbox label="Avísame de los estrenos" name="c2" data-sala-force="hover" />
        </Caso>
        <Caso pie="Con el foco">
          <SalaCheckbox label="Avísame de los estrenos" name="c3" data-sala-force="focus" />
        </Caso>
        <Caso pie="Marcada">
          <SalaCheckbox label="Avísame de los estrenos" name="c4" defaultChecked />
        </Caso>
        <Caso pie="Marcada, con el foco">
          <SalaCheckbox label="Avísame de los estrenos" name="c5" defaultChecked data-sala-force="focus" />
        </Caso>
        <Caso pie="Con ayuda">
          <SalaCheckbox label="Avísame de los estrenos" name="c6" hint="Un aviso el día que sale, y ninguno más." />
        </Caso>
        <Caso pie="Obligatoria, con error">
          <SalaCheckbox
            label="Tengo 14 años o más y acepto los términos"
            name="c7"
            required
            requirement="obligatorio"
            error="Marca la casilla para crear tu cuenta."
          />
        </Caso>
        <Caso pie="Deshabilitada">
          <SalaCheckbox label="Avísame de los estrenos" name="c8" disabled />
        </Caso>
        <Caso pie="Deshabilitada y marcada">
          <SalaCheckbox label="Avísame de los estrenos" name="c9" disabled defaultChecked />
        </Caso>
      </Muestras>
      <Muestras titulo="Radios">
        <Caso pie="Sin elegir">
          <Visibilidad nombre={`${suelo}-r1`} />
        </Caso>
        <Caso pie="Elegida, con ayuda en el grupo y en una opción">
          <SalaRadioGroup legend="Quién puede ver la lista" name={`${suelo}-r2`} defaultValue="friends" hint="Puedes cambiarlo después.">
            <SalaRadio value="private" label="Solo yo" />
            <SalaRadio value="friends" label="Mis amigos" hint="Los que tienes en Amigos hoy y los que añadas." />
            <SalaRadio value="public" label="Cualquiera" />
          </SalaRadioGroup>
        </Caso>
        <Caso pie="Puntero en la primera, foco en la segunda">
          <SalaRadioGroup legend="Quién puede ver la lista" name={`${suelo}-r3`} defaultValue="public">
            <SalaRadio value="private" label="Solo yo" data-sala-force="hover" />
            <SalaRadio value="friends" label="Mis amigos" data-sala-force="focus" />
            <SalaRadio value="public" label="Cualquiera" data-sala-force="focus" />
          </SalaRadioGroup>
        </Caso>
        <Caso pie="Obligatorio, con error">
          <Visibilidad nombre={`${suelo}-r4`} required requirement="obligatorio" error="Elige quién puede verla." />
        </Caso>
        <Caso pie="Una opción deshabilitada">
          <SalaRadioGroup legend="Quién puede ver la lista" name={`${suelo}-r5`} defaultValue="private">
            <SalaRadio value="private" label="Solo yo" />
            <SalaRadio value="friends" label="Mis amigos" disabled hint="Todavía no tienes amigos en Kultura." />
            <SalaRadio value="public" label="Cualquiera" />
          </SalaRadioGroup>
        </Caso>
        <Caso pie="Grupo deshabilitado">
          <Visibilidad nombre={`${suelo}-r6`} disabled defaultValue="friends" />
        </Caso>
      </Muestras>
      <Muestras titulo="Interruptor">
        <Caso pie="Apagado">
          <SalaSwitch label="Correo semanal" name="i1" />
        </Caso>
        <Caso pie="Con el puntero en la fila">
          <SalaSwitch label="Correo semanal" name="i2" data-sala-force="hover" />
        </Caso>
        <Caso pie="Con el foco">
          <SalaSwitch label="Correo semanal" name="i3" data-sala-force="focus" />
        </Caso>
        <Caso pie="Encendido">
          <SalaSwitch label="Correo semanal" name="i4" defaultChecked />
        </Caso>
        <Caso pie="Encendido, con el foco">
          <SalaSwitch label="Correo semanal" name="i5" defaultChecked data-sala-force="focus" />
        </Caso>
        <Caso pie="Con ayuda">
          <SalaSwitch label="Correo semanal" name="i6" defaultChecked hint="Los lunes, lo que se estrena esa semana de lo que sigues." />
        </Caso>
        <Caso pie="Con error">
          <SalaSwitch label="Correo semanal" name="i7" error="No se ha podido guardar. Vuelve a probar en un momento." />
        </Caso>
        <Caso pie="Deshabilitado">
          <SalaSwitch label="Correo semanal" name="i8" disabled />
        </Caso>
        <Caso pie="Deshabilitado y encendido">
          <SalaSwitch label="Correo semanal" name="i9" disabled defaultChecked />
        </Caso>
      </Muestras>
    </>
  );
}

/** Borde del dibujo contra su fondo, en todos los controles que se pueden usar. */
async function bordes(controles: HTMLElement[]) {
  for (const control of controles) {
    if ((control as HTMLInputElement).disabled) continue;
    await expect(contraste(getComputedStyle(control).borderTopColor, fondoDe(control))).toBeGreaterThanOrEqual(3);
  }
}

export const LosEstados: Story = {
  name: "Estados",
  render: () => (
    <EnLosDosSuelos>
      <Estados />
    </EnLosDosSuelos>
  ),
  play: async ({ canvas }) => {
    const casillas = canvas.getAllByRole("checkbox");
    const radios = canvas.getAllByRole("radio");
    const interruptores = canvas.getAllByRole("switch");
    await bordes([...casillas, ...radios, ...interruptores]);

    // Biblia §9: lo que se pulsa es la fila (el `<label>`), de 48 px o más, aunque el dibujo sea más pequeño.
    for (const control of [...casillas, ...radios, ...interruptores]) {
      const fila = control.closest("label")!.getBoundingClientRect();
      await expect(fila.height).toBeGreaterThanOrEqual(48);
      await expect(fila.width).toBeGreaterThanOrEqual(48);
      await expect(control.getBoundingClientRect().height).toBeLessThan(48);
    }

    // La marca no es solo color: un trazo en la casilla, un punto en el radio, la pieza de lado en el interruptor.
    const marcada = casillas.find((c) => (c as HTMLInputElement).checked)!;
    await expect(getComputedStyle(marcada.nextElementSibling!).display).toBe("block");
    await expect(getComputedStyle(casillas[0].nextElementSibling!).display).toBe("none");
    // La marca se ve: fondo sobre tinta.
    await expect(contraste(getComputedStyle(marcada.nextElementSibling!).color, getComputedStyle(marcada).backgroundColor)).toBeGreaterThanOrEqual(3);
    const elegido = radios.find((r) => (r as HTMLInputElement).checked)!;
    await expect(getComputedStyle(elegido.nextElementSibling!).display).toBe("block");
    await expect(getComputedStyle(elegido).borderRadius).not.toBe("0px");
    const apagado = interruptores[0];
    const encendido = interruptores.find((i) => (i as HTMLInputElement).checked)!;
    const lado = (i: HTMLElement) => i.nextElementSibling!.getBoundingClientRect().left - i.getBoundingClientRect().left;
    await expect(lado(encendido)).toBeGreaterThan(lado(apagado) + 16);
    // La pieza se ve en los dos lados.
    await expect(contraste(getComputedStyle(apagado.nextElementSibling!).backgroundColor, fondoDe(apagado))).toBeGreaterThanOrEqual(3);
    await expect(
      contraste(getComputedStyle(encendido.nextElementSibling!).backgroundColor, getComputedStyle(encendido).backgroundColor)
    ).toBeGreaterThanOrEqual(3);

    // Error del grupo: el grupo tiene nombre y queda como no válido; el error lo lleva cada radio
    // (al llegar el foco a un radio no todos los lectores leen la descripción del grupo), y solo ahí.
    const [grupo] = canvas.getAllByRole("radiogroup", { name: /Quién puede ver la lista/ }).filter((g) => g.getAttribute("aria-invalid") === "true");
    await expect(grupo).not.toHaveAttribute("aria-describedby");
    // «Obligatorio» lo dice el grupo.
    await expect(grupo).toHaveAttribute("aria-required", "true");
    for (const radio of Array.from(grupo.querySelectorAll<HTMLInputElement>("input[type=radio]"))) {
      await expect(radio).toBeRequired();
      await expect(radio).toHaveAccessibleDescription(/^Elige quién puede verla\./);
    }
    // El interruptor que no se ha podido guardar no es «no válido»: lo dice su descripción.
    const fallido = interruptores.find((i) => i.getAttribute("aria-describedby")?.includes("-error"))!;
    await expect(fallido).not.toHaveAttribute("aria-invalid");
    await expect(fallido).toHaveAccessibleDescription(/No se ha podido guardar/);
    // La casilla con error.
    const [terminos] = canvas.getAllByRole("checkbox", { name: "Tengo 14 años o más y acepto los términos" });
    await expect(terminos).toBeRequired();
    await expect(terminos).toHaveAttribute("aria-invalid", "true");
    await expect(terminos).toHaveAccessibleDescription("Marca la casilla para crear tu cuenta.");
    // La ayuda de una opción describe a esa opción.
    await expect(canvas.getAllByRole("radio", { name: "Mis amigos" })[1]).toHaveAccessibleDescription("Los que tienes en Amigos hoy y los que añadas.");
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
  play: async ({ canvas }) => {
    await bordes([...canvas.getAllByRole("checkbox"), ...canvas.getAllByRole("radio"), ...canvas.getAllByRole("switch")]);
  },
};

// ------------------------------------------------------------
// Comportamiento: ratón y teclado
// ------------------------------------------------------------

const alCambiar = fn();

export const Teclado: Story = {
  name: "Teclado y fila que se pulsa",
  render: (args) => (
    <Suelo
      titulo="Teclado"
      nota="Tab entra en cada control (en el grupo de radios, una sola vez); Espacio marca la casilla y el interruptor; las flechas cambian de radio. Un clic en cualquier punto de la fila cuenta."
    >
      <div className="grid max-w-md gap-6">
        <SalaCheckbox label="Avísame de los estrenos" name="estrenos" onChange={args.onChange} />
        <SalaRadioGroup legend="Quién puede ver la lista" name="visibilidad" defaultValue="private" onChange={alCambiar}>
          <SalaRadio value="private" label="Solo yo" />
          <SalaRadio value="friends" label="Mis amigos" />
          <SalaRadio value="public" label="Cualquiera" />
        </SalaRadioGroup>
        <SalaSwitch label="Correo semanal" name="semanal" hint="Los lunes, lo que se estrena esa semana." />
      </div>
    </Suelo>
  ),
  play: async ({ args, canvas, userEvent }) => {
    alCambiar.mockClear();
    const casilla = canvas.getByRole("checkbox", { name: "Avísame de los estrenos" });
    const interruptor = canvas.getByRole("switch", { name: "Correo semanal" });
    const radio = (nombre: string) => canvas.getByRole("radio", { name: nombre });

    // Casilla: Tab, anillo de foco y Espacio.
    await userEvent.tab();
    await expect(casilla).toHaveFocus();
    await expect(getComputedStyle(casilla).outlineStyle).toBe("solid");
    await expect(getComputedStyle(casilla).outlineWidth).toBe("3px");
    await userEvent.keyboard(" ");
    await expect(casilla).toBeChecked();
    await expect(args.onChange).toHaveBeenCalledTimes(1);

    // Radios: Tab entra en el elegido; las flechas cambian y eligen; Tab sale del grupo entero.
    await userEvent.tab();
    await expect(radio("Solo yo")).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    await expect(radio("Mis amigos")).toHaveFocus();
    await expect(radio("Mis amigos")).toBeChecked();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    // Da la vuelta.
    await expect(radio("Solo yo")).toBeChecked();
    await userEvent.keyboard("{ArrowUp}");
    await expect(radio("Cualquiera")).toBeChecked();
    await expect(alCambiar.mock.calls.map(([valor]) => valor)).toEqual(["friends", "public", "private", "public"]);
    await userEvent.tab();
    await expect(interruptor).toHaveFocus();

    // Interruptor: Espacio lo enciende; su papel y su descripción llegan al lector.
    await userEvent.keyboard(" ");
    await expect(interruptor).toBeChecked();
    await expect(interruptor).toHaveAccessibleDescription("Los lunes, lo que se estrena esa semana.");

    // Un clic en el borde derecho de la fila, lejos del dibujo, también cuenta (casilla) …
    const fila = casilla.closest("label")!;
    const { right, top, height } = fila.getBoundingClientRect();
    await userEvent.pointer([
      { keys: "[MouseLeft>]", target: fila, coords: { clientX: right - 2, clientY: top + height / 2 } },
      { keys: "[/MouseLeft]", target: fila, coords: { clientX: right - 2, clientY: top + height / 2 } },
    ]);
    await expect(casilla).not.toBeChecked();
    // … y en el texto del interruptor, a la izquierda.
    await userEvent.click(canvas.getByText("Correo semanal"));
    await expect(interruptor).not.toBeChecked();
  },
};

// ------------------------------------------------------------
// Textos largos y otras escrituras
// ------------------------------------------------------------

function Largos() {
  const suelo = React.useId();
  return (
    <div className="grid w-[288px] max-w-full gap-6">
      <SalaCheckbox
        label={
          <>
            Tengo 14 años o más y acepto los <SalaLink href="/terms">términos</SalaLink> y la <SalaLink href="/privacy">privacidad</SalaLink>
          </>
        }
        name="t1"
        required
        requirement="obligatorio"
        error="Marca la casilla para crear tu cuenta. Sin aceptar los términos no podemos guardar nada tuyo."
      />
      {/* `lang` en la casilla llega solo al `<input>`: con la etiqueta y la ayuda en otro idioma, se envuelve la casilla entera. */}
      <div lang="ja" className="min-w-0">
        <SalaCheckbox label="新しいエピソードが公開されたらお知らせを受け取る" name="t2" hint="通知は公開日に一度だけ届きます。" />
      </div>
      <SalaRadioGroup lang="ko" legend="이 목록을 볼 수 있는 사람" name={`${suelo}-t3`} defaultValue="friends" hint="나중에 설정에서 바꿀 수 있습니다.">
        <SalaRadio value="private" label="나만 보기" />
        <SalaRadio value="friends" label="친구에게만 공개" />
      </SalaRadioGroup>
      <SalaSwitch
        label="Recibir un correo cada lunes con los estrenos de la semana de las obras que sigues"
        name="t4"
        hint="Donaudampfschifffahrtsgesellschaftskapitänsmütze@example.org"
        error="No se ha podido guardar. Vuelve a probar en un momento."
      />
    </div>
  );
}

export const TextoLargo: Story = {
  name: "Texto largo, otras escrituras y 320 px",
  render: () => (
    <EnLosDosSuelos>
      <Largos />
    </EnLosDosSuelos>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    for (const columna of Array.from(canvasElement.querySelectorAll<HTMLElement>("section > div > div"))) {
      const limite = columna.getBoundingClientRect().right;
      await expect(columna.scrollWidth).toBeLessThanOrEqual(columna.clientWidth);
      for (const el of Array.from(columna.querySelectorAll<HTMLElement>("label, legend, p, input"))) {
        await expect(el.getBoundingClientRect().right).toBeLessThanOrEqual(limite + 1);
      }
    }
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);

    // El idioma cubre también la etiqueta y la ayuda, no solo el control.
    const japonesa = canvas.getAllByRole("checkbox", { name: /お知らせ/ })[0];
    await expect(japonesa.closest("[lang]")).toHaveAttribute("lang", "ja");
    await expect(japonesa.closest("label")!.closest("[lang]")).toHaveAttribute("lang", "ja");
    await expect(document.getElementById(japonesa.getAttribute("aria-describedby")!)!.closest("[lang]")).toHaveAttribute("lang", "ja");

    // Pulsar un enlace dentro de la etiqueta no marca la casilla; el resto del texto, sí.
    const terminos = canvas.getAllByRole("checkbox", { name: /Tengo 14 años o más/ })[0] as HTMLInputElement;
    const enlace = canvas.getAllByRole("link", { name: "términos" })[0];
    const sinNavegar = (event: Event) => event.preventDefault();
    enlace.addEventListener("click", sinNavegar);
    await userEvent.click(enlace);
    enlace.removeEventListener("click", sinNavegar);
    await expect(terminos).not.toBeChecked();
    await userEvent.click(canvas.getAllByText(/Tengo 14 años o más/)[0]);
    await expect(terminos).toBeChecked();
    await userEvent.click(terminos);
    await expect(terminos).not.toBeChecked();
  },
};

// ------------------------------------------------------------
// Las mismas en claro, para que axe las pase en los dos temas.
// ------------------------------------------------------------

const SOLO_PRUEBA = { globals: { tema: "claro" }, tags: ["!dev"] };

export const EstadosEnClaro: Story = { ...LosEstados, ...SOLO_PRUEBA };
export const SobreUnPanelEnClaro: Story = { ...SobreUnPanel, ...SOLO_PRUEBA };
export const TecladoEnClaro: Story = { ...Teclado, ...SOLO_PRUEBA };
export const TextoLargoEnClaro: Story = { ...TextoLargo, ...SOLO_PRUEBA };
