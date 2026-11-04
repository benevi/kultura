"""Pruebas de las partes puras de build.py (sin red ni modelo).
Ejecutar: python -m unittest scripts/landing-media/test_build.py"""
import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import build  # noqa: E402


def depth_with_figure(fig_w=0.35, fig_h=0.7, top=0.2):
    d = np.full((100, 160), 0.1)
    x0 = int(160 * (0.5 - fig_w / 2))
    d[int(100 * top): int(100 * (top + fig_h)), x0: x0 + int(160 * fig_w)] = 0.9
    return d


class AnalyseTest(unittest.TestCase):
    rgb = np.zeros((100, 160, 3), dtype=np.uint8)

    def test_otsu_separa_dos_niveles(self):
        th = build.otsu(depth_with_figure())
        self.assertGreater(th, 0.1)
        self.assertLess(th, 0.9)

    def test_figura_mediana_admite_capas(self):
        a = build.analyse(depth_with_figure(), self.rgb)
        self.assertTrue(a.layered)
        self.assertAlmostEqual(a.focus[0], 0.5, delta=0.05)

    def test_figura_que_lo_llena_todo_no_admite_capas(self):
        a = build.analyse(depth_with_figure(fig_w=0.95, fig_h=0.9, top=0.05), self.rgb)
        self.assertFalse(a.layered)

    def test_figura_pequena_no_admite_capas(self):
        a = build.analyse(depth_with_figure(fig_w=0.12, fig_h=0.5, top=0.25), self.rgb)
        self.assertLess(a.fg_ratio, build.FG_LAYER_MIN)
        self.assertFalse(a.layered)

    def test_sin_primer_plano_no_admite_capas(self):
        a = build.analyse(np.full((100, 160), 0.3), self.rgb)
        self.assertFalse(a.layered)


class CalidadTest(unittest.TestCase):
    def test_pide_la_version_grande(self):
        self.assertEqual(build.hires("https://image.tmdb.org/t/p/w500/a.jpg"), "https://image.tmdb.org/t/p/original/a.jpg")
        self.assertEqual(build.hires("https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx1-a.jpg"),
                         "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1-a.jpg")
        self.assertEqual(build.hires("https://covers.openlibrary.org/b/id/7-M.jpg"), "https://covers.openlibrary.org/b/id/7-L.jpg")
        self.assertEqual(build.hires("https://uploads.mangadex.org/covers/x/y.jpg.512.jpg"), "https://uploads.mangadex.org/covers/x/y.jpg")
        self.assertEqual(build.hires("https://media.rawg.io/media/games/a.jpg"), "https://media.rawg.io/media/games/a.jpg")

    def test_fondo_blanco_liso(self):
        white = np.full((900, 600, 3), 250, dtype=np.uint8)
        white[600:, :] = np.random.default_rng(0).integers(0, 255, (300, 600, 3))
        self.assertTrue(build.too_flat(white))
        busy = np.random.default_rng(1).integers(0, 255, (900, 600, 3)).astype(np.uint8)
        self.assertFalse(build.too_flat(busy))
        self.assertFalse(build.too_flat(np.full((900, 600, 3), 10, dtype=np.uint8)))  # fondo oscuro: vale

    def test_descarta_pequenas(self):
        self.assertIn("pequeña", build.reject_reason(np.full((325, 230, 3), 90, dtype=np.uint8), True))

    def test_id_numerico(self):
        mk = lambda ext: build.Pick("feature", 0, "movie", ext, "t", "u")
        self.assertEqual(build.numeric_id(mk("movie_123")), "123")
        self.assertEqual(build.numeric_id(mk("456")), "456")
        self.assertIsNone(build.numeric_id(mk("anime_al-1")))


class SeleccionTest(unittest.TestCase):
    def p(self, title, url, fmt="movie"):
        return build.Pick("feature", 0, fmt, title, title, url, format=fmt)

    def test_no_repite_imagen_ni_titulo(self):
        out = build.unique_by_url([self.p("A", "u1"), self.p("A", "u2"), self.p("B", "u1"), self.p("C", "u3")])
        self.assertEqual([x.title for x in out], ["A", "C"])

    def test_alterna_formatos(self):
        items = [self.p("a1", "1", "anime"), self.p("a2", "2", "anime"), self.p("m1", "3", "movie")]
        self.assertEqual([x.format for x in build.interleave_by_format(items)], ["anime", "movie", "anime"])

    def test_prefiere_escenas_con_capas(self):
        mk = lambda layered, ratio: build.Analysis(0.5, ratio, (0.5, 0.4), layered, "#fff")
        cands = [(self.p("x", "1"), mk(False, 0.22)), (self.p("y", "2"), mk(True, 0.40)), (self.p("z", "3"), mk(True, 0.20))]
        self.assertEqual([c[0].title for c in build.choose_scenes(cands, 2)], ["z", "y"])

    def test_recorte_vertical(self):
        self.assertEqual(build.to_portrait(np.zeros((90, 160, 3), dtype=np.uint8)).shape[:2], (90, 60))


if __name__ == "__main__":
    unittest.main()
