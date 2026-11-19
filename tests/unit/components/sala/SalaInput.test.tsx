import { createRef, useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SalaField } from "@/components/sala/SalaField";
import { SalaInput } from "@/components/sala/SalaInput";
import { SalaSelect } from "@/components/sala/SalaSelect";
import { SalaTextarea } from "@/components/sala/SalaTextarea";

const contador = (largo: number, tope: number) => `${largo} de ${tope}`;
const anuncio = (container: HTMLElement) => container.querySelector("[data-sala-announcer]")!;

afterEach(() => {
  vi.useRealTimers();
});

describe("SalaField", () => {
  it("une la etiqueta, la ayuda y el error con el control que le pasan", () => {
    render(
      <SalaField label="Nota" hint="Del 1 al 10" error="Elige una nota">
        {(control) => <input type="range" {...control} />}
      </SalaField>
    );
    const control = screen.getByRole("slider", { name: "Nota" });
    expect(control).toHaveAttribute("aria-invalid", "true");
    // El error va el primero: es lo que más importa oír.
    expect(control).toHaveAccessibleDescription("Elige una nota Del 1 al 10");
    expect(control).not.toHaveAttribute("aria-errormessage");
  });

  it("dos campos con la misma etiqueta no comparten id", () => {
    render(
      <>
        <SalaInput label="Nombre" />
        <SalaInput label="Nombre" />
      </>
    );
    const [a, b] = screen.getAllByRole("textbox", { name: "Nombre" });
    expect(a.id).not.toBe(b.id);
  });
});

describe("SalaInput", () => {
  it("es un <input> nativo con su etiqueta a la vista; pasa la ref, el id y las props nativas", () => {
    const ref = createRef<HTMLInputElement>();
    render(<SalaInput ref={ref} id="correo" label="Correo" type="email" name="email" autoComplete="email" inputMode="email" placeholder="tu@correo" />);
    const campo = screen.getByRole("textbox", { name: "Correo" });
    expect(ref.current).toBe(campo);
    expect(campo.tagName).toBe("INPUT");
    expect(campo).toHaveAttribute("id", "correo");
    expect(campo).toHaveAttribute("type", "email");
    expect(campo).toHaveAttribute("name", "email");
    expect(campo).toHaveAttribute("autocomplete", "email");
    expect(campo).toHaveAttribute("inputmode", "email");
    // El placeholder no es la etiqueta: hay un <label> de verdad.
    expect(screen.getByText("Correo").tagName).toBe("LABEL");
    expect(screen.getByText("Correo")).toHaveAttribute("for", "correo");
  });

  it("la ref de función también llega, y se suelta al desmontar", () => {
    const ref = vi.fn();
    const { unmount } = render(<SalaInput ref={ref} label="Nombre" />);
    expect(ref).toHaveBeenLastCalledWith(screen.getByRole("textbox"));
    unmount();
    expect(ref).toHaveBeenLastCalledWith(null);
  });

  it.each(["email", "password", "url"] as const)("%s: sin corrector ni mayúscula inicial, salvo que se pida", (type) => {
    const { rerender } = render(<SalaInput label="Dato" type={type} />);
    expect(screen.getByLabelText("Dato")).toHaveAttribute("autocapitalize", "none");
    expect(screen.getByLabelText("Dato")).toHaveAttribute("spellcheck", "false");
    rerender(<SalaInput label="Dato" type={type} autoCapitalize="words" spellCheck />);
    expect(screen.getByLabelText("Dato")).toHaveAttribute("autocapitalize", "words");
    expect(screen.getByLabelText("Dato")).toHaveAttribute("spellcheck", "true");
  });

  it("mide 48 px o más, letra de 17 px (iOS no amplía) y lleva el foco de «Sala»; sin esquinas ni sombras de adorno", () => {
    render(<SalaInput label="Nombre" />);
    const { className } = screen.getByRole("textbox");
    expect(className).toContain("min-h-sala-target");
    expect(className).toContain("sala-type-text");
    expect(className).toContain("sala-focused:sala-focus");
    expect(className).toContain("border-sala-border");
    expect(className).toContain("rounded-none");
    expect(className).not.toMatch(/(^|\s)shadow-|rounded-(lg|2xl|full|bento)/);
    // El autorrelleno del navegador se repinta con tinta sobre panel.
    expect(className).toContain("autofill:[-webkit-text-fill-color:var(--sala-ink)]");
    expect(className).toContain("placeholder:text-sala-ink-secondary");
  });

  describe("ayuda y error", () => {
    it("sin ayuda ni error no describe nada ni marca nada", () => {
      render(<SalaInput label="Nombre" />);
      const campo = screen.getByRole("textbox");
      expect(campo).not.toHaveAttribute("aria-describedby");
      expect(campo).not.toHaveAttribute("aria-invalid");
    });

    it("la ayuda describe al campo y conserva el aria-describedby que ya traía", () => {
      render(
        <>
          <p id="fuera">Nota de fuera</p>
          <SalaInput label="Nombre" hint="Entre 3 y 20 letras" aria-describedby="fuera" />
        </>
      );
      expect(screen.getByRole("textbox")).toHaveAccessibleDescription("Nota de fuera Entre 3 y 20 letras");
    });

    it("con error: aria-invalid, el error en la descripción y con icono además del color", () => {
      render(<SalaInput label="Correo" hint="El de tu cuenta" error="Falta la arroba" />);
      const campo = screen.getByRole("textbox");
      expect(campo).toHaveAttribute("aria-invalid", "true");
      expect(campo).toHaveAccessibleDescription("Falta la arroba El de tu cuenta");
      expect(campo.className).toContain("border-sala-danger");
      const mensaje = screen.getByText("Falta la arroba").closest("p")!;
      expect(mensaje.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
      // El mensaje a la vista no es una región viva: la región es otra (y está vacía si no hay cambio).
      expect(mensaje).not.toHaveAttribute("role");
      expect(mensaje).not.toHaveAttribute("aria-live");
    });

    it("la región viva existe antes del error y un error que ya venía pintado no se anuncia", () => {
      vi.useFakeTimers();
      const { container } = render(<SalaInput label="Correo" error="Falta la arroba" />);
      expect(anuncio(container)).toHaveAttribute("aria-live", "polite");
      act(() => void vi.advanceTimersByTime(500));
      expect(anuncio(container)).toBeEmptyDOMElement();
    });

    it("un error que aparece con el foco en otro sitio se anuncia al momento, con la etiqueta delante", () => {
      vi.useFakeTimers();
      const { container, rerender } = render(<SalaInput label="Correo" required requirement="obligatorio" />);
      const region = anuncio(container);
      rerender(<SalaInput label="Correo" required requirement="obligatorio" error="Falta la arroba" />);
      expect(anuncio(container)).toBe(region);
      // Sin la palabra «obligatorio», que es solo para la vista.
      expect(region.textContent).toBe("Correo: Falta la arroba");
      // No se retira al segundo y medio: un anuncio que desaparece antes de que el lector llegue a él se pierde.
      act(() => void vi.advanceTimersByTime(5000));
      expect(region.textContent).toBe("Correo: Falta la arroba");
      act(() => void vi.advanceTimersByTime(6000));
      expect(region).toBeEmptyDOMElement();
      expect(screen.getByText("Falta la arroba")).toBeInTheDocument();
    });

    it("el anuncio se retira cuando el foco entra en el campo: ahí el error se lee como descripción", () => {
      const { container, rerender } = render(<SalaInput label="Correo" />);
      rerender(<SalaInput label="Correo" error="Falta la arroba" />);
      expect(anuncio(container).textContent).toBe("Correo: Falta la arroba");
      act(() => screen.getByRole("textbox").focus());
      expect(anuncio(container)).toBeEmptyDOMElement();
      expect(screen.getByRole("textbox")).toHaveAccessibleDescription("Falta la arroba");
    });

    it("si el foco acaba de llegar al campo (enviar y saltar al primer error) no se anuncia aparte", () => {
      const { container, rerender } = render(<SalaInput label="Correo" />);
      // El formulario pone los errores y lleva el foco al primero, en el mismo gesto.
      act(() => screen.getByRole("textbox").focus());
      rerender(<SalaInput label="Correo" error="Falta la arroba" />);
      expect(anuncio(container)).toBeEmptyDOMElement();
      expect(screen.getByRole("textbox")).toHaveAccessibleDescription("Falta la arroba");
    });

    it("si el foco ya estaba en el campo, el error se anuncia: una descripción que cambia no se lee sola (WCAG 4.1.3)", () => {
      const { container, rerender } = render(<SalaInput label="Correo" />);
      const campo = screen.getByRole("textbox");
      act(() => campo.focus());
      // Enter dentro del campo: el foco no se mueve.
      fireEvent.keyDown(campo, { key: "Enter" });
      rerender(<SalaInput label="Correo" error="Escribe tu correo" />);
      expect(campo).toHaveFocus();
      expect(anuncio(container).textContent).toBe("Correo: Escribe tu correo");
      // Validar mientras se escribe: el error cambia con el foco dentro.
      fireEvent.change(campo, { target: { value: "chihiro" } });
      rerender(<SalaInput label="Correo" error="Falta la arroba" />);
      expect(anuncio(container).textContent).toBe("Correo: Falta la arroba");
      // Al salir del campo se retira.
      act(() => campo.blur());
      expect(anuncio(container)).toBeEmptyDOMElement();
    });

    it("con el foco quieto en el campo desde hace rato, un error que llega solo también se anuncia", () => {
      vi.useFakeTimers();
      const { container, rerender } = render(<SalaInput label="Correo" />);
      act(() => screen.getByRole("textbox").focus());
      act(() => void vi.advanceTimersByTime(3000));
      rerender(<SalaInput label="Correo" error="Ese correo ya tiene cuenta" />);
      expect(anuncio(container).textContent).toBe("Correo: Ese correo ya tiene cuenta");
    });

    it("al cambiar el texto del error se vuelve a anunciar; al arreglarse, calla", () => {
      const { container, rerender } = render(<SalaInput label="Nombre" error="Ponle un nombre" />);
      rerender(<SalaInput label="Nombre" error="Muy corto" />);
      expect(anuncio(container).textContent).toBe("Nombre: Muy corto");
      rerender(<SalaInput label="Nombre" />);
      expect(anuncio(container)).toBeEmptyDOMElement();
      expect(screen.getByRole("textbox")).not.toHaveAttribute("aria-invalid");
    });

    it("un control propio en SalaField anuncia igual, con su etiqueta", () => {
      const campo = (error?: string) => (
        <SalaField label="Nota" error={error}>
          {(control) => <input type="range" {...control} />}
        </SalaField>
      );
      const { container, rerender } = render(campo());
      rerender(campo("Elige una nota"));
      expect(anuncio(container).textContent).toBe("Nota: Elige una nota");
    });
  });

  describe("obligatorio y opcional", () => {
    it("obligatorio: lo dice el control (required); la palabra de al lado es solo para la vista", () => {
      render(<SalaInput label="Nombre" required requirement="obligatorio" />);
      const campo = screen.getByRole("textbox", { name: "Nombre" });
      expect(campo).toBeRequired();
      expect(screen.getByText("obligatorio")).toHaveAttribute("aria-hidden", "true");
      expect(campo).not.toHaveAttribute("aria-describedby");
    });

    it("opcional: la palabra se ve y entra en la descripción, sin asterisco", () => {
      const { container } = render(<SalaInput label="Web" requirement="opcional" />);
      const campo = screen.getByRole("textbox", { name: "Web" });
      expect(campo).not.toBeRequired();
      expect(screen.getByText("opcional")).not.toHaveAttribute("aria-hidden");
      expect(campo).toHaveAccessibleDescription("opcional");
      expect(container.textContent).not.toContain("*");
    });
  });

  describe("deshabilitado y solo lectura", () => {
    it("deshabilitado: atributo nativo, trazo discontinuo y sin estilos de hover", () => {
      render(<SalaInput label="Nombre" disabled defaultValue="Pendientes" />);
      const campo = screen.getByRole("textbox");
      expect(campo).toBeDisabled();
      expect(campo.className).toContain("border-dashed");
      expect(campo.className).toContain("text-sala-ink-disabled");
      expect(campo.className).not.toMatch(/sala-hover:/);
    });

    it("solo lectura: atributo nativo, sigue en el orden de tabulación y se distingue por la forma", () => {
      render(<SalaInput label="Correo" readOnly defaultValue="chihiro@example.org" />);
      const campo = screen.getByRole("textbox");
      expect(campo).toHaveAttribute("readonly");
      expect(campo).not.toBeDisabled();
      expect(campo.className).toContain("border-x-0");
      expect(campo.className).toContain("border-b-sala-border");
      expect(campo.className).not.toMatch(/sala-hover:/);
    });
  });

  describe("contraseña", () => {
    it("sin revealLabel no hay botón", () => {
      render(<SalaInput label="Contraseña" type="password" />);
      expect(screen.queryByRole("button")).toBeNull();
      expect(screen.getByLabelText("Contraseña")).toHaveAttribute("type", "password");
    });

    it("el botón la enseña y la oculta: mismo nombre y aria-pressed", () => {
      render(<SalaInput label="Contraseña" type="password" revealLabel="Mostrar contraseña" defaultValue="aburaya" autoComplete="current-password" />);
      const campo = screen.getByLabelText("Contraseña");
      const boton = screen.getByRole("button", { name: "Mostrar contraseña" });
      expect(boton).toHaveAttribute("type", "button");
      expect(boton).toHaveAttribute("aria-pressed", "false");
      // Sin `aria-controls`: no aporta nada a quien usa lector y hay lectores que lo anuncian.
      expect(boton).not.toHaveAttribute("aria-controls");
      // El dibujo hereda el color del botón, también con colores forzados.
      expect(boton.querySelector("svg")).not.toHaveAttribute("class");

      fireEvent.click(boton);
      expect(campo).toHaveAttribute("type", "text");
      expect(screen.getByRole("button", { name: "Mostrar contraseña" })).toHaveAttribute("aria-pressed", "true");
      // Lo escrito no se pierde y a la vista tampoco pasa por el corrector.
      expect(campo).toHaveValue("aburaya");
      expect(campo).toHaveAttribute("spellcheck", "false");
      expect(campo).toHaveAttribute("autocomplete", "current-password");

      fireEvent.click(boton);
      expect(campo).toHaveAttribute("type", "password");
      expect(boton).toHaveAttribute("aria-pressed", "false");
    });

    it("al enviar el formulario vuelve a ocultarse", () => {
      const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        // Ya está oculta cuando el formulario se recoge.
        return (event.currentTarget.elements.namedItem("clave") as HTMLInputElement).type;
      });
      render(
        <form onSubmit={onSubmit}>
          <SalaInput label="Contraseña" name="clave" type="password" revealLabel="Mostrar contraseña" defaultValue="aburaya" />
          <button type="submit">Entrar</button>
        </form>
      );
      const campo = screen.getByLabelText("Contraseña");
      fireEvent.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
      expect(campo).toHaveAttribute("type", "text");
      fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
      expect(onSubmit).toHaveReturnedWith("password");
      expect(campo).toHaveAttribute("type", "password");
      expect(campo).toHaveValue("aburaya");
      expect(screen.getByRole("button", { name: "Mostrar contraseña" })).toHaveAttribute("aria-pressed", "false");
    });

    it("deshabilitada, el botón tampoco se puede pulsar", () => {
      render(<SalaInput label="Contraseña" type="password" revealLabel="Mostrar contraseña" disabled />);
      expect(screen.getByRole("button", { name: "Mostrar contraseña" })).toBeDisabled();
    });

    it("revealLabel en un campo que no es contraseña no pinta nada", () => {
      render(<SalaInput label="Nombre" revealLabel="Mostrar contraseña" />);
      expect(screen.queryByRole("button")).toBeNull();
    });
  });

  describe("contador", () => {
    it("cuenta lo escrito, entra en la descripción y marca el tope", () => {
      render(<SalaInput label="Etiqueta" maxLength={5} counter={contador} defaultValue="abc" />);
      const campo = screen.getByRole("textbox");
      expect(campo).toHaveAttribute("maxlength", "5");
      expect(campo).toHaveAccessibleDescription("3 de 5");
      fireEvent.change(campo, { target: { value: "abcde" } });
      expect(campo).toHaveAccessibleDescription("5 de 5");
      const cuenta = screen.getByText("5 de 5", { selector: "p" });
      expect(cuenta).toHaveAttribute("data-full", "true");
      // El tope no se dice solo con color.
      expect(cuenta.className).toContain("font-bold");
    });

    it("con value sigue al valor de fuera y llama a onChange", () => {
      const onChange = vi.fn();
      function Controlado() {
        const [valor, setValor] = useState("ab");
        return (
          <SalaInput
            label="Etiqueta"
            maxLength={10}
            counter={contador}
            value={valor}
            onChange={(event) => {
              onChange(event.target.value);
              setValor(event.target.value);
            }}
          />
        );
      }
      render(<Controlado />);
      expect(screen.getByRole("textbox")).toHaveAccessibleDescription("2 de 10");
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "abcd" } });
      expect(onChange).toHaveBeenCalledWith("abcd");
      expect(screen.getByRole("textbox")).toHaveAccessibleDescription("4 de 10");
    });

    it("al vaciar el formulario (reset) vuelve a contar", () => {
      vi.useFakeTimers();
      render(
        <form>
          <SalaInput label="Etiqueta" maxLength={10} counter={contador} />
          <button type="reset">Vaciar</button>
        </form>
      );
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "abcd" } });
      expect(screen.getByRole("textbox")).toHaveAccessibleDescription("4 de 10");
      fireEvent.click(screen.getByRole("button", { name: "Vaciar" }));
      act(() => void vi.advanceTimersByTime(10));
      expect(screen.getByRole("textbox")).toHaveAccessibleDescription("0 de 10");
    });

    it("sin maxLength o sin counter no hay contador", () => {
      render(<SalaInput label="Etiqueta" maxLength={5} />);
      expect(screen.getByRole("textbox")).not.toHaveAttribute("aria-describedby");
    });
  });

  it("leading es adorno; trailing es un control que se queda dentro del campo", () => {
    render(<SalaInput label="Buscar" type="search" leading={<svg data-testid="lupa" />} trailing={<button type="button">Borrar</button>} />);
    expect(screen.getByTestId("lupa").parentElement).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("button", { name: "Borrar" })).toBeInTheDocument();
    const campo = screen.getByRole("searchbox", { name: "Buscar" });
    expect(campo.className).toContain("pl-11");
    expect(campo.className).toContain("pr-14");
  });

  it("etiquetas y errores largos se parten (WCAG 1.4.10)", () => {
    render(<SalaInput label="Supercalifragilisticoespialidoso" error="Donaudampfschifffahrtsgesellschaft" />);
    expect(screen.getByText("Supercalifragilisticoespialidoso").className).toContain("[overflow-wrap:anywhere]");
    expect(screen.getByText("Donaudampfschifffahrtsgesellschaft").className).toContain("[overflow-wrap:anywhere]");
  });
});

describe("SalaTextarea", () => {
  it("es un <textarea> nativo con etiqueta, ayuda, error, ref y props nativas", () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<SalaTextarea ref={ref} label="Tu reseña" name="resena" rows={6} hint="Sin destripar" error="Escribe algo" required requirement="obligatorio" />);
    const area = screen.getByRole("textbox", { name: "Tu reseña" });
    expect(ref.current).toBe(area);
    expect(area.tagName).toBe("TEXTAREA");
    expect(area).toHaveAttribute("rows", "6");
    expect(area).toHaveAttribute("name", "resena");
    expect(area).toBeRequired();
    expect(area).toHaveAttribute("aria-invalid", "true");
    expect(area).toHaveAccessibleDescription("Escribe algo Sin destripar");
    expect(area.className).toContain("resize-y");
  });

  it("lleva contador", async () => {
    const user = userEvent.setup();
    render(<SalaTextarea label="Nota" maxLength={20} counter={contador} />);
    const area = screen.getByRole("textbox");
    expect(area).toHaveAccessibleDescription("0 de 20");
    await user.type(area, "hola");
    expect(area).toHaveAccessibleDescription("4 de 20");
  });

  it("deshabilitado y solo lectura", () => {
    const { rerender } = render(<SalaTextarea label="Nota" disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.getByRole("textbox").className).toContain("border-dashed");
    rerender(<SalaTextarea label="Nota" readOnly />);
    expect(screen.getByRole("textbox")).toHaveAttribute("readonly");
    expect(screen.getByRole("textbox").className).toContain("border-x-0");
  });
});

describe("SalaSelect", () => {
  const opciones = (
    <>
      <option value="">Elige un formato</option>
      <option value="manga">Manga</option>
      <option value="anime">Anime</option>
    </>
  );

  it("es un <select> nativo con sus opciones, ref y props nativas", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLSelectElement>();
    const onChange = vi.fn();
    render(
      <SalaSelect ref={ref} label="Formato" name="formato" defaultValue="" onChange={(event) => onChange(event.target.value)}>
        {opciones}
      </SalaSelect>
    );
    const select = screen.getByRole("combobox", { name: "Formato" });
    expect(ref.current).toBe(select);
    expect(select.tagName).toBe("SELECT");
    expect(select).toHaveAttribute("name", "formato");
    await user.selectOptions(select, "anime");
    expect(select).toHaveValue("anime");
    expect(onChange).toHaveBeenCalledWith("anime");
    // La flecha es adorno.
    expect(select.parentElement!.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(select.className).toContain("min-h-sala-target");
  });

  it("obligatorio, con ayuda y error", () => {
    render(
      <SalaSelect label="Formato" required requirement="obligatorio" hint="Se puede cambiar" error="Elige un formato">
        {opciones}
      </SalaSelect>
    );
    const select = screen.getByRole("combobox", { name: "Formato" });
    expect(select).toBeRequired();
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(select).toHaveAccessibleDescription("Elige un formato Se puede cambiar");
  });

  it("deshabilitado", () => {
    render(
      <SalaSelect label="Formato" disabled>
        {opciones}
      </SalaSelect>
    );
    expect(screen.getByRole("combobox")).toBeDisabled();
    expect(screen.getByRole("combobox").className).toContain("border-dashed");
    expect(screen.getByRole("combobox").className).not.toContain("cursor-pointer");
  });
});
