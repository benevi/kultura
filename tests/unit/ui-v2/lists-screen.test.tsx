import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import es from "../../../messages/es.json";
import en from "../../../messages/en.json";
import type { List, ListItem } from "@/types/list";
import { ListsScreen } from "@/v2/lists/ListsScreen";
import { ListScreen } from "@/v2/lists/ListScreen";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, prefetch: _p, ...rest }: Record<string, unknown>) => (
    <a href={href as string} {...rest}>
      {children as React.ReactNode}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

// Compartir usa el proveedor de avisos de la app; aquí no se prueba.
vi.mock("@/components/social/ShareLinkButton", () => ({ ShareLinkButton: () => null }));

const list = (over: Partial<List> = {}): List =>
  ({
    id: "l1",
    ownerId: "yo",
    name: "Pelis de domingo",
    mediaType: "movie",
    isCollaborative: false,
    isPublic: false,
    description: null,
    template: null,
    itemCount: 2,
    owner: { id: "yo", username: "yo", avatarColor: "#fff", avatarInitials: "YO", createdAt: "" },
    ...over,
  }) as List;

const item = (id: string, title: string, over: Partial<ListItem> = {}): ListItem =>
  ({
    id,
    mediaId: `movie_${id}`,
    note: null,
    position: null,
    media: { id: `movie_${id}`, externalId: id, type: "movie", title, poster: null, year: 1999 },
    ...over,
  }) as ListItem;

const inEs = (ui: React.ReactElement) =>
  render(
    <NextIntlClientProvider locale="es" messages={es}>
      {ui}
    </NextIntlClientProvider>,
  );

const detail = (over: Partial<React.ComponentProps<typeof ListScreen>> = {}) => (
  <ListScreen
    list={list()}
    items={[item("1", "Matrix"), item("2", "Alien")]}
    members={[]}
    currentUserId="yo"
    currentUserFriends={[]}
    canEdit
    mixedEnabled
    {...over}
  />
);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Mis listas (UI v2)", () => {
  it("cada lista enlaza a su detalle y enseña un lomo por obra", () => {
    const { container } = inEs(
      <ListsScreen
        lists={[list()]}
        shelves={{ l1: [{ mediaId: "movie_1", type: "movie", poster: null }, { mediaId: "movie_2", type: "movie", poster: null }] }}
        currentUserId="yo"
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: es.lists.title })).toBeTruthy();
    expect(screen.getByText("Pelis de domingo").closest("a")?.getAttribute("href")).toBe("/lists/l1");
    expect(container.querySelectorAll(".k2l-spine")).toHaveLength(2);
  });

  it("sin balda (fallo de la lectura) la lista sale igual, con el tablón vacío", () => {
    const { container } = inEs(<ListsScreen lists={[list()]} shelves={{}} currentUserId="yo" />);
    expect(screen.getByText("Pelis de domingo")).toBeTruthy();
    expect(container.querySelector(".k2l-shelf")).toBeTruthy();
    expect(container.querySelector(".k2l-spine")).toBeNull();
  });

  it("vacío: enseña qué hacer y una sola forma de crear", () => {
    inEs(<ListsScreen lists={[]} shelves={{}} currentUserId="yo" />);
    expect(screen.getByText(es.lists.noLists)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: es.lists.newList })).toHaveLength(1);
  });

  it("el dueño solo se nombra si la lista es de otro", () => {
    inEs(
      <ListsScreen
        lists={[
          list(),
          list({
            id: "l2",
            ownerId: "otra",
            name: "Compartida",
            owner: { id: "otra", username: "otra_persona", avatarColor: "#fff", avatarInitials: "OT", createdAt: "" },
          } as Partial<List>),
        ]}
        shelves={{}}
        currentUserId="yo"
      />,
    );
    expect(screen.getByText(/otra_persona/)).toBeTruthy();
    expect(screen.queryByText(/· yo/)).toBeNull();
  });
});

describe("Una lista (UI v2)", () => {
  it("títulos en orden, enlazados a su ficha, con el número solo en un ranking", () => {
    const { container, unmount } = inEs(detail());
    expect(screen.getByText("Matrix", { selector: ".k2l-item__title" }).closest("a")?.getAttribute("href")).toBe("/media/movie/1");
    expect(container.querySelector(".k2l-item__rank")).toBeNull();
    unmount();

    const ranked = inEs(detail({ list: list({ template: "ranking" }) }));
    const ranks = [...ranked.container.querySelectorAll(".k2l-item__rank")].map((n) => n.textContent);
    expect(ranks).toEqual(["1", "2"]);
  });

  it("sin permiso de edición no hay controles de escritura", () => {
    inEs(detail({ canEdit: false, currentUserId: "otra" }));
    expect(screen.queryByRole("link", { name: es.lists.addItem })).toBeNull();
    expect(screen.queryByRole("button", { name: es.lists.reorder })).toBeNull();
    expect(screen.queryByRole("button", { name: es.lists.deleteList })).toBeNull();
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.queryByRole("button", { name: /Matrix/ })).toBeNull();
  });

  it("quitar un título: quita la fila y deja el foco en la que ocupa su sitio, sin mover la página", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    inEs(detail());
    fireEvent.click(screen.getByRole("button", { name: es.lists.removeItemNamed.replace("{title}", "Matrix") }));
    await waitFor(() => expect(screen.queryByText("Matrix", { selector: ".k2l-item__title" })).toBeNull());
    expect(fetchMock).toHaveBeenCalledWith("/api/lists/l1", expect.objectContaining({ method: "DELETE" }));
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: es.lists.removeItemNamed.replace("{title}", "Alien") }),
    );
  });

  it("al quitar el último título, el foco va al encabezado", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    inEs(detail({ items: [item("1", "Matrix")] }));
    fireEvent.click(screen.getByRole("button", { name: es.lists.removeItemNamed.replace("{title}", "Matrix") }));
    await waitFor(() => expect(screen.queryByText("Matrix", { selector: ".k2l-item__title" })).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 2, name: es.lists.itemsTitle }));
  });

  it("si falla al quitar, la fila sigue y se avisa", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    inEs(detail());
    fireEvent.click(screen.getByRole("button", { name: es.lists.removeItemNamed.replace("{title}", "Matrix") }));
    expect((await screen.findByRole("alert")).textContent).toBe(es.lists.removeError);
    expect(screen.getByText("Matrix", { selector: ".k2l-item__title" })).toBeTruthy();
  });

  it("cambiar la visibilidad revierte si falla", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    inEs(detail());
    expect(screen.getByText(es.collection.privateHint)).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: es.collection.public }));
    expect(await screen.findByText(es.collection.visibilityError)).toBeTruthy();
    expect(screen.getByText(es.collection.privateHint)).toBeTruthy();
  });

  it("en una lista ajena vacía no se invita a añadir nada", () => {
    inEs(detail({ items: [], canEdit: false, currentUserId: "otra" }));
    expect(screen.getByText(es.lists.noItems)).toBeTruthy();
    expect(screen.queryByRole("link", { name: es.lists.noItemsDiscover })).toBeNull();
  });

  it("lista vacía: lleva a Descubrir con el formato de la lista", () => {
    inEs(detail({ items: [] }));
    expect(screen.getByText(es.lists.noItems)).toBeTruthy();
    expect(screen.getByRole("link", { name: es.lists.noItemsDiscover }).getAttribute("href")).toBe(
      "/discover?type=movie",
    );
    expect(screen.queryByRole("button", { name: es.lists.reorder })).toBeNull();
  });
});

describe("textos de Listas v2", () => {
  it("el marcador de F0 ya no está en los mensajes", () => {
    expect((es as Record<string, unknown>).uiV2).toBeUndefined();
    expect((en as Record<string, unknown>).uiV2).toBeUndefined();
  });
});
