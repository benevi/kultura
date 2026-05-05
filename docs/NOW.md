# B3.5c-1 — Diagnóstico de los 5 bugs concretos

## Qué cambia

Diagnosticar SIN ARREGLAR los 5 bugs detectados en B3.5b. Cada uno con: síntoma, hipótesis de causa, archivo(s) implicado(s), test E2E que lo cubre (o estado del test).

Bug 6 (discover/H3) absorbe el hallazgo de B3.5e-3-local-FIX: el `waitForLoadState('networkidle')` resuelve en ~1s con grid vacío — el Server Component llama a APIs externas que no responden en contexto headless, o el selector de cards está incorrecto.

## Cómo sé que funciona

`docs/B3_5c_BUGS.md` existe con 6 secciones (una por bug), cada una con:
- (a) síntoma observado
- (b) hipótesis de causa con archivo(s) y línea(s) relevantes
- (c) test E2E correspondiente y su estado actual

## Archivos que toco

`docs/B3_5c_BUGS.md` (nuevo). Lectura de `src/` permitida. Modificación de `src/` NO permitida.

## Cuándo paro

Tras pegar el documento completo con las 6 secciones.
