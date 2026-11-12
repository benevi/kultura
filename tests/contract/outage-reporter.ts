// ============================================================
// KULTURA — Reporter de los tests de contrato: caída o contrato roto
//
// Un proveedor que no contesta (tiempo agotado, error de red, 5xx o 429) no
// dice nada de la forma de sus respuestas. Este reporter separa los fallos en
// dos grupos y los escribe en `contract-result.json`:
//   - `outage`: todos los errores son de proveedor caído.
//   - `broken`: cualquier otro (contrato, aserción, secreto que falta...).
// El workflow solo falla (y abre issue) si hay alguno en `broken`; si solo hay
// caídas, deja un aviso. Sin el archivo (vitest no llegó a terminar), falla.
// ============================================================

import { writeFileSync } from "node:fs";
import type { Reporter, TestModule } from "vitest/node";

const OUTAGE_KINDS = new Set(["timeout", "network", "circuit_open"]);

type ErrorLike = {
  name?: string;
  message?: string;
  kind?: string;
  status?: number;
  cause?: unknown;
};

/** ¿El error (o alguno de su cadena `cause`) es un proveedor caído? */
export function isOutage(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== "object" || depth > 5) return false;
  const e = error as ErrorLike;
  if (e.name === "ProviderError" || typeof e.kind === "string") {
    if (e.kind && OUTAGE_KINDS.has(e.kind)) return true;
    if (e.kind === "http" && (e.status === 429 || (e.status ?? 0) >= 500)) return true;
  }
  return isOutage(e.cause, depth + 1);
}

function firstLine(error: unknown): string {
  const e = (error ?? {}) as ErrorLike;
  return `${e.name ?? "Error"}: ${(e.message ?? "").split("\n")[0]}`.slice(0, 300);
}

export default class OutageReporter implements Reporter {
  onTestRunEnd(testModules: ReadonlyArray<TestModule>, unhandledErrors: ReadonlyArray<unknown>): void {
    const outage: string[] = [];
    const broken: string[] = [];

    const classify = (where: string, errors: ReadonlyArray<unknown>) => {
      if (errors.length === 0) {
        broken.push(`${where}: falló sin error`);
        return;
      }
      for (const error of errors) {
        (isOutage(error) ? outage : broken).push(`${where}: ${firstLine(error)}`);
      }
    };

    for (const mod of testModules) {
      if (mod.state() === "failed" && mod.errors().length > 0) classify(mod.moduleId, mod.errors());
      for (const test of mod.children.allTests()) {
        const result = test.result();
        if (result.state === "failed") classify(test.fullName, result.errors ?? []);
      }
    }
    if (unhandledErrors.length > 0) classify("error no capturado", unhandledErrors);

    writeFileSync("contract-result.json", JSON.stringify({ outage, broken }, null, 2));
  }
}
