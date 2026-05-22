import { Space_Grotesk, Inter } from 'next/font/google'
import { NotFoundContent } from '@/components/ui/NotFoundContent'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
})

export default function RootNotFound() {
  return (
    <div className={`${spaceGrotesk.variable} ${inter.variable} font-body`}>
      <NotFoundContent
        title="Página no encontrada"
        description="La página que buscas no existe o fue movida."
        goHome="Ir al inicio"
        homeHref="/home"
      />
    </div>
  )
}
