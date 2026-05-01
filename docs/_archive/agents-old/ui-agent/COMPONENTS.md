# ui-agent — COMPONENTS (catálogo)

Registro de todos los componentes UI creados. Actualizar cada vez que se cree o modifique un componente.
Los demás agentes DEBEN consultar este archivo antes de usar cualquier componente.

## Estado
Ningún componente creado aún.

---

## Formato de entrada

```markdown
### NombreComponente
**Archivo:** `components/categoria/NombreComponente.tsx`
**Descripción:** Qué hace
**Props:**
- `prop: tipo` — descripción
**Variantes:** (si aplica)
**Uso:**
```tsx
<NombreComponente prop="valor" />
```
**Notas:** (restricciones, dependencias, etc.)
```

---

## Componentes planificados (Fase 1)

### Button
**Archivo:** `components/ui/Button.tsx`
**Estado:** ⏳ Pendiente
**Variantes:** primary (rojo #E82020), ghost, outline

### Badge
**Archivo:** `components/ui/Badge.tsx`
**Estado:** ⏳ Pendiente
**Uso:** géneros, estados, tipos de contenido

### Avatar
**Archivo:** `components/ui/Avatar.tsx`
**Estado:** ⏳ Pendiente
**Generado:** iniciales + color de fondo

### Spinner
**Archivo:** `components/ui/Spinner.tsx`
**Estado:** ⏳ Pendiente

### StarRating
**Archivo:** `components/ui/StarRating.tsx`
**Estado:** ⏳ Pendiente
**Escala:** 1-5 estrellas, interactivo o solo lectura

### StatusSelector
**Archivo:** `components/ui/StatusSelector.tsx`
**Estado:** ⏳ Pendiente
**Opciones:** completed | in_progress | pending | abandoned

### MediaCard
**Archivo:** `components/media/MediaCard.tsx`
**Estado:** ⏳ Pendiente
**Contenido:** poster 2:3, título, año, rating externo

### MediaGrid
**Archivo:** `components/media/MediaGrid.tsx`
**Estado:** ⏳ Pendiente
**Layout:** grid responsivo de MediaCards
