// CUJ 2 · Entrar (F3-1): login por el formulario real contra Supabase local;
// la sesión abre la app y sobrevive a una recarga; una contraseña mala no.
import { test, expect } from "./fixtures";
import { createUser, login, passwordField } from "./_db";

test("entrar: con su contraseña abre la app y la sesión persiste", async ({ page }) => {
  const user = await createUser("entra");
  await login(page, user);

  await page.goto("/es/library");
  await expect(page).toHaveURL(/\/es\/library/);
  await page.reload();
  await expect(page).toHaveURL(/\/es\/library/);
});

test("entrar: contraseña incorrecta muestra el error y no entra", async ({ page }) => {
  const user = await createUser("malapass");
  await page.goto("/es/login");
  await page.getByLabel("Correo electrónico").fill(user.email);
  await passwordField(page).fill("no-es-la-buena-123");
  await page.locator("form button[type=submit]").click();

  // En el formulario: Next también pinta un role=alert (anunciador de rutas).
  await expect(page.locator("form [role=alert]")).toHaveText(/Correo o contraseña incorrectos/);
  await expect(page).toHaveURL(/\/es\/login/);
});

test("entrar: sin sesión, la app manda al login", async ({ page }) => {
  await page.goto("/es/library");
  await expect(page).toHaveURL(/\/es\/login/);
});
