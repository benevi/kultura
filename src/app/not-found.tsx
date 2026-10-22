import { bricolageGrotesque, figtree } from '@/app/fonts'
import { NotFoundContent } from '@/components/ui/NotFoundContent'



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
