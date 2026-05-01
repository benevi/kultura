import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EpisodeProgress } from '@/components/library/EpisodeProgress'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      season: 'Temporada',
      episode: 'Episodio',
      clearProgress: 'Limpiar progreso',
    }
    return map[key] ?? key
  },
}))

describe('EpisodeProgress', () => {
  it('does not render season input when showSeason=false', () => {
    render(
      <EpisodeProgress value={null} onChange={() => {}} showSeason={false} />
    )
    expect(screen.queryByTestId('input-season')).toBeNull()
    expect(screen.getByTestId('input-episode')).toBeDefined()
  })

  it('renders season input when showSeason=true', () => {
    render(
      <EpisodeProgress value={null} onChange={() => {}} showSeason={true} />
    )
    expect(screen.getByTestId('input-season')).toBeDefined()
    expect(screen.getByTestId('input-episode')).toBeDefined()
  })

  it('does not show clear button when value=null', () => {
    render(
      <EpisodeProgress value={null} onChange={() => {}} showSeason={false} />
    )
    expect(screen.queryByTestId('clear-progress')).toBeNull()
  })

  it('shows clear button when value has episode', () => {
    render(
      <EpisodeProgress value={{ episode: 5 }} onChange={() => {}} showSeason={false} />
    )
    expect(screen.getByTestId('clear-progress')).toBeDefined()
  })

  it('calls onChange(null) when clear button clicked', () => {
    const onChange = vi.fn()
    render(
      <EpisodeProgress value={{ episode: 5 }} onChange={onChange} showSeason={false} />
    )
    fireEvent.click(screen.getByTestId('clear-progress'))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('calls onChange with episode when episode input changes', () => {
    const onChange = vi.fn()
    render(
      <EpisodeProgress value={null} onChange={onChange} showSeason={false} />
    )
    fireEvent.change(screen.getByTestId('input-episode'), { target: { value: '7' } })
    expect(onChange).toHaveBeenCalledWith({ season: undefined, episode: 7 })
  })

  it('calls onChange with season when season input changes and episode exists', () => {
    const onChange = vi.fn()
    render(
      <EpisodeProgress value={{ episode: 3 }} onChange={onChange} showSeason={true} />
    )
    fireEvent.change(screen.getByTestId('input-season'), { target: { value: '2' } })
    expect(onChange).toHaveBeenCalledWith({ season: 2, episode: 3 })
  })

  it('does not call onChange when episode input is empty', () => {
    const onChange = vi.fn()
    render(
      <EpisodeProgress value={{ episode: 5 }} onChange={onChange} showSeason={false} />
    )
    fireEvent.change(screen.getByTestId('input-episode'), { target: { value: '' } })
    expect(onChange).not.toHaveBeenCalled()
  })
})
