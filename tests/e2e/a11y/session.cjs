/**
 * Sesión simulada de Supabase para las pantallas con sesión (ACC-18).
 *
 * `@supabase/ssr` lee la sesión de la cookie `sb-<host>-auth-token` con el
 * formato `base64-<JSON en base64url>`; el servidor la valida llamando a
 * `/auth/v1/user`, que `mock-supabase.cjs` acepta solo con este token.
 */
const { USER_ID, user } = require("./fixtures.cjs");

const b64url = (value) => Buffer.from(value).toString("base64url");

// JWT con forma válida (cabecera.carga.firma). La firma no se comprueba: el
// único que lo valida es el Supabase simulado, comparando el texto.
const EXP = 4102444800; // 2100-01-01
const ACCESS_TOKEN = [
  b64url(JSON.stringify({ alg: "HS256", typ: "JWT" })),
  b64url(
    JSON.stringify({
      sub: USER_ID,
      aud: "authenticated",
      role: "authenticated",
      email: user.email,
      exp: EXP,
      iat: 1767225600,
      session_id: "a11y-session",
    })
  ),
  b64url("a11y-signature"),
].join(".");

function session() {
  return {
    access_token: ACCESS_TOKEN,
    token_type: "bearer",
    expires_in: EXP - Math.floor(Date.now() / 1000),
    expires_at: EXP,
    refresh_token: "a11y-refresh-token",
    user: {
      id: USER_ID,
      aud: "authenticated",
      role: "authenticated",
      email: user.email,
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: { username: user.username },
      created_at: user.created_at,
    },
  };
}

/** Cookie lista para `context.addCookies()` contra `host` (p. ej. "localhost"). */
function sessionCookie(supabaseUrl, appHost) {
  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  return {
    name: `sb-${ref}-auth-token`,
    value: `base64-${b64url(JSON.stringify(session()))}`,
    domain: appHost,
    path: "/",
    httpOnly: false,
    secure: false,
    sameSite: "Lax",
  };
}

module.exports = { ACCESS_TOKEN, session, sessionCookie };
