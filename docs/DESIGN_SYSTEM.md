# DESIGN_SYSTEM — KULTURA (dirección "Coleccionista")

> Fuente de verdad del sistema visual de KULTURA. Aprobado por el humano el 2026-05-20.
> Claude Code implementa esto al pie de la letra en B3.5f. Cualquier desviación se reporta antes de aplicar.
> Reemplaza el esquema rojo/negro tipo Netflix anterior.

---

## 0. Principios

1. **Las portadas mandan.** El contenido (imágenes de TMDB) es el protagonista. El sistema es el marco, nunca compite con la imagen.
2. **El color significa, no decora.** Cada acento tiene un rol semántico fijo. Si un color no comunica estado, no se usa.
3. **Profundidad por capas, no por sombras pesadas.** Las superficies se distinguen por luminosidad, no por drop-shadows dramáticos.
4. **Oscuro primero.** El modo oscuro es el canónico y debe ser excelente. El claro llega como bloque posterior (B3.5f-claro), pero los tokens se nombran semánticamente desde ya para soportarlo sin reescritura.
5. **Formas mixtas.** Estructura con esquinas definidas; contenido con esquinas suaves.

---

## 1. Color — modo oscuro (canónico)

### Superficies (tokens semánticos)

| Token | Hex | Uso |
|---|---|---|
| `--surface-base` | `#0A0C0E` | Fondo de página, lo más profundo |
| `--surface-default` | `#14181B` | Cards, paneles, contenedores |
| `--surface-elevated` | `#1E2429` | Modales, dropdowns, elementos sobre cards |
| `--surface-border` | `#2C343A` | Bordes, divisores, contornos sutiles |

### Texto

| Token | Hex | Uso |
|---|---|---|
| `--text-primary` | `#F4F3EF` | Títulos, texto principal (blanco cálido, no puro) |
| `--text-secondary` | `#9AA0A6` | Subtítulos, metadatos |
| `--text-tertiary` | `#6B7177` | Hints, placeholders, texto desactivado |

### Acentos con rol semántico (REGLA DURA: no usar fuera de su rol)

| Token | Hex | Rol exclusivo |
|---|---|---|
| `--accent-positive` | `#6FCF97` | Verde. Estado consumado/positivo: visto, completado, "me gusta", valoración alta, confirmaciones. Es el acento PRINCIPAL de marca. |
| `--accent-highlight` | `#E6A23C` | Ámbar. Destacado/aspiracional: rating en estrellas, contenido premium, badges de oro, "quiero ver". |
| `--accent-info` | `#5A9EE6` | Azul. Información y enlaces: links, tooltips, estados informativos neutros. |
| `--accent-danger` | `#E25C5C` | Rojo (desaturado). SOLO destructivo: eliminar, error, alerta. Nunca como color de marca. |

> **Texto sobre acentos:** usar siempre el tono más oscuro de la misma familia, nunca negro puro.
> - Sobre verde `#6FCF97` → texto `#0A1810`
> - Sobre ámbar `#E6A23C` → texto `#1A1209`
> - Sobre azul `#5A9EE6` → texto `#06182E`

### El rojo queda RETIRADO como color de marca

El rojo intenso anterior (firma Netflix) se elimina de todo uso identitario. Solo sobrevive `--accent-danger` desaturado para acciones destructivas. El wordmark, botones primarios, foco de inputs, enlaces y avatares dejan de ser rojos.

---

## 2. Color — modo claro (PENDIENTE, bloque posterior)

No se implementa en el primer bloque. Los tokens semánticos anteriores se mapearán a una paleta clara cuando se aborde B3.5f-claro. Reservar:
- `--surface-base` claro ≈ `#FAF9F6` (crema, no blanco puro).
- Acentos: mismos roles, tonos ajustados para contraste sobre claro.

Regla: **ningún componente debe hardcodear hex.** Todo pasa por token. Esto es lo que permite añadir el claro sin tocar componentes.

---

## 3. Tipografía

| Familia | Uso | Pesos |
|---|---|---|
| **Space Grotesk** | Wordmark, encabezados (h1–h3), números destacados (ratings, stats) | 500, 700 |
| **Inter** | Cuerpo, UI, reseñas, descripciones, labels, metadatos | 400, 500, 600 |

### Jerarquía

| Rol | Fuente | Tamaño | Peso |
|---|---|---|---|
| Wordmark | Space Grotesk | 24–26px | 700 |
| h1 (título de página) | Space Grotesk | 28px | 700 |
| h2 (sección) | Space Grotesk | 20px | 500 |
| h3 (card title grande) | Space Grotesk | 16px | 500 |
| Cuerpo | Inter | 16px | 400 |
| UI / botones | Inter | 14px | 500 |
| Metadatos / caption | Inter | 12px | 400 |

- **Sentence case** en UI y cuerpo. El wordmark KULTURA puede ir en mayúsculas (es marca).
- Se retira el uso de mayúsculas condensadas tipo stencil para todos los headers (era parte del look Netflix/militar).

---

## 4. Formas y espaciado

| Elemento | Radio | Notas |
|---|---|---|
| Cards de contenido (portadas) | 12px | Suave |
| Botones, inputs | 10px | Suave |
| Pills / chips de filtro | 20px (pill) | Redondeo total |
| Modales, paneles estructurales | 8px | Más definido |
| Barras de navegación | 0–4px | Estructura, casi recto |
| Avatares | 50% | Círculo |

- Bordes: `0.5px solid var(--surface-border)` por defecto; `1px` para énfasis.
- Profundidad por capa de superficie, no por sombra. Sombras solo funcionales (focus ring).
- Espaciado vertical en múltiplos de 4px (8, 12, 16, 24, 32).

---

## 5. Componentes clave (especificación)

### Card de contenido (portada)
- `--surface-default`, radio 12px, borde 0.5px.
- Imagen de portada aspect-ratio 2/3, ocupa la parte superior completa.
- Badge de rating: esquina superior derecha, fondo `rgba(10,12,14,0.85)`, texto ámbar, "★ 8.4".
- Badge de estado (si aplica): esquina inferior izquierda. "VISTO" → fondo verde, texto oscuro. "PENDIENTE" → superficie elevada, texto secundario.
- Título (Inter 14px/500) + metadatos (Inter 12px, texto secundario) bajo la imagen.

### Botón primario
- Fondo `--accent-positive` (verde), texto `#0A1810`, radio 10px, Inter 14px/600.
- Hover: aclarar 8%. Active: scale(0.98).

### Botón secundario
- Transparente, borde 1px `--surface-border`, texto `--text-secondary`. Hover: fondo `--surface-elevated`.

### Chip de filtro
- Inactivo: `--surface-elevated`, texto secundario, pill.
- Activo: fondo `--accent-positive`, texto oscuro, pill.

### Input
- Fondo `--surface-base`, borde 1px `--surface-border`, radio 10px.
- Foco: borde `--accent-positive` (NO rojo), focus ring sutil.
- Placeholder: `--text-tertiary`.

---

## 6. Lo que se ELIMINA del diseño actual

1. Rojo intenso como color de marca (todo uso identitario).
2. Mayúsculas condensadas stencil en headers.
3. Negro plano sin capas de profundidad.
4. Badge "movie"/"game" en esquina de portadas (feo, redundante — el tipo se infiere o va en metadatos).
5. Foco de input rojo.
6. Sobreuso de un solo acento para todo.

---

## 7. Estados vacíos (CRÍTICO — causa principal de "se ve pobre")

Los estados vacíos actuales (Home con tres "aún no tienes nada") son la mayor causa de sensación de pobreza. Regla nueva:
- Ningún estado vacío es solo texto centrado sobre vacío negro.
- Cada estado vacío lleva: un icono o ilustración ligera, un mensaje con voz de marca, y una acción clara (botón primario verde).
- Donde sea posible, mostrar contenido de ejemplo/sugerido en vez de vacío (ej. Home sin amigos → mostrar populares globales en vez de "añade amigos").

Esto se detalla por pantalla en el bloque de aplicación.

---

## 8. Pendiente de definir en bloques posteriores

- Modo claro completo (B3.5f-claro).
- Sistema de movimiento/transiciones (B3.5f-2): se especifica aparte.
- Aplicación pantalla por pantalla (B3.5f-aplicación).
- Wordmark/logo definitivo: por ahora Space Grotesk 700 en `--text-primary`. Si se quiere logo gráfico, es sub-tarea aparte.