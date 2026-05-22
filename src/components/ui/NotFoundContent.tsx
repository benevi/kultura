import { KButton } from '@/components/ui/KButton'

interface NotFoundContentProps {
  title: string
  description: string
  goHome: string
  homeHref: string
}

export function NotFoundContent({ title, description, goHome, homeHref }: NotFoundContentProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-8 text-center bg-surface-base">
      <p className="text-7xl font-display font-bold text-text-secondary">404</p>
      <h1 className="text-2xl font-display font-bold text-text-primary">{title}</h1>
      <p className="text-text-secondary max-w-sm">{description}</p>
      <KButton asChild variant="primary">
        <a href={homeHref}>{goHome}</a>
      </KButton>
    </div>
  )
}
