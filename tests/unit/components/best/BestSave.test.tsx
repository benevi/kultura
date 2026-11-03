/**
 * «Guardar» de un ranking cacheado: sin cuenta abierta manda al alta con vuelta a la
 * ficha para guardarlo; con la cuenta abierta, a la ficha; y con la cuenta abierta esconde la
 * barra de alta (el HTML cacheado no sabe quién lo mira).
 */
import { render, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BestSaveEnhancer } from "@/components/best/BestSave";

const assign = vi.fn();
const realLocation = window.location;

function page() {
  return render(
    <div>
      <a href="/es/media/anime/al-1" data-best-save="anime_al-1">
        Guardar
      </a>
      <a href="/es/media/anime/al-2">Ficha</a>
      <section data-best-signup="" className="fixed flex">
        alta
      </section>
      <BestSaveEnhancer locale="es" />
    </div>,
  );
}

function clearCookies() {
  for (const c of document.cookie.split(";")) {
    const name = c.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

beforeEach(() => {
  assign.mockReset();
  Object.defineProperty(window, "location", { configurable: true, value: { ...realLocation, assign } });
  clearCookies();
});
afterEach(() => {
  Object.defineProperty(window, "location", { configurable: true, value: realLocation });
  clearCookies();
});

describe("BestSaveEnhancer", () => {
  it("sin cuenta abierta: alta con vuelta a la ficha para guardarlo", () => {
    const { getByText, container } = page();
    fireEvent.click(getByText("Guardar"));
    expect(assign).toHaveBeenCalledWith(
      `/es/login?mode=register&next=${encodeURIComponent("/es/media/anime/al-1?guardar=1")}`,
    );
    expect(container.querySelector<HTMLElement>("[data-best-signup]")!.style.display).toBe("");
  });

  it("con la cuenta abierta: directo a la ficha con ?guardar=1 y sin barra de alta", () => {
    document.cookie = "sb-test-auth-token=1; path=/";
    const { getByText, container } = page();
    fireEvent.click(getByText("Guardar"));
    expect(assign).toHaveBeenCalledWith("/es/media/anime/al-1?guardar=1");
    expect(container.querySelector<HTMLElement>("[data-best-signup]")!.style.display).toBe("none");
  });

  it("no toca los demás enlaces ni los clics con modificador (abrir en pestaña)", () => {
    const { getByText } = page();
    fireEvent.click(getByText("Ficha"));
    fireEvent.click(getByText("Guardar"), { metaKey: true });
    expect(assign).not.toHaveBeenCalled();
  });
});
