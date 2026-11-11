// Red de seguridad 4 · Amistad: A busca a B y le pide amistad, B la acepta y
// después A bloquea a B desde su perfil. Dos sesiones reales a la vez.
import { test, expect } from "./fixtures";
import { admin, createUser, eventually } from "./_db";
import { pageFor } from "./_social";

test("amistad: pedir, aceptar y bloquear", async ({ browser }) => {
  const a = await createUser("amiga");
  const b = await createUser("amigb");
  const pageA = await pageFor(browser, a);
  const pageB = await pageFor(browser, b);

  // A busca a B por su nombre y le pide amistad.
  await pageA.goto("/es/friends");
  await pageA.getByPlaceholder("Introduce un nombre de usuario…").fill(b.username);
  await pageA.getByRole("button", { name: "Buscar" }).click();
  await expect(pageA.getByRole("link", { name: b.username })).toBeVisible();
  await pageA.getByRole("button", { name: "Añadir amigo" }).click();
  await expect(pageA.getByRole("button", { name: "Solicitud enviada" })).toBeDisabled();

  // B la ve en «Solicitudes pendientes» y la acepta.
  await pageB.goto("/es/friends");
  await expect(pageB.getByRole("heading", { name: /Solicitudes pendientes/ })).toBeVisible();
  await pageB.getByRole("button", { name: "Aceptar" }).click();
  await expect(pageB.getByRole("button", { name: "Eliminar amigo" })).toBeVisible();
  await eventually(
    async () =>
      (await admin.from("friendships").select("status").eq("requester_id", a.id).eq("receiver_id", b.id).maybeSingle()).data,
    (row) => row?.status === "accepted",
    "amistad aceptada",
  );

  // A bloquea a B desde su perfil: la amistad desaparece y queda el bloqueo.
  await pageA.goto(`/es/profile/${b.username}`);
  await pageA.getByRole("button", { name: "Bloquear" }).click();
  await pageA
    .getByRole("group", { name: "¿Bloquear a este usuario?" })
    .getByRole("button", { name: "Bloquear" })
    .click();
  await expect(pageA.getByText("Has bloqueado a este usuario.").first()).toBeVisible();
  await expect(pageA.getByRole("button", { name: "Desbloquear" })).toBeVisible();

  await eventually(
    async () => (await admin.from("blocks").select("blocker_id").eq("blocker_id", a.id).eq("blocked_id", b.id)).data,
    (rows) => (rows?.length ?? 0) === 1,
    "bloqueo guardado",
  );
  const { data: friendship } = await admin
    .from("friendships")
    .select("id")
    .or(`and(requester_id.eq.${a.id},receiver_id.eq.${b.id}),and(requester_id.eq.${b.id},receiver_id.eq.${a.id})`);
  expect(friendship ?? []).toHaveLength(0);

  // En «Amigos» de A aparece en «Usuarios bloqueados».
  await pageA.goto("/es/friends");
  await expect(pageA.getByRole("heading", { name: "Usuarios bloqueados" })).toBeVisible();
  await expect(pageA.getByRole("button", { name: `Desbloquear a ${b.username}` })).toBeVisible();

  await pageA.context().close();
  await pageB.context().close();
});
