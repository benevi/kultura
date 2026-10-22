import { KButton } from '@/components/ui/KButton'

interface NotFoundContentProps {
  title: string
  description: string
  goHome: string
  homeHref: string
}

/** Contenido de las 404. Es la única región de la página: `<main>` (ACC-7) y destino de "Saltar al contenido". */
export function NotFoundContent({ title, description, goHome, homeHref }: NotFoundContentProps) {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="flex flex-col items-center justify-center min-h-screen gap-6 p-8 text-center bg-surface-base"
    >
      <p aria-hidden="true" className="text-7xl font-display font-bold text-text-secondary">404</p>
      <h1 className="text-2xl font-display font-bold text-text-primary">{title}</h1>
      <p className="text-text-secondary max-w-sm">{description}</p>
      <KButton asChild variant="primary">
        <a href={homeHref}>{goHome}</a>
      </KButton>
    </main>
  )
}
