/**
 * F-33 (remate) · El aviso «¿Te avisamos?» del chat no tapa el campo de
 * escribir ni el botón de enviar (a 390 y a 1440 px): va en el flujo, encima
 * del campo. Y se cierra con Esc sin descartarse para siempre.
 *
 * El navegador de pruebas no tiene push real: se simula lo justo (permiso en
 * «default», service worker con `pushManager`, `/api/push/status` encendido)
 * y el envío del mensaje responde bien.
 */
import { test, expect } from "@playwright/test";
import { isolateNetwork, open, signIn } from "./helpers";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { CONVERSATION_ID } = require("./fixtures.cjs");

const KEY = "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4";

test.beforeEach(async ({ context, baseURL }) => {
  await isolateNetwork(context);
  await signIn(context, baseURL!);
  await context.addInitScript(() => {
    const registration = { active: {}, pushManager: { getSubscription: async () => null, subscribe: async () => null } };
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { getRegistration: async () => registration, ready: Promise.resolve(registration), register: async () => registration, addEventListener() {} },
    });
    const w = window as unknown as Record<string, unknown>;
    if (!("PushManager" in w)) w.PushManager = function PushManager() {};
    w.Notification = { permission: "default", requestPermission: async () => "default" };
  });
  await context.route("**/api/push/status", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ enabled: true, publicKey: KEY, devices: 0, endpointHashes: [] }) })
  );
  await context.route(`**/api/chat/${CONVERSATION_ID}`, (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ message: { id: "00000000-0000-4000-8000-0000000000f1", content: "hola", sender_id: "me", created_at: new Date().toISOString() } }),
    });
  });
});

function overlaps(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

test("chat: el aviso de push no tapa el campo de escribir ni el botón de enviar", async ({ page }) => {
  await open(page, `/es/chat/${CONVERSATION_ID}`);
  const input = page.locator("form input[type=text]");
  await input.fill("hola");
  await page.locator('form button[type="submit"]').click();

  const card = page.getByTestId("push-offer");
  await expect(card).toBeVisible();
  const cardBox = (await card.boundingBox())!;
  const inputBox = (await input.boundingBox())!;
  const sendBox = (await page.locator('form button[type="submit"]').boundingBox())!;
  expect(overlaps(cardBox, inputBox), `aviso ${JSON.stringify(cardBox)} / campo ${JSON.stringify(inputBox)}`).toBe(false);
  expect(overlaps(cardBox, sendBox), `aviso ${JSON.stringify(cardBox)} / enviar ${JSON.stringify(sendBox)}`).toBe(false);
  // Encima del campo y el campo sigue a la vista.
  expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(inputBox.y);
  const viewport = page.viewportSize()!;
  expect(inputBox.y + inputBox.height).toBeLessThanOrEqual(viewport.height);

  // Esc la cierra (solo esta vez).
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem("kultura.pushOffer.dismissed"))).toBeNull();
});
