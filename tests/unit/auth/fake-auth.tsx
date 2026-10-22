/**
 * Supabase Auth simulado en memoria para los tests de acceso: guarda cuentas
 * y contraseñas, y una sesión, de forma que se pueda recorrer un flujo entero
 * (recuperar → contraseña nueva → entrar con ella) sin red.
 *
 * También trae los dobles de next-intl y de la navegación que usan las
 * pantallas de auth.
 */
import { vi } from "vitest";
import type { ReactNode } from "react";

interface Account {
  id: string;
  email: string;
  password: string;
  confirmed: boolean;
  app_metadata: Record<string, unknown>;
}

type Listener = (event: string, session: unknown) => void;

function makeSession(a: Account) {
  return {
    access_token: `tok-${a.id}`,
    user: { id: a.id, email: a.email, app_metadata: a.app_metadata },
  };
}

export function createFakeAuth() {
  const accounts = new Map<string, Account>();
  let session: ReturnType<typeof makeSession> | null = null;
  const listeners = new Set<Listener>();
  let confirmEmail = false;

  const emit = (event: string) => listeners.forEach((l) => l(event, session));

  const auth = {
    getSession: vi.fn(async () => ({ data: { session } })),
    onAuthStateChange: vi.fn((cb: Listener) => {
      listeners.add(cb);
      return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
    }),
    signInWithPassword: vi.fn(async ({ email, password }: { email: string; password: string }) => {
      const a = accounts.get(email);
      if (!a || a.password !== password) {
        return { data: {}, error: { message: "Invalid login credentials", code: "invalid_credentials" } };
      }
      if (!a.confirmed) {
        return { data: {}, error: { message: "Email not confirmed", code: "email_not_confirmed" } };
      }
      session = makeSession(a);
      emit("SIGNED_IN");
      return { data: { session }, error: null };
    }),
    signUp: vi.fn(async ({ email, password }: { email: string; password: string; options?: unknown }) => {
      if (accounts.has(email)) {
        return { data: null, error: { message: "User already registered", code: "user_already_exists" } };
      }
      const a: Account = { id: `u${accounts.size + 1}`, email, password, confirmed: !confirmEmail, app_metadata: {} };
      accounts.set(email, a);
      if (confirmEmail) return { data: { user: { id: a.id }, session: null }, error: null };
      session = makeSession(a);
      return { data: { user: { id: a.id }, session }, error: null };
    }),
    signOut: vi.fn(async (_opts?: unknown) => {
      if (!_opts) session = null;
      return { error: null };
    }),
    signInWithOAuth: vi.fn(async (_args: unknown) => ({ data: {}, error: null })),
    resetPasswordForEmail: vi.fn(async (_email: string, _opts?: unknown) => ({ data: {}, error: null })),
    resend: vi.fn(async (_args: unknown) => ({ data: {}, error: null })),
    updateUser: vi.fn(async (attrs: { password?: string; email?: string }, _opts?: unknown) => {
      if (!session) return { data: {}, error: { message: "Auth session missing!", code: "session_not_found" } };
      const a = Array.from(accounts.values()).find((x) => x.id === session!.user.id)!;
      if (attrs.password) {
        if (attrs.password === a.password) {
          return { data: {}, error: { message: "New password should be different from the old password.", code: "same_password" } };
        }
        a.password = attrs.password;
      }
      return { data: { user: session.user }, error: null };
    }),
  };

  return {
    client: { auth },
    auth,
    addAccount(email: string, password: string, extra: Partial<Account> = {}) {
      accounts.set(email, {
        id: `u${accounts.size + 1}`,
        email,
        password,
        confirmed: true,
        app_metadata: {},
        ...extra,
      });
    },
    /** Simula el canje del enlace del correo: deja la sesión abierta. */
    openSessionFor(email: string, event = "PASSWORD_RECOVERY") {
      session = makeSession(accounts.get(email)!);
      emit(event);
    },
    clearSession() {
      session = null;
    },
    get session() {
      return session;
    },
    requireEmailConfirmation(on: boolean) {
      confirmEmail = on;
    },
  };
}

/** `useTranslations` falso: devuelve la clave (y los valores, si los hay). */
export function fakeT(key: string, values?: Record<string, unknown>): string {
  if (values && "seconds" in values) return `${key}:${values.seconds}`;
  if (values && "email" in values && typeof values.email === "string") return `${key}:${values.email}`;
  return key;
}
fakeT.rich = (key: string, values?: Record<string, unknown>): ReactNode => (
  <>
    <span>{fakeT(key, values)}</span>
    {Object.entries(values ?? {})
      .filter(([, v]) => typeof v === "function")
      .map(([name, fn]) => (
        <span key={name} data-rich={name}>
          {(fn as (c: ReactNode) => ReactNode)(name)}
        </span>
      ))}
  </>
);

/** `Link` de next-intl como `<a>` normal. */
export function FakeLink({ href, children, ...rest }: { href: string; children: ReactNode } & Record<string, unknown>) {
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}
