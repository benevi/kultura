// @vitest-environment node
// F-26 — CSV "raros": BOM, comillas, comas y saltos dentro de un campo,
// UTF-8 frente a Windows-1252, ; y tabulador, columnas en otro orden.
import { describe, it, expect } from 'vitest'
import { cleanExcelValue, csvCell, decodeText, detectDelimiter, parseCsvRows, parseCsvTable, pick, toCsv } from '@/lib/import/csv'

describe('parseCsvRows', () => {
  it('comillas RFC 4180: comas, "" y saltos de línea dentro del campo', () => {
    const text = 'Name,Year,Review\r\n"Crouching Tiger, Hidden Dragon",2000,"Dijo ""wow"".\nDos líneas"\r\n'
    expect(parseCsvRows(text)).toEqual([
      ['Name', 'Year', 'Review'],
      ['Crouching Tiger, Hidden Dragon', '2000', 'Dijo "wow".\nDos líneas'],
    ])
  })

  it('CR solo, LF solo, líneas en blanco y última línea sin salto', () => {
    expect(parseCsvRows('a,b\rc,d\n\n\ne,f')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
      ['e', 'f'],
    ])
  })

  it('una comilla en medio de un campo sin comillas es literal y una sin cerrar no lanza', () => {
    expect(parseCsvRows('Name\nThe 12" Single\n"Sin cerrar, sigue')).toEqual([
      ['Name'],
      ['The 12" Single'],
      ['Sin cerrar, sigue'],
    ])
  })

  it('celdas vacías conservan su posición', () => {
    expect(parseCsvRows('a,,c\n,,\n')).toEqual([
      ['a', '', 'c'],
      ['', '', ''],
    ])
  })
})

describe('detectDelimiter', () => {
  it('coma por defecto, punto y coma (Excel en español) y tabulador', () => {
    expect(detectDelimiter('Date,Name,Year')).toBe(',')
    expect(detectDelimiter('Date;Name;Year\n2024;"A, B";2001')).toBe(';')
    expect(detectDelimiter('Date\tName\tYear')).toBe('\t')
    // Comas dentro de comillas en la cabecera no cuentan.
    expect(detectDelimiter('"a,b,c";d;e')).toBe(';')
  })
})

describe('parseCsvTable', () => {
  it('quita el BOM y lee por nombre de columna (cualquier orden, mayúsculas, espacios)', () => {
    const a = parseCsvTable('﻿Date,Name,Year,Letterboxd URI,Rating\n2024-01-02,Dune,2021,https://boxd.it/x,4.5\n')
    const b = parseCsvTable('rating ; YEAR;  name ;letterboxd_uri;date\n4.5;2021;Dune;https://boxd.it/x;2024-01-02\n')
    expect(a.headers).toEqual(['date', 'name', 'year', 'letterboxd uri', 'rating'])
    expect(b.headers).toEqual(['rating', 'year', 'name', 'letterboxd uri', 'date'])
    for (const t of [a, b]) {
      expect(pick(t.records[0], 'name')).toBe('Dune')
      expect(pick(t.records[0], 'rating')).toBe('4.5')
      expect(pick(t.records[0], 'year')).toBe('2021')
    }
  })

  it('cabecera repetida: manda la primera; filas cortas dan vacío', () => {
    const t = parseCsvTable('Title,Title,Year\nA,B\n')
    expect(t.records[0]).toEqual({ title: 'A', year: '' })
  })

  it('valores con forma de fórmula de Excel (ISBN de Goodreads)', () => {
    expect(cleanExcelValue('="9780439023481"')).toBe('9780439023481')
    expect(cleanExcelValue('=""')).toBe('')
    const t = parseCsvTable('Title,ISBN13\nX,"=""9780439023481"""\n')
    expect(pick(t.records[0], 'isbn13')).toBe('9780439023481')
  })
})

describe('decodeText', () => {
  it('UTF-8 con BOM', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('Amélie')])
    expect(decodeText(bytes)).toBe('Amélie')
  })

  it('Windows-1252 (Excel) cuando no es UTF-8 válido', () => {
    // "Amélie" en CP1252: é = 0xE9
    expect(decodeText(new Uint8Array([0x41, 0x6d, 0xe9, 0x6c, 0x69, 0x65]))).toBe('Amélie')
  })

  it('UTF-8 de varios alfabetos', () => {
    const text = '千と千尋の神隠し,Солярис,Ñandú'
    expect(decodeText(new TextEncoder().encode(text))).toBe(text)
  })
})

describe('escritura', () => {
  it('escapa comas, comillas y saltos; CRLF al final', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('di "hola"')).toBe('"di ""hola"""')
    expect(csvCell(null)).toBe('')
    expect(toCsv([['a', 1], ['b,c', true]])).toBe('a,1\r\n"b,c",true\r\n')
  })

  it('lo escrito se vuelve a leer igual', () => {
    const rows = [['Title', 'Review'], ['Crouching Tiger, Hidden Dragon', 'Línea 1\nLínea "2"']]
    expect(parseCsvRows(toCsv(rows))).toEqual(rows)
  })
})
