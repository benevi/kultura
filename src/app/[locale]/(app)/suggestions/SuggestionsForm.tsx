'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'

export function SuggestionsForm() {
  const t = useTranslations('suggestions')
  const [type, setType] = useState<'bug' | 'feature' | 'improvement' | 'other'>('feature')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [errorKey, setErrorKey] = useState<string>('error')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const s = subject.trim()
    const d = description.trim()
    if (s.length < 3 || d.length < 10) {
      setErrorKey('errorTooShort')
      setStatus('error')
      return
    }
    setStatus('sending')
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, subject: s, description: d }),
      })
      if (!res.ok) {
        setErrorKey(res.status === 429 ? 'errorRateLimit' : 'error')
        setStatus('error')
        return
      }
      setStatus('success')
    } catch {
      setErrorKey('error')
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="p-4 text-center flex flex-col items-center gap-3">
        <div className="text-4xl">✅</div>
        <p className="font-display font-extrabold text-text-primary text-lg">{t('success')}</p>
        <p className="text-sm text-text-tertiary">{t('successHint')}</p>
        <button
          onClick={() => { setStatus('idle'); setSubject(''); setDescription('') }}
          className="rounded-pill bg-surface-elevated px-4 py-2 text-sm font-bold text-accent-pink mt-2 hover:brightness-110 transition-all"
        >
          {t('newFeedback')}
        </button>
      </div>
    )
  }

  // Mismo orden y emojis que el mockup F0 de Sugerencias.
  const typeOptions: Array<{ value: typeof type; label: string; emoji: string }> = [
    { value: 'bug', label: t('typeBug'), emoji: '🐛' },
    { value: 'feature', label: t('typeFeature'), emoji: '✨' },
    { value: 'improvement', label: t('typeImprovement'), emoji: '🔧' },
    { value: 'other', label: t('typeOther'), emoji: '💬' },
  ]

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Type */}
      <div>
        <label className="block text-[13px] font-bold text-text-tertiary mb-2">{t('typeLabel')}</label>
        <div className="flex flex-wrap gap-2.5">
          {typeOptions.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setType(opt.value)}
              aria-pressed={type === opt.value}
              className={`inline-flex items-center gap-1.5 px-4 py-[9px] rounded-pill text-[13px] font-bold transition-all ${
                type === opt.value
                  ? 'bg-accent-pink text-on-accent-pink'
                  : 'bg-surface-elevated text-text-primary hover:brightness-110'
              }`}
            >
              <span aria-hidden="true">{opt.emoji}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Subject */}
      <div>
        <label className="block text-[13px] font-bold text-text-tertiary mb-2">
          {t('subjectLabel')}
        </label>
        <input
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder={t('subjectPlaceholder')}
          maxLength={120}
          required
          className="w-full bg-surface-elevated rounded-[14px] px-[18px] py-[15px] text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent-pink"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-[13px] font-bold text-text-tertiary mb-2">
          {t('descriptionLabel')}
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder={t('descriptionPlaceholder')}
          maxLength={2000}
          rows={5}
          required
          className="w-full bg-surface-elevated rounded-[14px] px-[18px] py-[15px] text-sm text-text-primary placeholder-text-tertiary resize-none focus:outline-none focus:ring-2 focus:ring-accent-pink"
        />
        <p className="text-xs text-text-tertiary mt-1 text-right">{description.length}/2000</p>
      </div>

      {status === 'error' && (
        <p className="text-sm text-accent-danger">{t(errorKey)}</p>
      )}

      <KButton
        type="submit"
        variant="primary"
        size="lg"
        loading={status === 'sending'}
        className="self-start"
      >
        {status === 'sending' ? t('submitting') : t('submit')}
      </KButton>
    </form>
  )
}
