import { WarningCircle } from '@phosphor-icons/react'
import { getLocaleDateLocale, translate } from '../../lib/i18n'
import { Button } from '../ui/button'
import { MarkdownContent } from '../MarkdownContent'
import { useActivityRecordNavigation } from './ActivityRecordNavigationContext'

export type LineRecordBlockProps = {
  block: {
    props: {
      source: string
      id: string
      recordType: string
      occurredAt: string
      followUpAt: string
      body: string
      valid: string
      editable: string
      errors: string
    }
  }
}

function parsedErrors(value: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) && parsed.every(item => typeof item === 'string') ? parsed : null
  } catch {
    return null
  }
}

function formattedDateTime(value: string, locale: Parameters<typeof getLocaleDateLocale>[0]): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value
  return new Intl.DateTimeFormat(getLocaleDateLocale(locale), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function WarningContent({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <WarningCircle aria-hidden="true" className="mt-0.5 shrink-0 text-amber-600" size={16} />
      <div className="min-w-0">
        <p className="m-0 text-sm font-medium text-foreground">{title}</p>
        <p className="m-0 mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

export function LineRecordBlock({ block }: LineRecordBlockProps) {
  const { editInTimeline, locale, openRaw } = useActivityRecordNavigation()
  const props = block.props
  const errors = parsedErrors(props.errors)
  const malformed = props.valid !== 'true' || errors === null
  const supported = props.recordType === 'update' && props.editable === 'true'

  return (
    <article
      className="my-1 w-full rounded-lg border border-border/70 bg-muted/25 px-3 py-2"
      contentEditable={false}
      data-line-record-id={props.id || undefined}
    >
      {malformed ? (
        <WarningContent
          title={translate(locale, 'editor.activity.malformedTitle')}
          description={translate(locale, 'editor.activity.malformedRawOnly')}
        />
      ) : !supported ? (
        <WarningContent
          title={translate(locale, 'editor.activity.unknownType', { type: props.recordType })}
          description={translate(locale, 'editor.activity.malformedRawOnly')}
        />
      ) : (
        <>
          <time
            className="block text-xs font-medium tabular-nums text-muted-foreground"
            data-testid="line-record-occurred-at"
            dateTime={props.occurredAt}
          >
            {formattedDateTime(props.occurredAt, locale)}
          </time>
          <div className="mt-1 text-sm text-foreground">
            <MarkdownContent content={props.body} />
          </div>
          {props.followUpAt && (
            <p className="m-0 mt-1 text-xs text-muted-foreground">
              <span className="font-medium">{translate(locale, 'editor.activity.followUp')}</span>
              {' · '}
              <time dateTime={props.followUpAt}>{formattedDateTime(props.followUpAt, locale)}</time>
            </p>
          )}
        </>
      )}
      <div className="mt-1.5 flex justify-end">
        {malformed || !supported ? (
          <Button type="button" variant="ghost" size="sm" onClick={openRaw}>
            {translate(locale, 'editor.activity.editInRaw')}
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editInTimeline(props.id)}
          >
            {translate(locale, 'editor.activity.editInTimeline')}
          </Button>
        )}
      </div>
    </article>
  )
}
