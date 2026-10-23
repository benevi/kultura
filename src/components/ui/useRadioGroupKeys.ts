'use client'

import { useRef, type KeyboardEvent } from 'react'

/**
 * Teclado del patrón ARIA `radiogroup` (ACC-10): una sola parada de Tab (la
 * opción marcada o, si no hay, la primera), y las flechas ←/→/↑/↓, Inicio y
 * Fin mueven la selección y el foco a la vez. Lo comparten `SegmentedControl`,
 * `AvatarIconPicker`, `StarRating` y los selectores de Ajustes.
 *
 * Uso: `const { getItemProps } = useRadioGroupKeys(values, value, onChange)` y
 * en cada opción `{...getItemProps(optionValue, index)}`.
 */
export function useRadioGroupKeys<T>(
  values: readonly T[],
  selected: T | null | undefined,
  onSelect: (value: T) => void,
  options: { disabled?: boolean } = {}
) {
  const refs = useRef<Array<HTMLElement | null>>([])
  const selectedIndex = values.findIndex((v) => v === selected)
  const tabStop = selectedIndex >= 0 ? selectedIndex : 0

  function move(from: number, to: number) {
    const count = values.length
    if (count === 0) return
    const next = ((to % count) + count) % count
    if (next === from && values[next] === selected) return
    onSelect(values[next])
    refs.current[next]?.focus()
  }

  function onKeyDown(index: number) {
    return (e: KeyboardEvent<HTMLElement>) => {
      if (options.disabled) return
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault()
          move(index, index + 1)
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault()
          move(index, index - 1)
          break
        case 'Home':
          e.preventDefault()
          move(index, 0)
          break
        case 'End':
          e.preventDefault()
          move(index, values.length - 1)
          break
        case ' ':
          e.preventDefault()
          onSelect(values[index])
          break
      }
    }
  }

  function getItemProps(value: T, index: number) {
    const checked = value === selected
    return {
      ref: (el: HTMLElement | null) => {
        refs.current[index] = el
      },
      role: 'radio' as const,
      'aria-checked': checked,
      tabIndex: index === tabStop ? 0 : -1,
      onKeyDown: onKeyDown(index),
    }
  }

  return { getItemProps }
}
