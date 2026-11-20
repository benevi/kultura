import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { KInput } from "./KInput";
import { KTextarea } from "./KTextarea";

const meta = {
  title: "UI/KTextarea",
  component: KTextarea,
  args: { label: "Descripción", placeholder: "¿De qué va esta lista?", rows: 3 },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof KTextarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};

export const ConValor: Story = {
  name: "Con valor",
  args: { defaultValue: "Las que vimos en el cineclub del barrio, por orden." },
};

export const ConAyuda: Story = {
  name: "Con ayuda",
  args: { hint: "Quedan 500 caracteres." },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText("Descripción")).toHaveAccessibleDescription("Quedan 500 caracteres.");
  },
};

/** Foco de teclado: contorno pink de 2 px con separación, como `KInput`. */
export const Foco: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab();
    await expect(canvas.getByLabelText("Descripción")).toHaveFocus();
  },
};

/** Error: `aria-invalid`, mensaje con `role="alert"` enlazado al campo. */
export const ConError: Story = {
  name: "Con error",
  args: { error: "Escribe al menos 10 caracteres." },
  play: async ({ canvas }) => {
    const campo = canvas.getByLabelText("Descripción");
    await expect(campo).toHaveAttribute("aria-invalid", "true");
    await expect(campo).toHaveAccessibleDescription("Escribe al menos 10 caracteres.");
    await expect(canvas.getByRole("alert")).toBeVisible();
  },
};

export const Deshabilitado: Story = {
  args: { disabled: true, defaultValue: "Las que vimos en el cineclub del barrio." },
};

/** Junto a un `KInput`: la misma caja, la misma etiqueta y el mismo ancho. */
export const JuntoAKInput: Story = {
  name: "Junto a KInput",
  render: (args) => (
    <div className="flex flex-col gap-5">
      <KInput label="Nombre de la lista" placeholder="Pendientes de verano" />
      <KTextarea {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    const campo = canvas.getByLabelText("Nombre de la lista");
    const area = canvas.getByLabelText("Descripción");
    const a = getComputedStyle(campo);
    const b = getComputedStyle(area);
    for (const prop of ["borderTopLeftRadius", "backgroundColor", "borderTopColor", "paddingLeft", "fontSize"] as const) {
      await expect(b[prop]).toBe(a[prop]);
    }
  },
};
