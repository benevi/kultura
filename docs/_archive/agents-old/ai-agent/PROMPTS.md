# ai-agent — PROMPTS (fuente de verdad)

Registro de todos los prompts usados con Claude API.
Cada prompt debe estar documentado aquí antes de implementarse.

## Estado
Ningún prompt implementado aún.

---

## Formato de entrada

```markdown
### PROMPT-NNN — Nombre
**Modalidad:** (si-te-gustó | popular-circulo | novedades-generos)
**Modelo:** claude-sonnet-4-20250514
**Max tokens:** 1024
**Endpoint:** POST /api/recommendations

**Input:**
Descripción de qué datos se pasan al prompt

**System prompt:**
El system prompt exacto

**User prompt template:**
El template exacto con variables

**Output esperado:**
Formato JSON esperado

**Ejemplo:**
Input de ejemplo → Output de ejemplo

**Estado:** ⏳ Pendiente | ✅ Implementado
```

---

## Prompts planificados

### PROMPT-001 — Si te gustó X, prueba Y
**Modalidad:** si-te-gustó
**Estado:** ⏳ Pendiente
**Descripción:** Basado en el historial de puntuaciones del usuario (4-5 estrellas), recomienda títulos similares que no tenga ya en su biblioteca.

**Input necesario:**
- Lista de títulos con 4-5 estrellas del usuario (título, tipo, géneros, año)
- Lista de IDs ya en su biblioteca (para excluir)
- Tipo de contenido objetivo (movie | tv | anime | book | comic | manga | game)

---

### PROMPT-002 — Popular en tu círculo
**Modalidad:** popular-circulo
**Estado:** ⏳ Pendiente
**Descripción:** Identifica los títulos más vistos/puntuados entre los amigos del usuario que él aún no ha visto.

**Input necesario:**
- Lista de títulos vistos por amigos (título, tipo, cuántos amigos lo han visto, puntuación media)
- Lista de IDs ya en su biblioteca (para excluir)

---

### PROMPT-003 — Novedades en tus géneros favoritos
**Modalidad:** novedades-generos
**Estado:** ⏳ Pendiente
**Descripción:** Basado en los géneros más consumidos del usuario, recomienda estrenos recientes (últimos 3 meses).

**Input necesario:**
- Top 3 géneros favoritos del usuario
- Lista de estrenos recientes de esos géneros (obtenida de las APIs)
- Lista de IDs ya en su biblioteca (para excluir)

---

## Reglas generales para todos los prompts

1. ANTHROPIC_API_KEY solo en server-side (Route Handler)
2. Siempre pedir respuesta en JSON válido
3. Siempre incluir instrucción de excluir títulos ya en biblioteca
4. Max 10 recomendaciones por llamada
5. Incluir motivo de cada recomendación (para mostrarlo al usuario)
6. Modelo: claude-sonnet-4-20250514
7. Max tokens: 1024
