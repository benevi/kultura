import { createRef, useRef, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SalaCheckbox } from "@/components/sala/SalaCheckbox";
import { SalaForm, type SalaFormHandle } from "@/components/sala/SalaForm";
import { SalaInput } from "@/components/sala/SalaInput";
import { SalaRadio, SalaRadioGroup } from "@/components/sala/SalaRadioGroup";

type Errores = { nombre?: string; visibilidad?: string; normas?: string };

const resumen = (n: number) => (n === 1 ? "Hay 1 campo por corregir." : `Hay ${n} campos por corregir.`);
const aviso = () => document.querySelector("[data-sala-form-status]")!;
const anuncios = () => Array.from(document.querySelectorAll("[data-sala-announcer]")).map((region) => region.textContent);

function validar(datos: FormData): Errores {
  const errores: Errores = {};
  const nombre = String(datos.get("nombre") ?? "");
  if (!nombre) errores.nombre = "Ponle un nombre";
  else if (nombre.length < 3) errores.nombre = "Muy corto";
  if (!datos.get("visibilidad")) errores.visibilidad = "Elige quién puede verla";
  if (!datos.get("normas")) errores.normas = "Marca la casilla";
  return errores;
}

function Formulario({ onValid, elegida }: { onValid?: () => void; elegida?: string }) {
  const [errores, setErrores] = useState<Errores>({});
  const form = useRef<HTMLFormElement>(null);
  return (
    <SalaForm
      ref={form}
      errorSummary={resumen}
      onSubmit={(event) => {
        event.preventDefault();
        const nuevos = validar(new FormData(event.currentTarget));
        setErrores(nuevos);
        if (Object.keys(nuevos).length === 0) onValid?.();
      }}
    >
      <SalaInput
        label="Nombre"
        name="nombre"
        error={errores.nombre}
        onBlur={() => setErrores((antes) => ({ ...antes, nombre: validar(new FormData(form.current!)).nombre }))}
      />
      <SalaRadioGroup legend="Quién puede verla" name="visibilidad" required requirement="obligatorio" error={errores.visibilidad} defaultValue={elegida}>
        <SalaRadio value="private" label="Solo yo" />
        <SalaRadio value="public" label="Cualquiera" />
      </SalaRadioGroup>
      <SalaCheckbox label="Cumple las normas" name="normas" error={errores.normas} />
      <button type="submit">Crear</button>
      <button type="reset">Vaciar</button>
    </SalaForm>
  );
}

describe("SalaForm", () => {
  it("es un <form> nativo: pasa la ref y las props, y va con noValidate salvo que se pida", () => {
    const ref = createRef<HTMLFormElement>();
    const { rerender } = render(
      <SalaForm ref={ref} errorSummary={resumen} className="grid" aria-label="Crear una lista">
        <SalaInput label="Nombre" />
      </SalaForm>
    );
    const form = screen.getByRole("form", { name: "Crear una lista" });
    expect(ref.current).toBe(form);
    expect(form.tagName).toBe("FORM");
    expect(form).toHaveClass("grid");
    expect(form).toHaveAttribute("novalidate");
    // La región del aviso existe antes de que haya nada que decir.
    expect(aviso()).toHaveAttribute("role", "status");
    expect(aviso()).toBeEmptyDOMElement();
    rerender(
      <SalaForm ref={ref} errorSummary={resumen} noValidate={false}>
        <SalaInput label="Nombre" />
      </SalaForm>
    );
    expect(ref.current).not.toHaveAttribute("novalidate");
  });

  it("al enviar con errores lleva el foco al primero, anuncia una vez cuántos son y los campos callan", async () => {
    const user = userEvent.setup();
    render(<Formulario />);
    await user.click(screen.getByRole("button", { name: "Crear" }));
    expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveFocus();
    expect(aviso().textContent).toBe("Hay 3 campos por corregir.");
    // Ningún campo anuncia el suyo: se oirían los tres a la vez y sin decir de quién son.
    expect(anuncios()).toEqual(["", "", ""]);
  });

  it("Enter dentro del primer campo con error: el foco no se mueve, así que el aviso dice también ese error", async () => {
    const user = userEvent.setup();
    render(<Formulario />);
    const nombre = screen.getByRole("textbox", { name: "Nombre" });
    await user.click(nombre);
    await user.keyboard("{Enter}");
    expect(nombre).toHaveFocus();
    expect(nombre).toHaveAccessibleDescription("Ponle un nombre");
    expect(aviso().textContent).toBe("Hay 3 campos por corregir. Nombre: Ponle un nombre");
    expect(anuncios()).toEqual(["", "", ""]);

    // El error cambia con el foco dentro.
    await user.keyboard("Ya");
    expect(aviso()).toBeEmptyDOMElement();
    await user.keyboard("{Enter}");
    expect(aviso().textContent).toBe("Hay 3 campos por corregir. Nombre: Muy corto");
  });

  it("el mismo aviso dos veces seguidas es un nodo nuevo: el lector lo vuelve a decir", async () => {
    const user = userEvent.setup();
    render(<Formulario />);
    await user.click(screen.getByRole("button", { name: "Crear" }));
    const primero = aviso().firstElementChild;
    await user.click(screen.getByRole("button", { name: "Crear" }));
    expect(aviso().textContent).toBe("Hay 3 campos por corregir.");
    expect(aviso().firstElementChild).not.toBe(primero);
  });

  it("si el primer error es un grupo de radios, el foco va a la opción elegida o a la primera", async () => {
    const user = userEvent.setup();
    function SoloGrupo() {
      const [error, setError] = useState<string>();
      return (
        <SalaForm
          errorSummary={resumen}
          onSubmit={(event) => {
            event.preventDefault();
            setError("Ahora mismo no se puede cambiar");
          }}
        >
          <SalaRadioGroup legend="Quién puede verla" name="v" error={error} defaultValue="public">
            <SalaRadio value="private" label="Solo yo" />
            <SalaRadio value="public" label="Cualquiera" />
          </SalaRadioGroup>
          <button type="submit">Guardar</button>
        </SalaForm>
      );
    }
    render(<SoloGrupo />);
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(screen.getByRole("radio", { name: "Cualquiera" })).toHaveFocus();
    expect(aviso().textContent).toBe("Hay 1 campo por corregir.");

    // Sin ninguna elegida, a la primera.
    render(<Formulario />);
    const nombres = screen.getAllByRole("textbox", { name: "Nombre" });
    await user.type(nombres[nombres.length - 1], "Pendientes");
    await user.click(screen.getAllByRole("button", { name: "Crear" }).pop()!);
    expect(screen.getAllByRole("radio", { name: "Solo yo" }).pop()).toHaveFocus();
  });

  it("fuera de un envío cada campo anuncia el suyo, con su etiqueta", async () => {
    const user = userEvent.setup();
    render(<Formulario />);
    await user.click(screen.getByRole("textbox", { name: "Nombre" }));
    await user.tab();
    expect(anuncios()).toEqual(["Nombre: Ponle un nombre", "", ""]);
    expect(aviso()).toBeEmptyDOMElement();
  });

  it("sin errores no anuncia nada ni mueve el foco; el aviso se retira al cambiar algo o al vaciar", async () => {
    const user = userEvent.setup();
    const onValid = vi.fn();
    render(<Formulario onValid={onValid} elegida="private" />);
    await user.click(screen.getByRole("button", { name: "Crear" }));
    expect(aviso().textContent).toBe("Hay 2 campos por corregir.");
    await user.click(screen.getByRole("button", { name: "Vaciar" }));
    expect(aviso()).toBeEmptyDOMElement();

    await user.click(screen.getByRole("button", { name: "Crear" }));
    expect(aviso().textContent).toBe("Hay 2 campos por corregir.");
    await user.type(screen.getByRole("textbox", { name: "Nombre" }), "Pendientes");
    expect(aviso()).toBeEmptyDOMElement();
    await user.click(screen.getByRole("checkbox", { name: "Cumple las normas" }));
    await user.click(screen.getByRole("button", { name: "Crear" }));
    expect(onValid).toHaveBeenCalledTimes(1);
    expect(aviso()).toBeEmptyDOMElement();
    expect(screen.getByRole("button", { name: "Crear" })).toHaveFocus();
  });

  it("reportErrors hace lo mismo con errores que no salen de un envío (los devuelve el servidor)", () => {
    function ConServidor() {
      const [error, setError] = useState<string>();
      const handle = useRef<SalaFormHandle>(null);
      return (
        <>
          <SalaForm errorSummary={resumen} handle={handle}>
            <SalaInput label="Correo" name="correo" error={error} />
          </SalaForm>
          <button
            type="button"
            onClick={() => {
              setError("Ese correo ya tiene cuenta");
              handle.current!.reportErrors();
            }}
          >
            respuesta
          </button>
        </>
      );
    }
    render(<ConServidor />);
    fireEvent.click(screen.getByRole("button", { name: "respuesta" }));
    expect(screen.getByRole("textbox", { name: "Correo" })).toHaveFocus();
    expect(aviso().textContent).toBe("Hay 1 campo por corregir.");
    expect(anuncios()).toEqual([""]);
  });
});
