import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect } from "storybook/test";
import { KInput } from "./KInput";
import { Select, type SelectProps } from "./Select";

const OPCIONES = [
  { value: "completed", label: "Completada" },
  { value: "in_progress", label: "En curso" },
  { value: "pending", label: "Pendiente" },
  { value: "abandoned", label: "Abandonada" },
];

/** El `Select` es controlado: la historia guarda el valor elegido. */
function Controlado(props: SelectProps) {
  const [value, setValue] = useState(props.value);
  return <Select {...props} value={value} onChange={setValue} />;
}

const meta = {
  title: "UI/Select",
  component: Select,
  args: { label: "Estado", options: OPCIONES, value: "completed", onChange: () => {} },
  render: (args) => <Controlado {...args} />,
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText("Estado").tagName).toBe("SELECT");
  },
};

/** Foco de teclado: contorno pink de 2 px con separación, como `KInput`. */
export const Foco: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab();
    await expect(canvas.getByLabelText("Estado")).toHaveFocus();
  },
};

export const ConAyuda: Story = {
  name: "Con ayuda",
  args: { hint: "Puedes cambiarlo cuando quieras." },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText("Estado")).toHaveAccessibleDescription("Puedes cambiarlo cuando quieras.");
  },
};

export const ConError: Story = {
  name: "Con error",
  args: { error: "Elige un estado." },
  play: async ({ canvas }) => {
    const campo = canvas.getByLabelText("Estado");
    await expect(campo).toHaveAttribute("aria-invalid", "true");
    await expect(campo).toHaveAccessibleDescription("Elige un estado.");
    await expect(canvas.getByRole("alert")).toBeVisible();
  },
};

/**
 * Junto a un `KInput`, como en «Añadir a biblioteca» y «Crear lista»: la misma
 * caja (radio, fondo, borde, relleno y alto) y la misma etiqueta.
 */
export const JuntoAKInput: Story = {
  name: "Junto a KInput",
  render: (args) => (
    <div className="flex flex-col gap-5">
      <Controlado {...args} />
      <KInput label="Fecha" type="date" defaultValue="2026-11-20" />
    </div>
  ),
  play: async ({ canvas }) => {
    const select = canvas.getByLabelText("Estado");
    const campo = canvas.getByLabelText("Fecha");
    const a = getComputedStyle(campo);
    const b = getComputedStyle(select);
    for (const prop of ["borderTopLeftRadius", "backgroundColor", "borderTopColor", "paddingLeft", "fontSize"] as const) {
      await expect(b[prop]).toBe(a[prop]);
    }
    const la = getComputedStyle(campo.closest("div")!.querySelector("label")!);
    const lb = getComputedStyle(select.closest("div")!.querySelector("label")!);
    await expect(lb.fontSize).toBe(la.fontSize);
    await expect(lb.fontWeight).toBe(la.fontWeight);
    await expect(lb.color).toBe(la.color);
  },
};
