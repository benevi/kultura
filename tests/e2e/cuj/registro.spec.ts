// CUJ 1 · Registro (F3-1): alta por correo en /es/login?mode=register contra
// Supabase local (confirmación desactivada, como D-08) → onboarding, y el
// disparador `handle_new_user` crea la fila de `public.users`.
import { test, expect } from "@playwright/test";
import { admin, passwordField, PASSWORD, uniq, waitForPublicUser } from "./_db";

test("registro: alta nueva llega al onboarding y crea su perfil en la BD", async ({ page }) => {
  const email = `alta${uniq()}@cuj.test`;

  await page.goto("/es/login?mode=register");
  await page.getByLabel("Correo electrónico").fill(email);
  await passwordField(page).fill(PASSWORD);
  await page.locator("#terms").check();
  await page.locator("form button[type=submit]").click();

  await page.waitForURL(/\/es\/welcome/, { timeout: 20_000 });

  // La cuenta existe en auth y su perfil en public.users (disparador).
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  expect(error).toBeNull();
  const created = data.users.find((u) => u.email === email);
  expect(created, "usuario en auth.users").toBeTruthy();
  const row = await waitForPublicUser(created!.id);
  expect(row.username.length).toBeGreaterThan(0);
});

test("registro: sin aceptar los términos no se crea la cuenta", async ({ page }) => {
  const email = `noterms${uniq()}@cuj.test`;

  await page.goto("/es/login?mode=register");
  await page.getByLabel("Correo electrónico").fill(email);
  await passwordField(page).fill(PASSWORD);
  await page.locator("form button[type=submit]").click();

  await expect(page.locator("#terms")).toHaveAttribute("aria-invalid", "true");
  await expect(page).toHaveURL(/mode=register/);
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  expect(data.users.some((u) => u.email === email)).toBe(false);
});
