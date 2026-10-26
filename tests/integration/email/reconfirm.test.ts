/**
 * F-28 · Doble opt-in contra el proyecto Supabase de TEST (con
 * 20261215280001_calendar_email.sql aplicada). Se salta sin SUPABASE_TEST_*.
 * Sin base remota, los mismos casos van en local-pg-cases.sql (Postgres local).
 *
 * Regresión (revisión #49): el enlace de reconfirmación que manda el envío
 * semanal cuando cambia la dirección se firmaba con la hora de inicio del
 * cron (anterior a la baja de email_reconfirm_required) y la base lo daba
 * siempre por `superseded`. Aquí se recorre el camino real: alta confirmada,
 * reconfirmación, enlace nuevo por `defaultDigestDeps(...).requestOptin` con
 * la hora del cron de hace una hora, y confirmación con ese enlace → 'ok'.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { adminClient, configured, createUser, deleteCreatedUsers, type TestUser } from "../rls/helpers";

const sent = vi.hoisted(() => [] as Array<{ to: string | string[]; text: string }>);
vi.mock("@/lib/email/resend", async (orig) => ({
  ...(await orig<typeof import("@/lib/email/resend")>()),
  sendEmail: vi.fn(async (m: { to: string | string[]; text: string }) => {
    sent.push(m);
    return { ok: true, id: "re_test" };
  }),
}));

import { defaultDigestDeps } from "@/lib/email/digest";
import { confirmWeeklyOptin, requireWeeklyReconfirm } from "@/lib/email/preferences";
import { OPTIN_TOKEN_TTL_SECONDS, emailFingerprint, verifyOptinToken } from "@/lib/email/unsubscribe-token";
import { WEEKLY_EMAIL_CONSENT_VERSION } from "@/lib/email/consent";

const SECRET = "f28-integration-".padEnd(40, "x");
const ENV = {
  WEEKLY_EMAIL: "1",
  RESEND_API_KEY: "re_test",
  EMAIL_FROM: "KULTURA <onboarding@resend.dev>",
  EMAIL_TOKEN_SECRET: SECRET,
};

describe.skipIf(!configured)("F-28 doble opt-in (proyecto de test)", () => {
  let user: TestUser;

  beforeAll(async () => {
    Object.assign(process.env, ENV);
    user = await createUser("f28-optin");
  });
  afterEach(() => {
    sent.length = 0;
  });
  afterAll(async () => {
    for (const k of Object.keys(ENV)) delete process.env[k];
    await deleteCreatedUsers();
  });

  it("el enlace que manda el envío semanal tras un cambio de dirección confirma (no sale superseded)", async () => {
    const admin = adminClient();
    const now = () => new Date(Math.floor(Date.now() / 1000) * 1000);
    expect(await confirmWeeklyOptin(admin, user.id, WEEKLY_EMAIL_CONSENT_VERSION, emailFingerprint("vieja@example.com"), now())).toEqual({
      ok: true,
      status: "ok",
    });

    // El cron empezó hace una hora; durante el envío ve otra dirección.
    const deps = defaultDigestDeps(admin, new Date(Date.now() - 3600_000));
    expect(await requireWeeklyReconfirm(admin, user.id)).toBe(true);
    expect(await deps.requestOptin!({ userId: user.id, email: user.email, username: "f28", locale: "es" })).toBe("sent");

    const link = /https:\/\/\S+\/es\/email\/confirm\?t=\S+/.exec(sent[0].text)?.[0];
    const check = verifyOptinToken(new URL(link!).searchParams.get("t"), SECRET);
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    const issuedAt = new Date(check.expiresAt.getTime() - OPTIN_TOKEN_TTL_SECONDS * 1000);
    expect(await confirmWeeklyOptin(admin, user.id, check.textVersion, check.emailHash, issuedAt)).toEqual({ ok: true, status: "ok" });

    const { data } = await admin.from("email_preferences").select("weekly_digest, confirmed_email_hash").eq("user_id", user.id).single();
    expect(data).toEqual({ weekly_digest: true, confirmed_email_hash: emailFingerprint(user.email) });
  });
});
