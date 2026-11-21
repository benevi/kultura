import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import { cn } from '@/lib/utils/index'
import { eyebrow, row, type AccountSettings } from './shared'

type Props = { isDemo: boolean } & Pick<AccountSettings, 'push'>

/**
 * F-33 (MOV-10): notificaciones push de este dispositivo. Sin PUSH_ENABLED,
 * sin claves o sin la migración no se enseña (lo decide quien la monta). El
 * permiso del navegador se pide al pulsar el interruptor, nunca al cargar.
 */
export function PushSection({ isDemo, push }: Props) {
  const tPush = useTranslations('push.settings')

  return (
    <section id="push" className="scroll-mt-20">
      <p className={eyebrow}>{tPush('section')}</p>
      <div className={cn(row, 'flex flex-col gap-3 rounded-bento bg-surface-default')}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1 min-w-0">
            <label htmlFor="push-switch" className="cursor-pointer text-sm font-semibold text-text-primary">
              {tPush('label')}
            </label>
            <p id="push-description" className="text-sm font-body text-text-tertiary">
              {tPush('description')}
            </p>
          </div>
          <input
            id="push-switch"
            type="checkbox"
            role="switch"
            checked={push.state === 'on'}
            aria-describedby="push-description"
            disabled={isDemo || !['on', 'off', 'saving'].includes(push.state)}
            // Mientras se guarda, aria-disabled (no disabled): el foco se queda en el interruptor.
            aria-disabled={push.state === 'saving' || undefined}
            onChange={(e) => {
              if (push.state === 'saving') return
              void (e.target.checked ? push.enable() : push.disable())
            }}
            className="mt-0.5 h-6 w-6 flex-shrink-0 cursor-pointer accent-accent-pink disabled:cursor-not-allowed aria-disabled:cursor-wait"
          />
        </div>
        {isDemo ? (
          <p className="text-sm text-text-tertiary">{tPush('demo')}</p>
        ) : push.state === 'unsupported' || push.state === 'ios_install' || push.state === 'denied' ? (
          <p className="text-sm text-text-tertiary">
            {push.state === 'unsupported'
              ? tPush('unsupported')
              : push.state === 'ios_install'
                ? tPush('iosInstall')
                : tPush('denied')}
          </p>
        ) : null}
        <p role="status" className="min-h-5 text-xs text-text-tertiary">
          {push.state === 'saving'
            ? tPush('saving')
            : push.notice === 'allOff'
              ? tPush('allOff')
              : push.notice === 'dismissed'
                ? tPush('dismissed')
                : push.state === 'on'
                  ? tPush('on')
                  : push.state === 'off'
                    ? tPush('off')
                    : ''}
        </p>
        {push.notice === 'error' && (
          <p role="alert" className="text-sm text-accent-danger">
            {tPush('error')}
          </p>
        )}
        {!isDemo && push.otherDevices > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-text-tertiary">{tPush('otherDevices', { count: push.otherDevices })}</p>
            <KButton
              variant="secondary"
              size="sm"
              className="flex-shrink-0"
              onClick={() => {
                if (push.state !== 'saving') void push.disable(true)
              }}
              aria-disabled={push.state === 'saving' || undefined}
            >
              {tPush('disableAll')}
            </KButton>
          </div>
        )}
      </div>
    </section>
  )
}
