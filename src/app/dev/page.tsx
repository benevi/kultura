/**
 * /dev — Design system sandbox. Dev verification only. Not linked from the app.
 */
import { ContentCard } from "@/components/ui/ContentCard";
import { KButton } from "@/components/ui/KButton";
import { FilterChip } from "@/components/ui/FilterChip";
import { KInput } from "@/components/ui/KInput";

const TOKENS = [
  { name: "--surface-base", label: "surface-base", value: "#0A0C0E" },
  { name: "--surface-default", label: "surface-default", value: "#14181B" },
  { name: "--surface-elevated", label: "surface-elevated", value: "#1E2429" },
  { name: "--surface-border", label: "surface-border", value: "#2C343A" },
  { name: "--text-primary", label: "text-primary", value: "#F4F3EF" },
  { name: "--text-secondary", label: "text-secondary", value: "#9AA0A6" },
  { name: "--text-tertiary", label: "text-tertiary", value: "#6B7177" },
  { name: "--accent-positive", label: "accent-positive", value: "#6FCF97" },
  { name: "--accent-highlight", label: "accent-highlight", value: "#E6A23C" },
  { name: "--accent-info", label: "accent-info", value: "#5A9EE6" },
  { name: "--accent-danger", label: "accent-danger", value: "#E25C5C" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2
        className="mb-6 pb-2 font-display font-medium"
        style={{
          fontSize: "20px",
          color: "var(--text-primary)",
          borderBottom: "0.5px solid var(--surface-border)",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function DevPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--surface-base)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-inter), system-ui, sans-serif",
        padding: "32px 24px",
        maxWidth: "960px",
        margin: "0 auto",
      }}
    >
      {/* Wordmark */}
      <div className="mb-12">
        <h1
          style={{
            fontFamily: "var(--font-space-grotesk), system-ui, sans-serif",
            fontSize: "24px",
            fontWeight: 700,
            color: "var(--text-primary)",
            letterSpacing: "0.02em",
          }}
        >
          KULTURA
        </h1>
        <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: "4px" }}>
          /dev — Design system sandbox · B3.5f-1
        </p>
      </div>

      {/* ── 1. Color tokens ── */}
      <Section title="1. Tokens de color">
        <div className="grid grid-cols-2 gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
          {TOKENS.map((tok) => (
            <div
              key={tok.name}
              style={{
                borderRadius: "8px",
                overflow: "hidden",
                border: "0.5px solid var(--surface-border)",
              }}
            >
              <div
                style={{
                  background: `var(${tok.name})`,
                  height: "48px",
                  border: tok.name === "--surface-border"
                    ? "1px solid var(--surface-elevated)"
                    : undefined,
                }}
              />
              <div
                style={{
                  padding: "8px 10px",
                  backgroundColor: "var(--surface-default)",
                }}
              >
                <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "2px" }}>
                  {tok.label}
                </p>
                <p style={{ fontSize: "10px", color: "var(--text-tertiary)", fontFamily: "monospace" }}>
                  {tok.value}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 2. Tipografía ── */}
      <Section title="2. Tipografía">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <p style={{ fontSize: "10px", color: "var(--text-tertiary)", marginBottom: "4px" }}>
              Wordmark · Space Grotesk 700 · 24px
            </p>
            <p
              style={{
                fontFamily: "var(--font-space-grotesk), system-ui, sans-serif",
                fontSize: "24px",
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              KULTURA
            </p>
          </div>
          <div>
            <p style={{ fontSize: "10px", color: "var(--text-tertiary)", marginBottom: "4px" }}>
              h1 · Space Grotesk 700 · 28px
            </p>
            <p
              style={{
                fontFamily: "var(--font-space-grotesk), system-ui, sans-serif",
                fontSize: "28px",
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              Título de página
            </p>
          </div>
          <div>
            <p style={{ fontSize: "10px", color: "var(--text-tertiary)", marginBottom: "4px" }}>
              h2 · Space Grotesk 500 · 20px
            </p>
            <p
              style={{
                fontFamily: "var(--font-space-grotesk), system-ui, sans-serif",
                fontSize: "20px",
                fontWeight: 500,
                color: "var(--text-primary)",
              }}
            >
              Título de sección
            </p>
          </div>
          <div>
            <p style={{ fontSize: "10px", color: "var(--text-tertiary)", marginBottom: "4px" }}>
              h3 · Space Grotesk 500 · 16px
            </p>
            <p
              style={{
                fontFamily: "var(--font-space-grotesk), system-ui, sans-serif",
                fontSize: "16px",
                fontWeight: 500,
                color: "var(--text-primary)",
              }}
            >
              Título de card grande
            </p>
          </div>
          <div>
            <p style={{ fontSize: "10px", color: "var(--text-tertiary)", marginBottom: "4px" }}>
              Cuerpo · Inter 400 · 16px
            </p>
            <p
              style={{
                fontFamily: "var(--font-inter), system-ui, sans-serif",
                fontSize: "16px",
                fontWeight: 400,
                color: "var(--text-primary)",
              }}
            >
              Texto de cuerpo. Descubre, registra y comparte películas, series, anime, libros, cómics, manga y videojuegos.
            </p>
          </div>
          <div>
            <p style={{ fontSize: "10px", color: "var(--text-tertiary)", marginBottom: "4px" }}>
              UI / botones · Inter 500 · 14px
            </p>
            <p
              style={{
                fontFamily: "var(--font-inter), system-ui, sans-serif",
                fontSize: "14px",
                fontWeight: 500,
                color: "var(--text-primary)",
              }}
            >
              Añadir a biblioteca · Ver detalles · Guardar
            </p>
          </div>
          <div>
            <p style={{ fontSize: "10px", color: "var(--text-tertiary)", marginBottom: "4px" }}>
              Metadatos / caption · Inter 400 · 12px
            </p>
            <p
              style={{
                fontFamily: "var(--font-inter), system-ui, sans-serif",
                fontSize: "12px",
                fontWeight: 400,
                color: "var(--text-secondary)",
              }}
            >
              2023 · Acción · Drama · 2h 15min
            </p>
          </div>
        </div>
      </Section>

      {/* ── 3. ContentCard ── */}
      <Section title="3. ContentCard">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
            gap: "12px",
          }}
        >
          {/* Sin poster, sin badges */}
          <ContentCard title="Sin portada" />

          {/* Con rating, sin estado */}
          <ContentCard
            title="Oppenheimer"
            year={2023}
            rating={8.4}
            meta="Drama"
          />

          {/* Estado: visto */}
          <ContentCard
            title="Dune: Part Two"
            poster="https://image.tmdb.org/t/p/w500/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg"
            year={2024}
            rating={8.1}
            status="completed"
            meta="Ciencia ficción"
          />

          {/* Estado: pendiente */}
          <ContentCard
            title="Alien: Romulus"
            poster="https://image.tmdb.org/t/p/w500/b33nnKl1GSFbao4l3fZDDqsMx0F.jpg"
            year={2024}
            rating={7.3}
            status="pending"
            meta="Terror"
          />

          {/* Título largo */}
          <ContentCard
            title="El señor de los anillos: la comunidad del anillo"
            year={2001}
            rating={9.0}
            meta="Fantasía · Aventura"
          />
        </div>
      </Section>

      {/* ── 4. KButton ── */}
      <Section title="4. KButton">
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div>
            <p style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "12px" }}>
              Primario — tamaños
            </p>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
              <KButton variant="primary" size="sm">Pequeño</KButton>
              <KButton variant="primary" size="md">Mediano</KButton>
              <KButton variant="primary" size="lg">Grande</KButton>
            </div>
          </div>
          <div>
            <p style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "12px" }}>
              Secundario — tamaños
            </p>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
              <KButton variant="secondary" size="sm">Pequeño</KButton>
              <KButton variant="secondary" size="md">Mediano</KButton>
              <KButton variant="secondary" size="lg">Grande</KButton>
            </div>
          </div>
          <div>
            <p style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "12px" }}>
              Estados: disabled
            </p>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
              <KButton variant="primary" disabled>Primario desactivado</KButton>
              <KButton variant="secondary" disabled>Secundario desactivado</KButton>
            </div>
          </div>
          <div>
            <p style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "12px" }}>
              Acciones de ejemplo
            </p>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <KButton variant="primary">Añadir a biblioteca</KButton>
              <KButton variant="secondary">Ver detalles</KButton>
              <KButton variant="secondary">Compartir</KButton>
            </div>
          </div>
        </div>
      </Section>

      {/* ── 5. FilterChip ── */}
      <Section title="5. FilterChip">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <p style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "8px" }}>
              Inactivo / activo
            </p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <FilterChip label="Todos" active />
              <FilterChip label="Película" />
              <FilterChip label="Serie" />
              <FilterChip label="Anime" />
              <FilterChip label="Libro" />
              <FilterChip label="Cómic" />
              <FilterChip label="Manga" />
              <FilterChip label="Videojuego" />
            </div>
          </div>
          <div>
            <p style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "8px" }}>
              Variante activa en distintas posiciones
            </p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <FilterChip label="Todos" />
              <FilterChip label="Película" active />
              <FilterChip label="Serie" />
              <FilterChip label="Anime" />
            </div>
          </div>
          <div>
            <p style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "8px" }}>
              Disabled
            </p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <FilterChip label="Disponible" active />
              <FilterChip label="Desactivado" disabled />
            </div>
          </div>
        </div>
      </Section>

      {/* ── 6. KInput ── */}
      <Section title="6. KInput">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "400px" }}>
          <KInput
            label="Sin estado (normal)"
            placeholder="Buscar películas, series, anime..."
          />
          <KInput
            label="Con hint"
            placeholder="usuario@ejemplo.com"
            hint="Usaremos tu email solo para notificaciones."
          />
          <KInput
            label="Con error"
            placeholder="Contraseña"
            type="password"
            defaultValue="abc"
            error="La contraseña debe tener al menos 8 caracteres."
          />
          <KInput
            label="Disabled"
            placeholder="No editable"
            disabled
            defaultValue="contenido bloqueado"
          />
        </div>
      </Section>

      {/* ── 7. Eliminados (verificación) ── */}
      <Section title="7. Lo eliminado — verificación">
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {[
            "Rojo intenso como color de marca: NO aparece en ningún componente arriba",
            "Mayúsculas condensadas stencil en headers: NO usadas",
            "Badge movie/game en portadas: NO presente en ContentCard",
            "Foco de input rojo: el foco de KInput es verde (--accent-positive)",
            "Negro plano sin capas: hay 4 niveles de superficie",
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
              <span style={{ color: "var(--accent-positive)", flexShrink: 0, marginTop: "1px" }}>✓</span>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{item}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
