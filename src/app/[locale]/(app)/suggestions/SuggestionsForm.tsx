'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

export function SuggestionsForm() {
  const t = useTranslations('suggestions')
  const [type, setType] = useState<'bug' | 'feature' | 'improvement' | 'other'>('feature')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, subject, description }),
      })
      if (!res.ok) throw new Error()
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="bg-surface border border-border rounded-xl p-10 text-center flex flex-col gap-3">
        <div className="text-4xl">✅</div>
        <p className="font-semibold text-text text-lg">{t('success')}</p>
        <p className="text-sm text-muted">{t('successHint')}</p>
        <button
          onClick={() => { setStatus('idle'); setSubject(''); setDescription('') }}
          className="mx-auto mt-2 px-4 py-2 text-sm font-medium text-accent hover:underline"
        >
          {t('newFeedback')}
        </button>
      </div>
    )
  }

  const typeOptions: Array<{ value: typeof type; label: string }> = [
    { value: 'feature', label: t('typeFeature') },
    { value: 'improvement', label: t('typeImprovement') },
    { value: 'bug', label: t('typeBug') },
    { value: 'other', label: t('typeOther') },
  ]

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Type */}
      <div>
        <label className="block text-sm font-medium text-text mb-2">{t('typeLabel')}</label>
        <div className="flex flex-wrap gap-2">
          {typeOptions.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setType(opt.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                type === opt.value
                  ? 'bg-accent text-white border-accent'
                  : 'bg-surface border-border text-muted hover:text-text hover:border-muted'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Subject */}
      <div>
        <label className="block text-sm font-medium text-text mb-2">
          {t('subjectLabel')}
        </label>
        <input
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder={t('subjectPlaceholder')}
          maxLength={120}
          required
          className="w-full bg-surface2 border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-text mb-2">
          {t('descriptionLabel')}
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder={t('descriptionPlaceholder')}
          maxLength={2000}
          rows={5}
          required
          className="w-full bg-surface2 border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder-muted resize-none focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <p className="text-xs text-muted mt-1 text-right">{description.length}/2000</p>
      </div>

      {status === 'error' && (
        <p className="text-sm text-red-400">{t('error')}</p>
      )}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full py-3 text-sm font-semibold bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors"
      >
        {status === 'sending' ? t('submitting') : t('submit')}
      </button>
    </form>
  )
}
