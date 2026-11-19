import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SALA_TOAST_ERROR_MIN_MS,
  SALA_TOAST_LONG_MS,
  SALA_TOAST_MAX_MS,
  SALA_TOAST_MS,
  SalaToastProvider,
  salaToastDuration,
  useSalaToast,
  type SalaToastApi,
} from "@/components/sala/SalaToast";

const ETIQUETAS = { region: "Avisos (F8)", dismiss: "Cerrar el aviso" };

let toast: SalaToastApi;
function Captura() {
  toast = useSalaToast();
  return <button>Guardar</button>;
}

const montar = () =>
  render(
    <SalaToastProvider labels={ETIQUETAS}>
      <Captura />
    </SalaToastProvider>
  );

const zona = () => screen.getByRole("region", { name: "Avisos (F8)" });
const avisos = () => Array.from(zona().querySelectorAll<HTMLElement>("[data-sala-toast]"));
const viva = (cual: "assertive" | "polite") => zona().querySelector<HTMLElement>(`[data-sala-toast-live="${cual}"]`)!;
const pasar = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const mostrar = (...args: Parameters<SalaToastApi["show"]>) => act(() => toast.show(...args));

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("salaToastDuration", () => {
  it("5 s un aviso; 8 s un error o un aviso con acción", () => {
    expect(salaToastDuration({ type: "info", message: "Hecho" })).toBe(SALA_TOAST_MS);
    expect(salaToastDuration({ type: "success", message: "Hecho" })).toBe(SALA_TOAST_MS);
    expect(salaToastDuration({ type: "error", message: "Falló" })).toBe(SALA_TOAST_LONG_MS);
    expect(salaToastDuration({ type: "info", message: "Quitada", action: { label: "Deshacer", onAction: () => {} } })).toBe(SALA_TOAST_LONG_MS);
  });

  it("un texto largo dura más, hasta un tope", () => {
    const largo = salaToastDuration({ type: "info", message: "a".repeat(140) });
    expect(largo).toBeGreaterThan(SALA_TOAST_MS);
    expect(salaToastDuration({ type: "info", message: "a".repeat(2000) })).toBe(SALA_TOAST_MAX_MS);
  });

  it("respeta la duración pedida, salvo que un error nunca baja de 6 s", () => {
    expect(salaToastDuration({ type: "info", message: "x", duration: 1000 })).toBe(1000);
    expect(salaToastDuration({ type: "error", message: "x", duration: 1000 })).toBe(SALA_TOAST_ERROR_MIN_MS);
    expect(salaToastDuration({ type: "error", message: "x", duration: Infinity })).toBe(Infinity);
  });
});

describe("SalaToastProvider", () => {
  it("useSalaToast fuera del proveedor avisa", () => {
    const callar = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Captura />)).toThrow(/SalaToastProvider/);
    callar.mockRestore();
  });

  it("las regiones vivas existen desde el principio, vacías, dentro de una zona con nombre", () => {
    montar();
    expect(zona()).toBeInTheDocument();
    expect(viva("polite")).toHaveAttribute("role", "status");
    // `aria-live` escrito: es lo que Radix deja en el árbol con un diálogo abierto.
    expect(viva("polite")).toHaveAttribute("aria-live", "polite");
    expect(viva("assertive")).toHaveAttribute("aria-live", "assertive");
    expect(viva("polite")).toBeEmptyDOMElement();
    expect(viva("assertive")).toBeEmptyDOMElement();
  });

  it("un aviso entra en la región que espera; un error, en la que interrumpe", () => {
    montar();
    mostrar({ message: "Guardada.", type: "success" });
    expect(viva("polite")).toHaveTextContent("Guardada.");
    expect(viva("assertive")).toBeEmptyDOMElement();
    act(() => toast.showError("No se ha podido guardar."));
    expect(viva("assertive")).toHaveTextContent("No se ha podido guardar.");
    expect(viva("polite")).not.toHaveTextContent("No se ha podido guardar.");
  });

  it("no roba el foco", () => {
    montar();
    const guardar = screen.getByRole("button", { name: "Guardar" });
    guardar.focus();
    mostrar({ message: "Guardada." });
    expect(guardar).toHaveFocus();
  });

  it("cada tipo lleva su dibujo y ninguno lleva sombra ni esquinas", () => {
    montar();
    mostrar({ message: "Info" });
    mostrar({ message: "Hecho", type: "success" });
    act(() => toast.showError("Error"));
    const formas = avisos().map((aviso) => aviso.querySelector("svg path")!.getAttribute("d"));
    expect(new Set(formas).size).toBe(3);
    for (const aviso of avisos()) {
      expect(aviso.className).not.toMatch(/rounded|shadow/);
      // Borde transparente: con colores forzados es lo que deja ver la caja.
      expect(aviso.className).toContain("border-2 border-transparent");
    }
  });

  it("se va solo a su tiempo", () => {
    montar();
    mostrar({ message: "Guardada." });
    pasar(SALA_TOAST_MS - 1);
    expect(avisos()).toHaveLength(1);
    pasar(1);
    expect(avisos()).toHaveLength(0);
  });

  it("un error dura 8 s y, con persistent, no se va", () => {
    montar();
    act(() => toast.showError("Falló"));
    pasar(SALA_TOAST_LONG_MS - 1);
    expect(avisos()).toHaveLength(1);
    pasar(1);
    expect(avisos()).toHaveLength(0);
    act(() => toast.showError("Falló otra vez", { persistent: true }));
    pasar(60_000);
    expect(avisos()).toHaveLength(1);
  });

  it("cola de tres: el cuarto desplaza al más viejo, que caduca", () => {
    montar();
    const onExpire = vi.fn();
    mostrar({ message: "Uno", action: { label: "Deshacer", onAction: vi.fn(), onExpire } });
    mostrar({ message: "Dos" });
    mostrar({ message: "Tres" });
    expect(onExpire).not.toHaveBeenCalled();
    mostrar({ message: "Cuatro" });
    expect(avisos()).toHaveLength(3);
    expect(zona()).not.toHaveTextContent("Uno");
    expect(zona()).toHaveTextContent("Cuatro");
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  describe("el reloj se para (WCAG 2.2.1)", () => {
    it("con el puntero encima, y sigue donde iba al salir", () => {
      montar();
      mostrar({ message: "Guardada." });
      pasar(3000);
      fireEvent.pointerEnter(zona());
      pasar(60_000);
      expect(avisos()).toHaveLength(1);
      fireEvent.pointerLeave(zona());
      pasar(SALA_TOAST_MS - 3000 - 1);
      expect(avisos()).toHaveLength(1);
      pasar(1);
      expect(avisos()).toHaveLength(0);
    });

    it("con el foco dentro", () => {
      montar();
      mostrar({ message: "Guardada." });
      act(() => within(avisos()[0]).getByRole("button", { name: "Cerrar el aviso" }).focus());
      pasar(60_000);
      expect(avisos()).toHaveLength(1);
      act(() => screen.getByRole("button", { name: "Guardar" }).focus());
      pasar(SALA_TOAST_MS);
      expect(avisos()).toHaveLength(0);
    });

    it("con la pestaña en segundo plano", () => {
      montar();
      mostrar({ message: "Guardada." });
      const visibilidad = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
      act(() => void document.dispatchEvent(new Event("visibilitychange")));
      pasar(60_000);
      expect(avisos()).toHaveLength(1);
      visibilidad.mockReturnValue("visible");
      act(() => void document.dispatchEvent(new Event("visibilitychange")));
      pasar(SALA_TOAST_MS);
      expect(avisos()).toHaveLength(0);
      visibilidad.mockRestore();
    });
  });

  describe("teclado", () => {
    it("F8 lleva el foco al aviso más reciente; Escape lo cierra y el foco vuelve", () => {
      montar();
      const guardar = screen.getByRole("button", { name: "Guardar" });
      guardar.focus();
      mostrar({ message: "Uno" });
      mostrar({ message: "Dos" });
      fireEvent.keyDown(document, { key: "F8" });
      const cerrar = within(avisos()[1]).getByRole("button", { name: "Cerrar el aviso" });
      expect(cerrar).toHaveFocus();
      fireEvent.keyDown(cerrar, { key: "Escape" });
      expect(zona()).not.toHaveTextContent("Dos");
      // Queda otro aviso: el foco pasa a él, no se pierde.
      expect(within(avisos()[0]).getByRole("button", { name: "Cerrar el aviso" })).toHaveFocus();
      fireEvent.keyDown(document.activeElement!, { key: "Escape" });
      expect(avisos()).toHaveLength(0);
      expect(guardar).toHaveFocus();
    });

    it("tras cerrar con el foco dentro, el siguiente aviso no nace con el reloj parado", () => {
      montar();
      screen.getByRole("button", { name: "Guardar" }).focus();
      mostrar({ message: "Uno" });
      fireEvent.keyDown(document, { key: "F8" });
      fireEvent.click(document.activeElement!);
      expect(avisos()).toHaveLength(0);
      mostrar({ message: "Dos" });
      pasar(SALA_TOAST_MS);
      expect(avisos()).toHaveLength(0);
    });

    it("sin avisos, F8 no hace nada", () => {
      montar();
      const guardar = screen.getByRole("button", { name: "Guardar" });
      guardar.focus();
      fireEvent.keyDown(document, { key: "F8" });
      expect(guardar).toHaveFocus();
    });
  });

  describe("acción", () => {
    it("pulsarla la ejecuta y cierra el aviso, sin caducar", () => {
      montar();
      const onAction = vi.fn();
      const onExpire = vi.fn();
      mostrar({ message: "Quitada.", action: { label: "Deshacer", onAction, onExpire } });
      fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
      expect(onAction).toHaveBeenCalledTimes(1);
      expect(avisos()).toHaveLength(0);
      pasar(60_000);
      expect(onExpire).not.toHaveBeenCalled();
    });

    it("si se va sin pulsarla (tiempo o aspa), caduca una vez", () => {
      montar();
      const onExpire = vi.fn();
      mostrar({ message: "Quitada.", action: { label: "Deshacer", onAction: vi.fn(), onExpire } });
      pasar(SALA_TOAST_LONG_MS);
      expect(onExpire).toHaveBeenCalledTimes(1);
      mostrar({ message: "Quitada.", action: { label: "Deshacer", onAction: vi.fn(), onExpire } });
      fireEvent.click(within(avisos()[0]).getByRole("button", { name: "Cerrar el aviso" }));
      expect(onExpire).toHaveBeenCalledTimes(2);
      pasar(60_000);
      expect(onExpire).toHaveBeenCalledTimes(2);
    });

    it("autoFocus lleva el foco a la acción al aparecer", () => {
      montar();
      mostrar({ message: "Quitada.", action: { label: "Deshacer", onAction: vi.fn(), autoFocus: true } });
      expect(screen.getByRole("button", { name: "Deshacer" })).toHaveFocus();
    });
  });

  it("deslizar en táctil lo descarta; con el ratón, no", () => {
    montar();
    mostrar({ message: "Uno", duration: Infinity });
    const aviso = avisos()[0];
    fireEvent.pointerDown(aviso, { pointerType: "mouse", pointerId: 1, clientX: 0 });
    fireEvent.pointerUp(aviso, { pointerType: "mouse", pointerId: 1, clientX: 200 });
    expect(avisos()).toHaveLength(1);
    fireEvent.pointerDown(aviso, { pointerType: "touch", pointerId: 2, clientX: 0 });
    fireEvent.pointerMove(aviso, { pointerType: "touch", pointerId: 2, clientX: 30 });
    fireEvent.pointerUp(aviso, { pointerType: "touch", pointerId: 2, clientX: 30 });
    expect(avisos()).toHaveLength(1);
    fireEvent.pointerDown(aviso, { pointerType: "touch", pointerId: 3, clientX: 0 });
    fireEvent.pointerUp(aviso, { pointerType: "touch", pointerId: 3, clientX: 120 });
    expect(avisos()).toHaveLength(0);
  });

  it("WCAG 2.4.11: si la pila tapa el control con el foco, se pasa arriba", () => {
    montar();
    const guardar = screen.getByRole("button", { name: "Guardar" });
    const caja = (top: number) => ({ top, bottom: top + 50, left: 0, right: 100, width: 100, height: 50, x: 0, y: top, toJSON: () => ({}) });
    guardar.getBoundingClientRect = () => caja(700);
    mostrar({ message: "Uno", duration: Infinity });
    avisos()[0].getBoundingClientRect = () => caja(690);
    expect(zona()).toHaveAttribute("data-sala-toast-viewport", "bottom");
    act(() => guardar.focus());
    expect(zona()).toHaveAttribute("data-sala-toast-viewport", "top");
    // Los huecos de la zona no reciben clics; los avisos, sí.
    expect(zona().className).toContain("pointer-events-none");
    expect(avisos()[0].className).toContain("pointer-events-auto");
  });

  it("dismiss(id) no existe sin id conocido: no rompe", () => {
    montar();
    mostrar({ message: "Uno" });
    act(() => toast.dismiss("no-existe"));
    expect(avisos()).toHaveLength(1);
  });

  it("los botones miden 48 px y llevan el foco a la vista sobre su bloque", () => {
    montar();
    mostrar({ message: "Quitada.", action: { label: "Deshacer", onAction: vi.fn() } });
    for (const boton of within(avisos()[0]).getAllByRole("button")) {
      expect(boton.className).toContain("min-h-sala-target");
      expect(boton.className).toContain("sala-focused:[outline:3px_solid_currentColor]");
    }
  });
});
