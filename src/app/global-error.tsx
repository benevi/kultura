'use client'

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: '#0A0C0E',
          color: '#F4F3EF',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <p style={{ fontSize: '1.125rem', margin: 0 }}>Algo salió mal</p>
        <button
          onClick={reset}
          style={{
            padding: '0.5rem 1.25rem',
            borderRadius: '10px',
            border: '1px solid #2C343A',
            background: 'transparent',
            color: '#9AA0A6',
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          Intentar de nuevo
        </button>
      </body>
    </html>
  )
}
