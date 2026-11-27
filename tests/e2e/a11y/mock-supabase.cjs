/**
 * Supabase simulado para la red de seguridad de accesibilidad (ACC-18).
 *
 * Servidor HTTP en localhost que responde lo justo de Auth (`/auth/v1/user`,
 * `/auth/v1/token`) y de PostgREST (`/rest/v1/<tabla>`, `/rest/v1/rpc/<fn>`)
 * con los datos de `fixtures.cjs`. Entiende filtros `eq`/`in`/`is`, `limit`,
 * `order` (solo lo ignora), recursos embebidos (`users(...)`,
 * `alias:tabla!fk(...)`), `.single()`/`.maybeSingle()` y `count`. Las
 * escrituras responden 201/204 sin cambiar nada: las pruebas son de lectura.
 *
 * Uso: `node tests/e2e/a11y/mock-supabase.cjs` (puerto MOCK_SUPABASE_PORT,
 * 54329 por defecto). Lo arranca `playwright.a11y.config.ts`.
 */
const http = require("node:http");
const { tables, user, USER_ID } = require("./fixtures.cjs");
const { ACCESS_TOKEN, session } = require("./session.cjs");

const PORT = Number(process.env.MOCK_SUPABASE_PORT || 54329);

// ── PostgREST mínimo ────────────────────────────────────────────────────────

/** Divide por comas de primer nivel (fuera de paréntesis). */
function splitTop(str) {
  const out = [];
  let depth = 0;
  let cur = "";
  for (const ch of str) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

/** `alias:tabla!pista(sub)` → { alias, table, hint, sub } | null si es columna. */
function parseEmbed(item) {
  const m = item.match(/^(?:([\w]+):)?([\w]+)(?:!([\w]+))?(?:!inner)?\((.*)\)$/s);
  if (!m) return null;
  const [, alias, table, hint, sub] = m;
  return { alias: alias || table, table, hint: hint && hint !== "inner" ? hint : null, sub };
}

const singular = (t) => (t.endsWith("s") ? t.slice(0, -1) : t);

function embed(row, parentTable, spec) {
  // `alias:columna_id(...)` (PostgREST embebe por la clave ajena): la tabla sale
  // de la columna (`user_id` → `users`, `media_id` → `media`).
  if (!tables[spec.table] && spec.table.endsWith("_id")) {
    const base = spec.table.slice(0, -3);
    spec = { ...spec, hint: spec.table, table: tables[`${base}s`] ? `${base}s` : base };
  }
  const related = tables[spec.table] ?? [];
  const cols = Object.keys(row);
  // Muchos a uno: una columna del padre apunta al id del embebido.
  let fkCol =
    (spec.hint && (cols.find((c) => spec.hint === c) || cols.find((c) => spec.hint.includes(c)))) ||
    cols.find((c) => c === `${singular(spec.table)}_id`);
  if (fkCol && row[fkCol] !== undefined && fkCol.endsWith("_id")) {
    const target = related.find((r) => r.id === row[fkCol]);
    return target ? project(target, spec.table, spec.sub) : null;
  }
  // Uno a muchos: filas del embebido que apuntan al padre. Con la pista de la
  // clave (`lists!lists_owner_id_fkey`), la columna sale de ella (`owner_id`);
  // sin pista, `<padre en singular>_id`.
  const prefix = `${spec.table}_`;
  const fromHint = spec.hint && spec.hint.startsWith(prefix) && spec.hint.endsWith("_fkey") ? spec.hint.slice(prefix.length, -5) : null;
  const backCol = fromHint || `${singular(parentTable)}_id`;
  if (row.id !== undefined && related.some((r) => backCol in r)) {
    const filters = embedFilters.get(spec.alias) ?? [];
    return related
      .filter((r) => r[backCol] === row.id && filters.every(([col, raw]) => matches(r, col, raw)))
      .map((r) => project(r, spec.table, spec.sub));
  }
  return null;
}

/**
 * Filtros sobre un embebido de primer nivel (`lists.is_public=eq.true`): se
 * aplican a sus filas, como PostgREST. Los pone `rest()` en cada petición.
 */
let embedFilters = new Map();

function project(row, table, select) {
  if (!select || select === "*") return { ...row };
  const out = {};
  for (const item of splitTop(select)) {
    const spec = parseEmbed(item);
    if (spec) {
      out[spec.alias] = embed(row, table, spec);
      continue;
    }
    if (item === "*") {
      Object.assign(out, row);
      continue;
    }
    const [aliasOrCol, col] = item.split(":");
    const name = (col ?? aliasOrCol).split("::")[0];
    out[col ? aliasOrCol : name] = row[name] ?? null;
  }
  return out;
}

function matches(row, key, raw) {
  if (key.includes(".")) return true; // filtro sobre un embebido: se ignora
  const value = row[key];
  const [op, ...rest] = raw.split(".");
  const arg = rest.join(".");
  switch (op) {
    case "eq":
      return String(value) === arg;
    case "neq":
      return String(value) !== arg;
    case "in":
      return arg.replace(/^\(|\)$/g, "").split(",").map((s) => s.replace(/^"|"$/g, "")).includes(String(value));
    case "is":
      return arg === "null" ? value == null : String(value) === arg;
    case "not":
      return true;
    case "ilike":
    case "like": {
      const re = new RegExp("^" + arg.replace(/[%*]/g, ".*") + "$", "i");
      return re.test(String(value ?? ""));
    }
    default:
      return true;
  }
}

const RESERVED = new Set(["select", "order", "limit", "offset", "or", "and", "on_conflict", "columns"]);

/**
 * `or=(…)` y `and(…)` de PostgREST, con condiciones `col.op.valor` dentro
 * (`.or('and(requester_id.eq.A,receiver_id.eq.B),and(…)')` de las amistades).
 * Sin esto el filtro se ignoraba y cualquiera salía como amigo del usuario de
 * prueba (fase 8.5 P2). Una condición sobre un embebido sigue sin filtrar.
 */
function logic(row, expr) {
  const m = expr.match(/^(and|or)\((.*)\)$/s);
  if (!m) {
    const dot = expr.indexOf(".");
    return dot < 0 ? true : matches(row, expr.slice(0, dot), expr.slice(dot + 1));
  }
  const parts = splitTop(m[2]);
  return m[1] === "and" ? parts.every((p) => logic(row, p)) : parts.some((p) => logic(row, p));
}

function rest(req, res, url) {
  const [, , , name, fn] = url.pathname.split("/"); // /rest/v1/<tabla> | /rest/v1/rpc/<fn>
  const prefer = req.headers.prefer || "";
  const wantsObject = (req.headers.accept || "").includes("vnd.pgrst.object");

  if (name === "rpc") {
    const rpc = {
      can_read_library: true,
      can_send_message: true,
      deletion_preview: { groups: [{ name: "Club de cine", successor: null }], lists: [] },
    };
    return send(res, 200, fn in rpc ? rpc[fn] : null);
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    // Escrituras: éxito sin efecto. Con `return=representation`, filas vacías.
    if (prefer.includes("return=representation")) return send(res, 201, wantsObject ? {} : []);
    return send(res, req.method === "POST" ? 201 : 204, null);
  }

  let rows = (tables[name] ?? []).slice();
  embedFilters = new Map();
  for (const [key, raw] of url.searchParams) {
    if (RESERVED.has(key)) continue;
    const dot = key.indexOf(".");
    if (dot > 0 && !key.slice(dot + 1).includes(".")) {
      const alias = key.slice(0, dot);
      embedFilters.set(alias, [...(embedFilters.get(alias) ?? []), [key.slice(dot + 1), raw]]);
    }
    rows = rows.filter((r) => matches(r, key, raw));
  }
  for (const key of ["or", "and"]) {
    const raw = url.searchParams.get(key);
    if (raw) rows = rows.filter((r) => logic(r, `${key}${raw}`));
  }
  const total = rows.length;
  const limit = Number(url.searchParams.get("limit") || 0);
  const offset = Number(url.searchParams.get("offset") || 0);
  if (offset) rows = rows.slice(offset);
  if (limit) rows = rows.slice(0, limit);
  const select = url.searchParams.get("select") || "*";
  const body = rows.map((r) => project(r, name, select));

  const headers = {};
  if (prefer.includes("count=")) {
    headers["content-range"] = total ? `${offset}-${offset + body.length - 1}/${total}` : `*/0`;
  }
  if (req.method === "HEAD") return send(res, 200, null, headers);
  if (wantsObject) {
    if (body.length !== 1) {
      return send(res, 406, {
        code: "PGRST116",
        details: `The result contains ${body.length} rows`,
        hint: null,
        message: "JSON object requested, multiple (or no) rows returned",
      });
    }
    return send(res, 200, body[0], headers);
  }
  return send(res, 200, body, headers);
}

// ── Auth mínima ─────────────────────────────────────────────────────────────

const authUser = {
  id: USER_ID,
  aud: "authenticated",
  role: "authenticated",
  email: user.email,
  email_confirmed_at: user.created_at,
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { username: user.username },
  identities: [],
  created_at: user.created_at,
  updated_at: user.created_at,
};

function auth(req, res, url) {
  const bearer = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (url.pathname === "/auth/v1/user") {
    if (bearer !== ACCESS_TOKEN) {
      return send(res, 401, { code: 401, error_code: "bad_jwt", msg: "invalid JWT" });
    }
    return send(res, 200, authUser);
  }
  if (url.pathname === "/auth/v1/token") return send(res, 200, { ...session(), user: authUser });
  if (url.pathname === "/auth/v1/logout") return send(res, 204, null);
  return send(res, 404, { msg: "not found" });
}

// ── Servidor ────────────────────────────────────────────────────────────────

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,HEAD,OPTIONS",
    "access-control-expose-headers": "content-range",
    ...headers,
  });
  res.end(body === null || status === 204 ? undefined : JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === "OPTIONS") return send(res, 204, null);
  if (url.pathname === "/health") return send(res, 200, { ok: true });
  // El cuerpo de las escrituras no se usa, pero hay que consumirlo.
  req.resume();
  req.on("end", () => {
    try {
      if (url.pathname.startsWith("/auth/v1/")) return auth(req, res, url);
      if (url.pathname.startsWith("/rest/v1/")) return rest(req, res, url);
      return send(res, 404, { msg: "not found" });
    } catch (err) {
      send(res, 500, { message: String(err) });
    }
  });
});
// Realtime (websocket) no se simula: se corta y el cliente reintenta.
server.on("upgrade", (_req, socket) => socket.destroy());
server.listen(PORT, () => {
  console.log(`mock-supabase en http://localhost:${PORT}`);
});
