import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { KButton } from "./KButton";

const meta = {
  title: "UI/KButton",
  component: KButton,
  args: { children: "Guardar" },
  argTypes: {
    variant: { control: "inline-radio", options: ["primary", "secondary", "tonal", "danger"] },
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
  },
} satisfies Meta<typeof KButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primario: Story = {};

export const Secundario: Story = {
  args: { variant: "secondary", children: "Cancelar" },
};

export const Tamanos: Story = {
  name: "Tamaños",
  render: (args) => (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <KButton {...args} size="sm">
        Pequeño
      </KButton>
      <KButton {...args} size="md">
        Mediano
      </KButton>
      <KButton {...args} size="lg">
        Grande
      </KButton>
    </div>
  ),
};

/**
 * Foco de teclado: contorno (`outline`) pink de 2 px separado 2 px. Con
 * colores forzados se pinta con el color del sistema (el `ring` de antes,
 * una sombra, desaparecía).
 */
export const Foco: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab();
    const boton = canvas.getByRole("button", { name: "Guardar" });
    await expect(boton).toHaveFocus();
    await expect(getComputedStyle(boton).outlineStyle).toBe("solid");
    await expect(getComputedStyle(boton).outlineWidth).toBe("2px");
    await expect(getComputedStyle(boton).outlineOffset).toBe("2px");
  },
};

/** El foco en las cuatro variantes, una tras otra con el tabulador. */
export const FocoVariantes: Story = {
  name: "Foco en cada variante",
  render: (args) => (
    <div className="flex flex-wrap items-center gap-4">
      <KButton {...args} variant="primary">
        Guardar
      </KButton>
      <KButton {...args} variant="secondary">
        Cancelar
      </KButton>
      <KButton {...args} variant="tonal">
        Compartir
      </KButton>
      <KButton {...args} variant="danger">
        Bloquear
      </KButton>
    </div>
  ),
  play: async ({ canvas, userEvent }) => {
    for (const name of ["Guardar", "Cancelar", "Compartir", "Bloquear"]) {
      await userEvent.tab();
      const boton = canvas.getByRole("button", { name });
      await expect(boton).toHaveFocus();
      await expect(getComputedStyle(boton).outlineStyle).toBe("solid");
    }
  },
};

/**
 * Tonal: fondo un paso más claro y sin borde, para lo que no compite con el
 * primario (compartir, ir a ajustes). Al pasar el ratón el texto se vuelve pink.
 */
export const Tonal: Story = {
  args: { variant: "tonal", children: "Compartir" },
};

/**
 * Peligro discreto: el secundario apagado, que se tiñe de rojo al pasar el
 * ratón (bloquear, salir, reportar). El texto nombra lo que se pierde.
 */
export const PeligroDiscreto: Story = {
  name: "Peligro discreto",
  args: { variant: "danger", size: "sm", children: "Bloquear" },
};

export const Deshabilitado: Story = {
  args: { disabled: true },
};

export const SecundarioDeshabilitado: Story = {
  name: "Secundario deshabilitado",
  args: { variant: "secondary", disabled: true, children: "Cancelar" },
};

/** `loading` deshabilita el botón, marca `aria-busy` y conserva el texto. */
export const Cargando: Story = {
  args: { loading: true, children: "Guardando…" },
  play: async ({ canvas }) => {
    const boton = canvas.getByRole("button", { name: "Guardando…" });
    await expect(boton).toBeDisabled();
    await expect(boton).toHaveAttribute("aria-busy", "true");
  },
};

/** `asChild`: el mismo acabado sobre un enlace. */
export const ComoEnlace: Story = {
  name: "Como enlace (asChild)",
  args: { asChild: true, children: <a href="#destino">Ver la ficha</a> },
};
