import { useRef, useState } from 'react'
import { translate, type AppLocale } from '../../lib/i18n'
import type { ActivityRecordInput } from '../../utils/activityDocument'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'
import { ActivityDateTimeField } from './ActivityDateTimeField'
import { localDateAndTimeToOffsetIso } from './activityDateTime'

function localTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function ActivityComposer({
  locale,
  onSubmit,
}: {
  locale: AppLocale
  onSubmit: (input: Omit<ActivityRecordInput, 'id'>) => void
}) {
  const initialNow = new Date()
  const [content, setContent] = useState('')
  const [occurredDate, setOccurredDate] = useState(initialNow)
  const [occurredTime, setOccurredTime] = useState(localTime(initialNow))
  const [followUpDate, setFollowUpDate] = useState<Date | null>(null)
  const [followUpTime, setFollowUpTime] = useState(localTime(initialNow))
  const contentRef = useRef<HTMLTextAreaElement>(null)

  const submit = () => {
    if (!content.trim()) return

    let occurredAt: string
    let followUpAt: string | null = null
    try {
      occurredAt = localDateAndTimeToOffsetIso(occurredDate, occurredTime)
      followUpAt = followUpDate
        ? localDateAndTimeToOffsetIso(followUpDate, followUpTime)
        : null
    } catch {
      return
    }

    onSubmit({ content, followUpAt, occurredAt, type: 'update' })
    const nextNow = new Date()
    setContent('')
    setOccurredDate(nextNow)
    setOccurredTime(localTime(nextNow))
    setFollowUpDate(null)
    setFollowUpTime(localTime(nextNow))
    contentRef.current?.focus()
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="m-0 text-sm font-semibold">{translate(locale, 'editor.activity.newUpdate')}</h2>
      <div className="mt-3 grid gap-3">
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          {translate(locale, 'editor.activity.contentLabel')}
          <Textarea
            ref={contentRef}
            value={content}
            placeholder={translate(locale, 'editor.activity.contentPlaceholder')}
            onChange={event => setContent(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                submit()
              }
            }}
          />
        </label>
        <ActivityDateTimeField
          date={occurredDate}
          label={translate(locale, 'editor.activity.occurredAt')}
          locale={locale}
          onDateChange={setOccurredDate}
          onTimeChange={setOccurredTime}
          time={occurredTime}
        />
        {followUpDate ? (
          <div className="grid gap-2">
            <ActivityDateTimeField
              date={followUpDate}
              label={translate(locale, 'editor.activity.followUpAt')}
              locale={locale}
              onDateChange={setFollowUpDate}
              onTimeChange={setFollowUpTime}
              time={followUpTime}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="justify-self-start"
              onClick={() => setFollowUpDate(null)}
            >
              {translate(locale, 'editor.activity.clearFollowUp')}
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="justify-self-start"
            onClick={() => {
              const followUpNow = new Date()
              setFollowUpDate(followUpNow)
              setFollowUpTime(localTime(followUpNow))
            }}
          >
            {translate(locale, 'editor.activity.addFollowUp')}
          </Button>
        )}
        <div className="flex justify-end">
          <Button type="button" disabled={!content.trim()} onClick={submit}>
            {translate(locale, 'editor.activity.addUpdate')}
          </Button>
        </div>
      </div>
    </section>
  )
}
