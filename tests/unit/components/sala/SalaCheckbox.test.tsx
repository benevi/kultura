import { createRef, useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SalaCheckbox } from "@/components/sala/SalaCheckbox";
import { SalaRadio, SalaRadioGroup } from "@/components/sala/SalaRadioGroup";
import { SalaSwitch } from "@/components/sala/SalaSwitch";

describe("SalaCheckbox", () => {
  it("es una casilla nativa dentro de su <label>: la fila entera se pulsa y mide 48 px o más", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLInputElement>();
    render(<SalaCheckbox ref={ref} label="Avísame de los estrenos" name="estrenos" value="si" />);
    const casilla = screen.getByRole("checkbox", { name: "Avísame de los estrenos" });
    expect(ref.current).toBe(casilla);
    expect(casilla).toHaveAttribute("type", "checkbox");
    expect(casilla).toHaveAttribute("name", "estrenos");
    expect(casilla).toHaveAttribute("value", "si");
    const fila = casilla.closest("label")!;
    expect(fila.className).toContain("min-h-sala-target");
    expect(fila.className).toContain("min-w-sala-target");
    // Un clic en el texto la marca.
    await user.click(screen.getByText("Avísame de los estrenos"));
    expect(casilla).toBeChecked();
  });

  it("Espacio la marca y la desmarca; lleva el foco de «Sala»", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SalaCheckbox label="Avísame" onChange={(event) => onChange(event.target.checked)} />);
    const casilla = screen.getByRole("checkbox");
    await user.tab();
    expect(casilla).toHaveFocus();
    expect(casilla.className).toContain("sala-focused:sala-focus");
    await user.keyboard(" ");
    expect(casilla).toBeChecked();
    await user.keyboard(" ");
    expect(casilla).not.toBeChecked();
    expect(onChange.mock.calls).toEqual([[true], [false]]);
  });

  it("la marca es un trazo de adorno, y con colores forzados se devuelve la casilla del sistema", () => {
    render(<SalaCheckbox label="Avísame" defaultChecked />);
    const casilla = screen.getByRole("checkbox");
    const marca = casilla.nextElementSibling!;
    expect(marca.tagName.toLowerCase()).toBe("svg");
    expect(marca).toHaveAttribute("aria-hidden", "true");
    expect(marca.getAttribute("class")).toContain("peer-checked:block");
    expect(casilla.className).toContain("forced-colors:appearance-auto");
    expect(marca.getAttribute("class")).toContain("forced-colors:!hidden");
    // Biblia §1: esquinas rectas, sin sombras.
    expect(casilla.className).not.toMatch(/(^|\s)shadow-|rounded-(lg|2xl|full|bento)/);
  });

  it("controlada", async () => {
    const user = userEvent.setup();
    function Controlada() {
      const [marcada, setMarcada] = useState(true);
      return <SalaCheckbox label="Avísame" checked={marcada} onChange={(event) => setMarcada(event.target.checked)} />;
    }
    render(<Controlada />);
    expect(screen.getByRole("checkbox")).toBeChecked();
    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("ayuda y error describen a la casilla; con error, aria-invalid e icono", () => {
    render(<SalaCheckbox label="Acepto los términos" required requirement="obligatorio" hint="Puedes leerlos antes" error="Marca la casilla" />);
    const casilla = screen.getByRole("checkbox", { name: "Acepto los términos" });
    expect(casilla).toBeRequired();
    expect(screen.getByText("obligatorio")).toHaveAttribute("aria-hidden", "true");
    expect(casilla).toHaveAttribute("aria-invalid", "true");
    expect(casilla).toHaveAccessibleDescription("Marca la casilla Puedes leerlos antes");
    expect(casilla.className).toContain("border-sala-danger");
    expect(screen.getByText("Marca la casilla").closest("p")!.querySelector("svg")).not.toBeNull();
  });

  it("deshabilitada: atributo nativo, no cambia y se ve por el trazo", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SalaCheckbox label="Avísame" disabled onChange={onChange} />);
    const casilla = screen.getByRole("checkbox");
    expect(casilla).toBeDisabled();
    await user.click(screen.getByText("Avísame"));
    expect(casilla).not.toBeChecked();
    expect(onChange).not.toHaveBeenCalled();
    expect(casilla.className).toContain("border-dashed");
    expect(casilla.closest("label")!.className).not.toMatch(/sala-hover:/);
  });
});

describe("SalaRadioGroup", () => {
  const grupo = (props: Partial<React.ComponentProps<typeof SalaRadioGroup>> = {}) => (
    <SalaRadioGroup legend="Quién puede verla" name="visibilidad" {...props}>
      <SalaRadio value="private" label="Solo yo" />
      <SalaRadio value="friends" label="Mis amigos" hint="Los de tu lista de amigos" />
      <SalaRadio value="public" label="Cualquiera" />
    </SalaRadioGroup>
  );

  it("es un fieldset con su legend, con papel de radiogroup y radios nativos del mismo name", () => {
    const ref = createRef<HTMLFieldSetElement>();
    render(grupo({ ref, defaultValue: "friends" }));
    const caja = screen.getByRole("radiogroup", { name: "Quién puede verla" });
    expect(ref.current).toBe(caja);
    expect(caja.tagName).toBe("FIELDSET");
    expect(caja.querySelector("legend")).toHaveTextContent("Quién puede verla");
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    for (const radio of radios) {
      expect(radio).toHaveAttribute("type", "radio");
      expect(radio).toHaveAttribute("name", "visibilidad");
      expect(radio.closest("label")!.className).toContain("min-h-sala-target");
    }
    expect(screen.getByRole("radio", { name: "Mis amigos" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Mis amigos" })).toHaveAttribute("value", "friends");
    // La ayuda de una opción describe a esa opción.
    expect(screen.getByRole("radio", { name: "Mis amigos" })).toHaveAccessibleDescription("Los de tu lista de amigos");
  });

  it("Tab entra una vez en el grupo y las flechas cambian de opción y la eligen, dando la vuelta", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <>
        {grupo({ defaultValue: "private", onChange })}
        <button type="button">Después</button>
      </>
    );
    await user.tab();
    expect(screen.getByRole("radio", { name: "Solo yo" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "Mis amigos" })).toHaveFocus();
    expect(screen.getByRole("radio", { name: "Mis amigos" })).toBeChecked();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Cualquiera" })).toBeChecked();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "Solo yo" })).toBeChecked();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("radio", { name: "Cualquiera" })).toBeChecked();
    expect(onChange.mock.calls.map(([valor]) => valor)).toEqual(["friends", "public", "private", "public"]);
    // Tab sale del grupo entero.
    await user.tab();
    expect(screen.getByRole("button", { name: "Después" })).toHaveFocus();
  });

  it("controlado: manda value", async () => {
    const user = userEvent.setup();
    function Controlado() {
      const [valor, setValor] = useState("private");
      return (
        <>
          {grupo({ value: valor, onChange: setValor })}
          <output>{valor}</output>
        </>
      );
    }
    render(<Controlado />);
    await user.click(screen.getByText("Cualquiera"));
    expect(screen.getByRole("radio", { name: "Cualquiera" })).toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent("public");
  });

  it("obligatorio y con error: lo dice el grupo, con icono, y cada radio es required", () => {
    render(grupo({ required: true, requirement: "obligatorio", hint: "Se puede cambiar", error: "Elige una opción" }));
    const caja = screen.getByRole("radiogroup", { name: "Quién puede verla" });
    expect(caja).toHaveAttribute("aria-required", "true");
    expect(caja).toHaveAttribute("aria-invalid", "true");
    expect(caja).toHaveAccessibleDescription("Elige una opción Se puede cambiar");
    expect(screen.getByText("obligatorio")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Elige una opción").closest("p")!.querySelector("svg")).not.toBeNull();
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toBeRequired();
      expect(radio.className).toContain("border-sala-danger");
    }
  });

  it("deshabilitado: el grupo entero o una sola opción", async () => {
    const user = userEvent.setup();
    const { unmount } = render(grupo({ disabled: true }));
    for (const radio of screen.getAllByRole("radio")) expect(radio).toBeDisabled();
    unmount();

    const onChange = vi.fn();
    render(
      <SalaRadioGroup legend="Quién puede verla" name="v" onChange={onChange}>
        <SalaRadio value="private" label="Solo yo" />
        <SalaRadio value="friends" label="Mis amigos" disabled />
      </SalaRadioGroup>
    );
    expect(screen.getByRole("radio", { name: "Solo yo" })).not.toBeDisabled();
    expect(screen.getByRole("radio", { name: "Mis amigos" })).toBeDisabled();
    await user.click(screen.getByText("Mis amigos"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("el radio es redondo (lo distingue de la casilla) y su marca es un punto de adorno", () => {
    render(grupo({ defaultValue: "private" }));
    const radio = screen.getByRole("radio", { name: "Solo yo" });
    expect(radio.className).toContain("rounded-full");
    expect(radio.className).toContain("forced-colors:appearance-auto");
    expect(radio.nextElementSibling).toHaveAttribute("aria-hidden", "true");
    expect(radio.nextElementSibling!.className).toContain("peer-checked:block");
  });

  it("un SalaRadio suelto, sin grupo, falla con un mensaje claro", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<SalaRadio value="x" label="Suelto" />)).toThrow("SalaRadio va dentro de un SalaRadioGroup");
    error.mockRestore();
  });
});

describe("SalaSwitch", () => {
  it("es una casilla nativa con papel de interruptor; la fila se pulsa y mide 48 px o más", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLInputElement>();
    const onChange = vi.fn();
    render(<SalaSwitch ref={ref} label="Correo semanal" name="semanal" hint="Los lunes" onChange={(event) => onChange(event.target.checked)} />);
    const interruptor = screen.getByRole("switch", { name: "Correo semanal" });
    expect(ref.current).toBe(interruptor);
    expect(interruptor).toHaveAttribute("type", "checkbox");
    expect(interruptor).toHaveAttribute("name", "semanal");
    expect(interruptor).toHaveAccessibleDescription("Los lunes");
    expect(interruptor.closest("label")!.className).toContain("min-h-sala-target");

    await user.click(screen.getByText("Correo semanal"));
    expect(interruptor).toBeChecked();
    expect(interruptor).toHaveFocus();
    await user.keyboard(" ");
    expect(interruptor).not.toBeChecked();
    expect(onChange.mock.calls).toEqual([[true], [false]]);
  });

  it("encendido no se dice con color: la pieza cambia de lado; sin movimiento con movimiento reducido", () => {
    render(<SalaSwitch label="Correo semanal" defaultChecked />);
    const pieza = screen.getByRole("switch").nextElementSibling!;
    expect(pieza).toHaveAttribute("aria-hidden", "true");
    expect(pieza.className).toContain("peer-checked:translate-x-5");
    expect(pieza.className).toContain("motion-reduce:transition-none");
    expect(pieza.className).toContain("forced-colors:hidden");
  });

  it("con error y deshabilitado", () => {
    const { rerender } = render(<SalaSwitch label="Correo semanal" error="No se ha podido guardar" />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("switch")).toHaveAccessibleDescription("No se ha podido guardar");
    rerender(<SalaSwitch label="Correo semanal" disabled />);
    expect(screen.getByRole("switch")).toBeDisabled();
    expect(screen.getByRole("switch").className).toContain("border-dashed");
  });
});
