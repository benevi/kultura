// Crea (si faltan) los dos usuarios fijos que usan los tests de integración
// antiguos (tests/integration/db/*). Solo contra el proyecto de TEST.
// Uso: node tests/integration/seed-test-users.mjs   (lee SUPABASE_TEST_URL y
// SUPABASE_TEST_SERVICE_ROLE_KEY del entorno)
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_TEST_URL;
const key = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan SUPABASE_TEST_URL / SUPABASE_TEST_SERVICE_ROLE_KEY");
  process.exit(1);
}

const USERS = [
  { email: "test-user-a@kultura.test", password: "TestPassword123!" },
  { email: "test-user-b@kultura.test", password: "TestPassword456!" },
];

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

for (const u of USERS) {
  const { error } = await admin.auth.admin.createUser({ ...u, email_confirm: true });
  if (!error) {
    console.log(`creado ${u.email}`);
  } else if (/already|registered|exists/i.test(error.message)) {
    console.log(`ya existe ${u.email}`);
  } else {
    console.error(`no se pudo crear ${u.email}: ${error.message}`);
    process.exit(1);
  }
}
