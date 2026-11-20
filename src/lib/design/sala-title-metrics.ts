// GENERADO por scripts/gen-sala-title-metrics.mjs. No editar.
// Anybody a peso 800, medida en Chromium sobre los archivos de assets/fonts/anybody/.

/** Huella de los archivos medidos: si cambian, hay que volver a generar (lo comprueba el test). */
export const SALA_TITLE_FONT_SHA256 = '81d3b477b63d35c927eb8451930e225bc3771f34c0b1a13d9bd63dccb04112d7'

/** Peso al que se midió: el del papel `title` de los tokens. */
export const SALA_TITLE_WEIGHT = 800

/** Ascendente y descendente de Anybody, en em. */
export const SALA_TITLE_ASCENT = 0.795
export const SALA_TITLE_DESCENT = 0.24

/**
 * Para qué caracteres vale la fuente de respaldo: el alfabeto latino con sus
 * acentos y la puntuación de un título, todos medidos en Anybody. Un carácter
 * de fuera cae en el resto de la pila, sin ajuste.
 */
export const SALA_TITLE_FALLBACK_RANGE = 'U+0020-007E,U+00A0-00AC,U+00AE-0148,U+014A-017E,U+2013-2014,U+2018-201A,U+201C-201E,U+2026,U+2039-203A,U+20AC'

/**
 * Interletraje (kerning) en 107 títulos reales: lo pintado frente a la suma de
 * avances. Nunca ensancha (máximo 0 %) y estrecha hasta un 10.5 %.
 * Por eso la suma de avances es un tope del ancho de una línea.
 */
export const SALA_TITLE_KERNING = { max: 0, min: -0.1049 } as const

/**
 * Fuente de respaldo (Arial Bold y sus equivalentes) por tramo del eje de
 * anchura: `sizeAdjust` es cuánto se escala para que el título más
 * desfavorable del corpus mida un 1 % menos que con Anybody en el extremo
 * estrecho del tramo; `mean`, lo que mide de media (1 = igual que Anybody).
 */
export const SALA_TITLE_FALLBACK: ReadonlyArray<{ from: number; to: number; sizeAdjust: number; mean: number }> = [
  { from: 50, to: 54, sizeAdjust: 0.415, mean: 0.501 },
  { from: 55, to: 59, sizeAdjust: 0.464, mean: 0.554 },
  { from: 60, to: 64, sizeAdjust: 0.513, mean: 0.606 },
  { from: 65, to: 69, sizeAdjust: 0.562, mean: 0.658 },
  { from: 70, to: 74, sizeAdjust: 0.602, mean: 0.711 },
  { from: 75, to: 79, sizeAdjust: 0.639, mean: 0.763 },
  { from: 80, to: 84, sizeAdjust: 0.676, mean: 0.815 },
  { from: 85, to: 89, sizeAdjust: 0.712, mean: 0.868 },
  { from: 90, to: 94, sizeAdjust: 0.749, mean: 0.92 },
  { from: 95, to: 99, sizeAdjust: 0.786, mean: 0.972 },
  { from: 100, to: 104, sizeAdjust: 0.822, mean: 1.025 },
  { from: 105, to: 109, sizeAdjust: 0.859, mean: 1.077 },
  { from: 110, to: 114, sizeAdjust: 0.896, mean: 1.13 },
  { from: 115, to: 119, sizeAdjust: 0.933, mean: 1.182 },
  { from: 120, to: 124, sizeAdjust: 0.969, mean: 1.235 },
  { from: 125, to: 129, sizeAdjust: 1.006, mean: 1.287 },
  { from: 130, to: 134, sizeAdjust: 1.043, mean: 1.34 },
  { from: 135, to: 139, sizeAdjust: 1.08, mean: 1.392 },
  { from: 140, to: 144, sizeAdjust: 1.116, mean: 1.445 },
  { from: 145, to: 150, sizeAdjust: 1.153, mean: 1.497 },
]

/**
 * Avance de cada carácter, en milésimas de em: `código:a50:a100:a150`, en
 * base 36. Entre esos tres puntos del eje de anchura el avance es lineal
 * (error máximo medido a 75 y 125 %: 0.5 milésimas).
 */
export const SALA_TITLE_ADVANCES_RAW =
  'w:2n:78:bt x:5o:7x:a6 y:6c:8r:b7 z:e1:md:up 10:9m:il:rl 11:c2:ls:vj 12:c5:nj:yy 13:3q:5g:76 14:5z:at:fn 15:5z:ax:fv 16:6j:8t:b3 17:6j:8s:b2 18:5b:95:cz 19:63:db:kj 1a:4x:7a:9m 1b:75:ec:ll 1c:9d:hs:q7 1d:89:gs:pb 1e:9d:i7:r1 1f:97:i7:r6 1g:a4:i0:pw 1h:98:hy:qo 1i:97:i4:r2 1j:85:ga:of 1k:98:hw:qk 1l:97:i5:r4 1m:4x:7a:9m 1n:5c:8q:c4 1o:6c:cd:if 1p:69:8z:bo 1q:6b:cd:if 1r:9x:ib:qq 1s:dp:r3:14i 1t:9k:l5:ws 1u:9d:jq:u4 1v:9d:jm:tv 1w:9c:jj:tq 1x:6d:gh:ql 1y:6d:fc:ob 1z:9f:k9:v5 20:9d:k2:ur 21:4r:98:dp 22:9b:jg:tm 23:9o:iq:rs 24:6g:ez:nj 25:f9:qr:12a 26:c3:n3:y4 27:9b:ka:v9 28:9e:is:s7 29:9d:kb:v9 2a:9h:jd:t9 2b:9g:jr:u2 2c:7u:ik:tb 2d:9f:kc:v9 2e:9q:k4:ui 2f:ff:to:17y 2g:a7:k6:u4 2h:a0:km:v8 2i:6h:gy:rg 2j:6p:b6:fn 2k:8c:ep:l3 2l:6p:b7:fo 2m:6x:bm:gc 2n:8m:iw:t6 2o:4f:9u:f9 2p:9o:jg:t9 2q:9d:je:tg 2r:9j:ic:r6 2s:9e:jj:tp 2t:9i:je:tb 2u:7c:em:lx 2v:9e:jm:tv 2w:9d:j7:t1 2x:4u:8q:cm 2y:50:94:da 2z:9w:ik:r9 30:4q:8o:cm 31:e2:s7:16c 32:9d:j3:su 33:9d:jg:tj 34:9d:je:tg 35:9e:jg:th 36:9d:j0:so 37:9l:j6:ss 38:72:fb:nk 39:9g:j2:sq 3a:9v:il:rb 3b:g3:rt:13j 3c:9y:j5:sd 3d:a9:ig:qo 3e:6g:fz:pi 3f:6t:bt:gt 3g:3w:67:8j 3h:6t:bn:gi 3i:82:d1:i0 4g:2n:78:bt 4h:4y:76:9e 4i:9e:im:ru 4j:as:if:q1 4k:db:ju:qe 4l:a0:km:v8 4m:3w:67:8i 4n:8z:iw:su 4o:6l:d5:jo 4p:br:lg:v6 4q:61:au:fo 4r:ds:kj:ra 4s:7z:ef:kx 4u:be:k6:sy 4v:51:do:mb 4w:41:4g:4v 4x:6j:8v:b7 4y:4y:b1:h4 4z:4x:ba:hp 50:4e:9o:ey 51:9f:j1:so 52:aj:it:r3 53:4x:7f:9x 54:57:bf:hm 55:4e:a6:fz 56:6l:ag:ec 57:dt:kl:rd 58:dn:sk:17j 59:d8:si:17t 5a:e5:to:197 5b:9x:hr:pl 5c:9k:l5:ws 5d:9k:l5:ws 5e:9k:l5:ws 5f:9k:l5:ws 5g:9k:l5:ws 5h:9k:l5:ws 5i:bt:t4:1ag 5j:9d:jm:tv 5k:6d:gh:ql 5l:6d:gh:ql 5m:6d:gh:ql 5n:6d:gh:ql 5o:4r:98:dp 5p:4r:98:dp 5q:4r:98:dp 5r:4r:98:dp 5s:a1:k5:u9 5t:c3:n3:y4 5u:9b:ka:v9 5v:9b:ka:v9 5w:9b:ka:v9 5x:9b:ka:v9 5y:9b:ka:v9 5z:74:94:b5 60:9b:jl:tw 61:9f:kc:v9 62:9f:kc:v9 63:9f:kc:v9 64:9f:kc:v9 65:a0:km:v8 66:9h:in:rt 67:ap:k2:tg 68:9o:jg:t9 69:9o:jg:t9 6a:9o:jg:t9 6b:9o:jg:t9 6c:9o:jg:t9 6d:9o:jg:t9 6e:ee:v6:1by 6f:9j:ic:r6 6g:9i:je:tb 6h:9i:je:tb 6i:9i:je:tb 6j:9i:je:tb 6k:4s:8g:c5 6l:4s:8g:c5 6m:4s:8g:c5 6n:4s:8g:c5 6o:9d:jg:tj 6p:9d:j3:su 6q:9d:jg:tj 6r:9d:jg:tj 6s:9d:jg:tj 6t:9d:jg:tj 6u:9d:jg:tj 6v:6r:8s:at 6w:9c:jg:tj 6x:9g:j2:sq 6y:9g:j2:sq 6z:9g:j2:sq 70:9g:j2:sq 71:a9:ig:qo 72:9d:jh:tl 73:a9:ig:qo 74:9k:l5:ws 75:9o:jg:t9 76:9k:l5:ws 77:9o:jg:t9 78:9k:l5:ws 79:9o:jg:t9 7a:9d:jm:tv 7b:9j:ic:r6 7c:9d:jm:tv 7d:9j:ic:r6 7e:9d:jm:tv 7f:9j:ic:r6 7g:9d:jm:tv 7h:9j:ic:r6 7i:9c:jj:tq 7j:d4:nh:xv 7k:a1:k5:u9 7l:9e:jj:tq 7m:6d:gh:ql 7n:9i:je:tb 7o:6d:gh:ql 7p:9i:je:tb 7q:6d:gh:ql 7r:9i:je:tb 7s:6d:gh:ql 7t:9i:je:tb 7u:6d:gh:ql 7v:9i:je:tb 7w:9f:k9:v5 7x:9e:jm:tv 7y:9f:k9:v5 7z:9e:jm:tv 80:9f:k9:v5 81:9e:jm:tv 82:9f:k9:v5 83:9e:jm:tv 84:9d:k2:ur 85:9d:j7:t1 86:ad:k8:u3 87:9d:iu:sb 88:4r:98:dp 89:4s:8g:c5 8a:4r:98:dp 8b:4s:8g:c5 8c:4r:98:dp 8d:4s:8g:c5 8e:4r:98:dp 8f:4s:8g:c5 8g:4r:98:dp 8h:4s:8g:c5 8i:e2:so:17b 8j:9t:ht:pu 8k:9b:jg:tm 8l:4z:94:da 8m:9o:iq:rs 8n:9w:ik:r9 8o:9p:iq:rr 8p:6g:ez:nj 8q:4q:8o:cm 8r:6g:ez:nj 8s:4q:8o:cm 8t:9c:fz:mm 8u:4q:8o:cm 8v:bd:md:xf 8w:97:dg:hp 8x:7e:gd:pe 8y:6v:8z:b3 8z:c3:n3:y4 90:9d:j3:su 91:c3:n3:y4 92:9d:j3:su 93:c3:n3:y4 94:9d:j3:su 96:c4:n4:y4 97:9d:j3:su 98:9b:ka:v9 99:9d:jg:tj 9a:9b:ka:v9 9b:9d:jg:tj 9c:9b:ka:v9 9d:9d:jg:tj 9e:b2:tf:1bt 9f:e7:vo:1d5 9g:9h:jd:t9 9h:9d:j0:so 9i:9h:jd:t9 9j:9d:j0:so 9k:9h:jd:t9 9l:9d:j0:so 9m:9g:jr:u2 9n:9l:j6:ss 9o:9g:jr:u2 9p:9l:j6:ss 9q:9h:jr:u2 9r:9l:j6:ss 9s:9g:jr:u2 9t:9l:j6:ss 9u:7u:ik:tb 9v:7v:fp:nk 9w:7u:ik:tb 9x:9z:i6:qf 9y:7u:ik:tb 9z:72:fb:nk a0:9f:kc:v9 a1:9g:j2:sq a2:9f:kc:v9 a3:9g:j2:sq a4:9f:kc:v9 a5:9g:j2:sq a6:9f:kc:v9 a7:9g:j2:sq a8:9f:kc:v9 a9:9g:j2:sq aa:9f:kc:v9 ab:9g:j2:sq ac:ff:to:17y ad:g3:rt:13j ae:a0:km:v8 af:a9:ig:qo ag:a0:km:v8 ah:6h:gy:rg ai:6g:fz:pi aj:6h:gy:rg ak:6g:fz:pi al:6h:gy:rg am:6g:fz:pi b3:9g:j7:sz b6:8l:fg:mb bk:9b:ka:v9 bl:9d:jg:tj bz:9f:kc:v9 c0:9g:j2:sq ck:fs:10h:1l6 cl:fr:zh:1j7 cm:ft:zh:1j6 cn:fr:yf:1h4 co:bf:o3:10t cp:9p:hs:pw cq:le:16j:1rq cr:h3:w7:1be cs:ec:s7:164 ct:9k:l5:ws cu:9o:jg:t9 cv:4r:98:dp cw:4s:8g:c5 cx:9b:ka:v9 cy:9d:jg:tj cz:9f:kc:v9 d0:9g:j2:sq d1:9f:kc:v9 d2:9g:j2:sq d3:9f:kc:v9 d4:9g:j2:sq d5:9f:kc:v9 d6:9g:j2:sq d7:9f:kc:v9 d8:9g:j2:sq di:9f:k9:v5 dj:9e:jm:tv dm:9b:ka:v9 dn:9d:jg:tj do:9b:ka:v9 dp:9d:jg:tj e2:9k:l5:ws e3:9o:jg:t9 e4:bt:t4:1ag e5:ee:v6:1by e6:9b:jl:tw e7:9c:jg:tj e8:9k:l5:ws e9:9o:jg:t9 ea:9k:l5:ws eb:9o:jg:t9 ec:6d:gh:ql ed:9i:je:tb ee:6d:gh:ql ef:9i:je:tb eg:4r:98:dp eh:4s:8g:c5 ei:4r:98:dp ej:4s:8g:c5 ek:9b:ka:v9 el:9d:jg:tj em:9b:ka:v9 en:9d:jg:tj eo:9h:jd:t9 ep:9d:j0:so eq:9h:jd:t9 er:9d:j0:so es:9f:kc:v9 et:9g:j2:sq eu:9f:kc:v9 ev:9g:j2:sq ew:9g:jr:u2 ex:9l:j6:ss ey:7u:ik:tb ez:72:fb:nk fe:9b:ka:v9 ff:9d:jg:tj fg:9b:ka:v9 fh:9d:jg:tj fk:9b:ka:v9 fl:9d:jg:tj fm:a0:km:v8 fn:a9:ig:qo fr:4z:94:da gp:9i:je:tb jg:3i:5q:7y jq:5e:cd:jb jr:5e:cd:jb jt:51:do:mb ka:4l:6y:9c kc:7c:bq:g3 kd:7f:ft:o8 5xk:9d:jm:tv 5xl:9j:ic:r6 5xo:9c:jj:tq 5xp:9e:jj:tp 5xq:9c:jj:tq 5xr:9e:jj:tp 5xw:6d:gh:ql 5xx:9i:je:tb 5xy:6d:gh:ql 5xz:9i:je:tb 5y4:6d:gh:ql 5y5:9i:je:tb 5y8:9f:k9:v5 5y9:9e:jm:tv 5yc:9d:k2:ur 5yd:9d:j7:t1 5yi:9d:k2:ur 5yj:9d:j7:t1 5ym:4r:98:dp 5yn:4s:8g:c5 5yu:6g:ez:nj 5yv:4q:8o:cm 5yw:6g:ez:nj 5yx:4q:8o:cm 5yy:6g:ez:nj 5yz:4q:8o:cm 5z6:f9:qr:12a 5z7:e2:s7:16c 5z8:c3:n3:y4 5z9:9d:j3:su 5za:c3:n3:y4 5zb:9d:j3:su 5zc:c3:n3:y4 5zd:9d:j3:su 5zg:9b:ka:v9 5zh:9d:jg:tj 5zi:9b:ka:v9 5zj:9d:jg:tj 5zk:9b:ka:v9 5zl:9d:jg:tj 5zm:9b:ka:v9 5zn:9d:jg:tj 5zu:9h:jd:t9 5zv:9d:j0:so 5zw:9h:jd:t9 5zx:9d:j0:so 5zy:9h:jd:t9 5zz:9d:j0:so 600:9g:jr:u2 601:9l:j6:ss 602:9g:jr:u2 603:9l:j6:ss 604:9g:jr:u2 605:9l:j6:ss 606:9g:jr:u2 607:9l:j6:ss 608:9g:jr:u2 609:9l:j6:ss 60c:7u:ik:tb 60d:72:fb:nk 60e:7u:ik:tb 60f:72:fb:nk 60o:9f:kc:v9 60p:9g:j2:sq 60q:9f:kc:v9 60r:9g:j2:sq 60w:ff:to:17y 60x:g3:rt:13j 60y:ff:to:17y 60z:g3:rt:13j 610:ff:to:17y 611:g3:rt:13j 61a:a0:km:v8 61b:a9:ig:qo 61e:6h:gy:rg 61f:6g:fz:pi 61j:72:fb:nk 61q:a4:j0:rw 642:a0:km:v8 643:a9:ig:qo 644:a0:km:v8 645:a9:ig:qo 646:a0:km:v8 647:a9:ig:qo 648:a0:km:v8 649:a9:ig:qo 6br:9d:hs:q7 6bs:4x:7a:9m 6c3:6x:ex:my 6c4:83:hs:rg 6c8:3j:60:8h 6c9:3j:60:8h 6ca:3q:5g:76 6cc:6z:an:ea 6cd:6z:an:ea 6ce:6c:8r:b7 6cg:7c:eh:ln 6ci:51:8k:c3 6cm:ga:lb:qc 6co:2n:78:bt 6cp:2n:78:bt 6cv:1b:3m:5x 6d5:7m:ck:hi 6d6:7n:cl:hj 6dg:3w:7b:ar 6g1:9d:jm:tv 6g3:68:f5:o3 6g4:as:if:q1 6g6:c4:mv:xn 6g7:9e:io:s0 6g9:fj:tq:17y 6gb:9e:jj:tp 6gc:ar:j8:rq 6gd:9p:iq:rr 6gh:9e:io:s0 6gi:8o:if:s6 6gl:9d:jm:tv 6gp:80:gc:on 6gq:9r:hh:p8 6gs:dk:me:v9 6gt:am:jw:t7 6jm:85:ep:l8 6qa:5j:7k:9m 6qd:75:ec:ll'
