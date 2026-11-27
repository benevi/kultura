'use client'

import dynamic from 'next/dynamic'

/**
 * Las piezas de «Sala» del perfil público `/u/[username]` (fase 8.5 P3) y de
 * su nota pública `/u/[username]/r/…` (P4), por
 * `next/dynamic` mientras dure la bandera `SALA_PERFIL`, como
 * `SalaProfileLazy`. Van aparte de aquel para no arrastrar las acciones de
 * amistad (`SalaProfileSocial`), que `/u` no usa, ni sus textos: `/u` tiene
 * su propio proveedor de textos (`u/layout.tsx`). Todas salen del mismo
 * módulo, así que van en un solo trozo.
 */
export const SalaProfileHeaderLazy = dynamic(() => import('./SalaProfile').then((m) => m.SalaProfileHeader))
export const SalaProfileEditLazy = dynamic(() => import('./SalaProfile').then((m) => m.SalaProfileEdit))
export const SalaProfileNumbersLazy = dynamic(() => import('./SalaProfile').then((m) => m.SalaProfileNumbers))
export const SalaProfileRowLazy = dynamic(() => import('./SalaProfile').then((m) => m.SalaProfileRow))
export const SalaProfileStateLazy = dynamic(() => import('./SalaProfile').then((m) => m.SalaProfileState))
export const SalaProfileFavoritesLazy = dynamic(() => import('./SalaProfile').then((m) => m.SalaProfileFavorites))
export const SalaProfileInviteLazy = dynamic(() => import('./SalaProfile').then((m) => m.SalaProfileInvite))
export const SalaProfileCtaLazy = dynamic(() => import('./SalaProfile').then((m) => m.SalaProfileCta))
export const SalaProfileLinkButtonLazy = dynamic(() => import('./SalaProfile').then((m) => m.SalaProfileLinkButton))
export const SalaProfileReviewLazy = dynamic(() => import('./SalaProfile').then((m) => m.SalaProfileReview))
