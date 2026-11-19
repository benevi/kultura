import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { KInput } from "./KInput";

const meta = {
  title: "UI/KInput",
  component: KInput,
  args: { label: "Nombre de la lista", placeholder: "Pendientes de verano" },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof KInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};

export const ConValor: Story = {
  name: "Con valor",
  args: { defaultValue: "Clásicos del cine negro" },
};

export const ConAyuda: Story = {
  name: "Con ayuda",
  args: { hint: "Máximo 60 caracteres." },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText("Nombre de la lista")).toHaveAccessibleDescription(
      "Máximo 60 caracteres."
    );
  },
};

/** Foco de teclado: contorno pink de 2 px con separación. */
export const Foco: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab();
    await expect(canvas.getByLabelText("Nombre de la lista")).toHaveFocus();
  },
};

/** Error: `aria-invalid`, mensaje con `role="alert"` enlazado al campo. */
export const ConError: Story = {
  name: "Con error",
  args: { defaultValue: "", error: "Escribe un nombre para la lista." },
  play: async ({ canvas }) => {
    const campo = canvas.getByLabelText("Nombre de la lista");
    await expect(campo).toHaveAttribute("aria-invalid", "true");
    await expect(campo).toHaveAccessibleDescription("Escribe un nombre para la lista.");
    await expect(canvas.getByRole("alert")).toBeVisible();
  },
};

export const Deshabilitado: Story = {
  args: { disabled: true, defaultValue: "Clásicos del cine negro" },
};

export const Correo: Story = {
  name: "Correo electrónico",
  args: { type: "email", label: "Correo electrónico", placeholder: "tu@correo.com", autoComplete: "email" },
};
