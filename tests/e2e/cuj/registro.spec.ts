// CUJ 1 · Registro (F3-1): alta por correo en /es/login?mode=register contra
// Supabase local (confirmación desactivada, como D-08) → onboarding, y el
// disparador `handle_new_user` crea el perfil y guarda la aceptación (SEG-7).
import { test, expect } from "./fixtures";
import { admin, passwordField, PASSWORD, uniq } from "./_db";

/** Usuario de auth por correo, sin depender de la paginación de listUsers. */
async function authUserByEmail(email: string): Promise<{ id: string } | null> {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const hit = data.users.find((u) => u.email === email);
    if (hit) return { id: hit.id };
    if (data.users.length < 200) return null;
  }
  return null;
}

test("registro: alta nueva llega al onboarding y crea su perfil en la BD", async ({ page }) => {
  const email = `alta${uniq()}@cuj.test`;

  await page.goto("/es/login?mode=register");
  await page.getByLabel("Correo electrónico").fill(email);
  await passwordField(page).fill(PASSWORD);
  await page.locator("#terms").check();
  await page.locator("form button[type=submit]").click();

  await page.waitForURL(/\/es\/welcome/, { timeout: 20_000 });

  const created = await authUserByEmail(email);
  expect(created, "usuario en auth.users").toBeTruthy();
  const { data: profile } = await admin.from("users").select("username").eq("id", created!.id).single();
  expect(profile?.username).toBeTruthy();
  const { data: state } = await admin.from("account_state").select("terms_accepted_at").eq("user_id", created!.id).single();
  expect(state?.terms_accepted_at).toBeTruthy();
});

test("registro: sin aceptar los términos no se crea la cuenta", async ({ page }) => {
  const email = `noterms${uniq()}@cuj.test`;

  await page.goto("/es/login?mode=register");
  await page.getByLabel("Correo electrónico").fill(email);
  await passwordField(page).fill(PASSWORD);
  await page.locator("form button[type=submit]").click();

  await expect(page.locator("#terms")).toHaveAttribute("aria-invalid", "true");
  await expect(page).toHaveURL(/mode=register/);
  expect(await authUserByEmail(email)).toBeNull();
});
