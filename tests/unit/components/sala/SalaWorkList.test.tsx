import { createRef, type ComponentProps, type Ref } from "react";
import { render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SalaWorkCard } from "@/components/sala/SalaWorkCard";
import { SalaWorkList, type SalaWorkListProps } from "@/components/sala/SalaWorkList";

vi.mock("next/image", () => ({
  default: ({ fill, priority, loader, ...rest }: ComponentProps<"img"> & { fill?: boolean; priority?: boolean; loader?: unknown }) => {
    void fill;
    void priority;
    void loader;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- doble de pruebas; `alt` va en `rest`
    return <img {...rest} />;
  },
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: ComponentProps<"a">) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const OBRAS = ["Parásitos", "Berserk", "Watchmen"];

function Lista({ obras = OBRAS, ...props }: Partial<SalaWorkListProps> & { obras?: string[]; ref?: Ref<HTMLUListElement> }) {
  return (
    <SalaWorkList aria-label="Tu biblioteca" loadingLabel="Cargando tu biblioteca" loadedLabel={`${obras.length} obras`} {...props}>
      {obras.map((titulo, i) => (
        <SalaWorkCard key={titulo} href={`/media/movie/${i}`} title={titulo} format="movie" formatLabel="Película" />
      ))}
    </SalaWorkList>
  );
}

const estado = () => screen.getByRole("status");

describe("SalaWorkList", () => {
  describe("lista", () => {
    it("una lista de verdad, con nombre y un elemento por tarjeta", () => {
      render(<Lista />);
      const lista = screen.getByRole("list", { name: "Tu biblioteca" });
      expect(lista.tagName).toBe("UL");
      const elementos = within(lista).getAllByRole("listitem");
      expect(elementos).toHaveLength(3);
      // Cada tarjeta, dentro de su <li>.
      elementos.forEach((li, i) => expect(within(li).getByRole("link")).toHaveAccessibleName(OBRAS[i]));
    });

    it("ordered la hace <ol>, y sigue siendo una lista", () => {
      render(<Lista ordered />);
      expect(screen.getByRole("list", { name: "Tu biblioteca" }).tagName).toBe("OL");
    });

    it("no pone un <li> a lo que no pinta nada", () => {
      render(
        <SalaWorkList aria-label="Tu biblioteca" loadingLabel="Cargando">
          {null}
          {false}
          <span>Una</span>
        </SalaWorkList>
      );
      expect(screen.getAllByRole("listitem")).toHaveLength(1);
    });

    it("ref, className y las props nativas llegan a la lista; itemClassName, a cada elemento", () => {
      const ref = createRef<HTMLUListElement>();
      render(<Lista ref={ref} className="grid grid-cols-2" itemClassName="snap-start" id="biblioteca" />);
      const lista = screen.getByRole("list");
      expect(ref.current).toBe(lista);
      expect(lista).toHaveAttribute("id", "biblioteca");
      expect(lista.className).toContain("grid-cols-2");
      for (const li of screen.getAllByRole("listitem")) expect(li.className).toContain("snap-start");
    });

    it("sale del servidor entera, con la región viva vacía", () => {
      const html = renderToString(<Lista loading skeletons={2} />);
      const caja = document.createElement("div");
      caja.innerHTML = html;
      expect(caja.querySelectorAll("ul > li")).toHaveLength(5);
      expect(caja.querySelector('[role="status"]')!.textContent).toBe("");
    });
  });

  describe("carga", () => {
    it("la región viva está siempre, y una lista que llega hecha no dice nada", () => {
      render(<Lista />);
      expect(estado()).toBeEmptyDOMElement();
      expect(screen.getByRole("list")).not.toHaveAttribute("aria-busy");
    });

    it("nace vacía y el aviso de carga se pone después: es un cambio, que es lo que se anuncia", () => {
      const html = renderToString(<Lista loading />);
      expect(html).toMatch(/role="status"[^>]*><\/p>/);
      render(<Lista loading />);
      expect(estado()).toHaveTextContent("Cargando tu biblioteca");
      expect(screen.getByRole("list")).toHaveAttribute("aria-busy", "true");
    });

    it("al acabar, la misma región dice el resultado y la lista deja de estar ocupada", () => {
      const { rerender } = render(<Lista loading obras={[]} skeletons={6} />);
      const region = estado();
      expect(region).toHaveTextContent("Cargando tu biblioteca");
      rerender(<Lista obras={OBRAS} />);
      expect(estado()).toBe(region);
      expect(region).toHaveTextContent("3 obras");
      expect(screen.getByRole("list")).not.toHaveAttribute("aria-busy");
    });

    it("al cargar más, vuelve a avisar, y al acabar da el total nuevo", () => {
      const { rerender } = render(<Lista />);
      rerender(<Lista loading skeletons={3} />);
      expect(estado()).toHaveTextContent("Cargando tu biblioteca");
      rerender(<Lista obras={[...OBRAS, "Elden Ring"]} />);
      expect(estado()).toHaveTextContent("4 obras");
    });

    it("sin loadedLabel, al acabar la región se vacía", () => {
      const { rerender } = render(<Lista loading loadedLabel={undefined} />);
      rerender(<Lista loadedLabel={undefined} />);
      expect(estado()).toBeEmptyDOMElement();
    });

    it("los esqueletos van al final, solo mientras carga, y no cuentan como elementos", () => {
      const { container, rerender } = render(<Lista loading skeletons={4} variant="row" ratio="16/9" />);
      const lista = screen.getByRole("list");
      expect(lista.querySelectorAll(":scope > li")).toHaveLength(7);
      // Para el lector de pantalla, solo las tres obras.
      expect(within(lista).getAllByRole("listitem")).toHaveLength(3);
      const esqueletos = Array.from(lista.querySelectorAll(":scope > li[data-sala-list-skeleton]"));
      expect(esqueletos).toHaveLength(4);
      expect(esqueletos.every((li) => li.getAttribute("aria-hidden") === "true")).toBe(true);
      expect(Array.from(lista.children).slice(-4)).toEqual(esqueletos);
      // Con la forma de las tarjetas de la lista.
      expect(container.querySelectorAll('[data-sala-card-skeleton="row"]')).toHaveLength(4);
      rerender(<Lista skeletons={4} variant="row" />);
      expect(lista.querySelectorAll("[data-sala-list-skeleton]")).toHaveLength(0);
    });
  });
});
