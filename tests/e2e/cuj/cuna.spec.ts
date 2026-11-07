// CUJ · Prueba de humo de F1 (D2): de la mini-landing de una cuña al alta.
// Llega con UTM de comunidad → el CTA lleva la cuña y las UTM al registro →
// alta por correo contra Supabase local → `signup_completed` guarda la cuña y
// la UTM en `props` (lo que lee la consulta de docs/F1_PRUEBA_DE_HUMO.md).
import { test, expect } from "./fixtures";
import { admin, passwordField, PASSWORD, uniq } from "./_db";

for (const wedge of ["series", "anime"] as const) {
  test(`cuña ${wedge}: el CTA lleva cuña y UTM hasta signup_completed`, async ({ page }) => {
    const email = `cuna${wedge}${uniq()}@cuj.test`;

    await page.goto(`/es/${wedge}?utm_source=cujtest&utm_medium=community&utm_campaign=f1_${wedge}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const cta = page.getByRole("link", { name: "Crear cuenta" });
    // La isla del CTA añade las UTM al montar.
    await expect(cta).toHaveAttribute("href", /utm_source=cujtest/);
    await cta.click();

    await page.waitForURL(/\/es\/login\?/);
    const url = new URL(page.url());
    expect(url.searchParams.get("mode")).toBe("register");
    expect(url.searchParams.get("wedge")).toBe(wedge);
    expect(url.searchParams.get("utm_campaign")).toBe(`f1_${wedge}`);

    await page.getByLabel("Correo electrónico").fill(email);
    await passwordField(page).fill(PASSWORD);
    await page.locator("#terms").check();
    await page.locator("form button[type=submit]").click();
    await page.waitForURL(/\/es\/welcome/, { timeout: 20_000 });

    let userId: string | undefined;
    for (let p = 1; p <= 50 && !userId; p++) {
      const { data, error } = await admin.auth.admin.listUsers({ page: p, perPage: 200 });
      if (error) throw new Error(error.message);
      userId = data.users.find((u) => u.email === email)?.id;
      if (data.users.length < 200) break;
    }
    expect(userId, "usuario creado").toBeTruthy();

    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("analytics_events")
            .select("props")
            .eq("user_id", userId!)
            .eq("name", "signup_completed")
            .maybeSingle();
          return data?.props ?? null;
        },
        { timeout: 10_000 },
      )
      .toMatchObject({ wedge, utm_source: "cujtest", utm_campaign: `f1_${wedge}`, channel: "utm" });
  });
}
