import { Bricolage_Grotesque, Figtree } from 'next/font/google'
import { NotFoundContent } from '@/components/ui/NotFoundContent'

const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
})

const figtree = Figtree({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-body',
  display: 'swap',
})

export default function RootNotFound() {
  return (
    <div className={`${bricolageGrotesque.variable} ${figtree.variable} font-body`}>
      <NotFoundContent
        title="Página no encontrada"
        description="La página que buscas no existe o fue movida."
        goHome="Ir al inicio"
        homeHref="/home"
      />
    </div>
  )
}
