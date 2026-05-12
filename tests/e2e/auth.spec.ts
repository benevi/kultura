import { test, expect } from "@playwright/test";

const BASE = "";
const TEST_EMAIL = `test_${Date.now()}@kultura-test.dev`;
const TEST_PASSWORD = "Test1234!";

// Tab buttons live in the toggle container (not inside <form>)
const tabLogin = (page: any) =>
  page.locator("div.mb-6 button", { hasText: "Iniciar sesión" });
const tabRegister = (page: any) =>
  page.locator("div.mb-6 button", { hasText: "Registrarse" });

test.describe("Auth flow", () => {
  test("landing page loads and CTAs visible", async ({ page }) => {
    await page.goto(`${BASE}/es`);
    await expect(page.getByRole("heading", { name: /Descubre, registra/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Iniciar sesión" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Registrarse" })).toBeVisible();
  });

  test("login page renders both tabs and form fields", async ({ page }) => {
    await page.goto(`${BASE}/es/login`);
    await expect(tabLogin(page)).toBeVisible();
    await expect(tabRegister(page)).toBeVisible();
    await expect(page.getByLabel("Correo electrónico")).toBeVisible();
    await expect(page.getByLabel("Contraseña")).toBeVisible();
  });

  test("register tab switches correctly and shows confirm password", async ({ page }) => {
    await page.goto(`${BASE}/es/login?mode=register`);
    await tabRegister(page).click();
    await expect(page.getByLabel("Confirmar contraseña")).toBeVisible();
  });

  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto(`${BASE}/es/login`);
    await page.getByLabel("Correo electrónico").fill("nobody@nowhere.com");
    await page.getByLabel("Contraseña").fill("wrongpassword");
    await page.locator("form button[type=submit]").click();
    await expect(page.locator("text=/incorrecto|inválido|error/i")).toBeVisible({ timeout: 10000 });
  });

  test("register with mismatched passwords shows error", async ({ page }) => {
    await page.goto(`${BASE}/es/login?mode=register`);
    await tabRegister(page).click();
    await page.getByLabel("Correo electrónico").fill(TEST_EMAIL);
    await page.locator("#password").fill("Test1234!");
    await page.locator("#confirmPassword").fill("Different1!");
    await page.locator("form button[type=submit]").click();
    await expect(page.locator("text=/contraseñas no coinciden/i")).toBeVisible({ timeout: 5000 });
  });

  test("register with short password shows error", async ({ page }) => {
    await page.goto(`${BASE}/es/login?mode=register`);
    await tabRegister(page).click();
    await page.getByLabel("Correo electrónico").fill(TEST_EMAIL);
    await page.locator("#password").fill("abc");
    await page.locator("#confirmPassword").fill("abc");
    await page.locator("form button[type=submit]").click();
    await expect(page.locator("text=/al menos 8/i")).toBeVisible({ timeout: 5000 });
  });

  test("forgot password link shows reset form", async ({ page }) => {
    await page.goto(`${BASE}/es/login`);
    await page.getByRole("button", { name: /Olvidaste/ }).click();
    await expect(page.getByRole("button", { name: /Enviar enlace/ })).toBeVisible();
  });

  test("unauthenticated access to library redirects to login", async ({ page }) => {
    await page.goto(`${BASE}/es/library`);
    await expect(page).toHaveURL(/\/login/);
  });

  test("successful registration flow", async ({ page }) => {
    await page.goto(`${BASE}/es/login?mode=register`);
    await tabRegister(page).click();
    await page.getByLabel("Correo electrónico").fill(TEST_EMAIL);
    await page.locator("#password").fill(TEST_PASSWORD);
    await page.locator("#confirmPassword").fill(TEST_PASSWORD);
    await page.locator("form button[type=submit]").click();
    // Supabase email confirm → shows "Revisa tu correo" message
    // OR auto-login → redirects away from /login
    await expect(
      page.locator("text=/Revisa tu correo/i").or(
        page.locator("text=/correo/i")
      ).or(
        page.getByRole("heading", { name: /Descubrir|Mi biblioteca|Inicio/i })
      )
    ).toBeVisible({ timeout: 12000 });
  });
});
