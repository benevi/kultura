import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { KButton } from "./KButton";

const meta = {
  title: "UI/KButton",
  component: KButton,
  args: { children: "Guardar" },
  argTypes: {
    variant: { control: "inline-radio", options: ["primary", "secondary"] },
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

/** Foco de teclado: anillo pink de 2 px con separación. */
export const Foco: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab();
    await expect(canvas.getByRole("button", { name: "Guardar" })).toHaveFocus();
  },
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
