# Principios de depuración — Kultura

Reglas destiladas de ~13 ocurrencias reales en el proyecto. Leer antes de diagnosticar o tocar cualquier pantalla.

---

## 1. Verifica el estado real, no el mensaje de la herramienta ni copias viejas

Un test verde, un spec, un "OK" de la herramienta o un documento pueden afirmar algo que **no es cierto en el repo en vivo**. Antes de dar por bueno un estado, compruébalo directamente: `git log`, `vitest run`, el archivo real, la pantalla renderizada.

**Ejemplo real:** en B3.5f-2b la spec de Library indicaba componentes ya migrados, pero el archivo fuente seguía usando Button legacy. El test pasaba porque no cubría la ruta de renderizado real.

---

## 2. `docs/NOW.md` no es fuente fiable de estado

NOW.md no se mantiene al día de forma automática. La verdad es siempre el repo en vivo. Quien retoma trabajo **establece el estado real por sí mismo** (`git log`, `vitest run`, lectura de archivos) y luego actualiza NOW.md — no al revés.

**Ejemplo real:** varias sesiones arrancaron leyendo NOW.md como verdad y gastaron rondas corrigiendo asunciones que el repo ya había invalidado.

---

## 3. Diagnostica la raíz antes de tocar nada

Cuando un síntoma o documento contradiga lo esperado, **añade una fase de diagnóstico sin escribir código**: localiza los componentes y rutas reales, confirma la estructura, lista los focos exactos (archivo + línea). Solo entonces abre el editor.

**Ejemplo real:** validado en B3.5f-2b, 2c, 2d y 2e. En todos los casos la fase de diagnóstico previo evitó reescribir código correcto o tocar el archivo equivocado.

---

## 4. Al cerrar un sprint, repasa explícitamente las pantallas fuera del flujo normal

El patrón "pantalla pública o de borde que queda sin migrar y nadie lo nota hasta ver una captura" ya ocurrió dos veces:

- **Login/Auth** — descubierta en B3.5f-2c tras ver capturas de pantalla.
- **Landing pública** — descubierta en B3.5f-2e de la misma forma.

**Pantallas candidatas a quedar olvidadas:**

- Login / registro
- Landing pública (`/`)
- Páginas de error (404, 500)
- Confirmación de email / reset de contraseña
- Términos / privacidad
- Cualquier ruta accesible sin autenticar

Al cerrar un sprint de migración o rediseño, recorrer esta lista explícitamente antes de marcar el sprint como cerrado.
