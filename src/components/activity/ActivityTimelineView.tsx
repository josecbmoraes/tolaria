import { WarningCircle } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { getLocaleDateLocale, translate, type AppLocale } from '../../lib/i18n'
import { parseActivityDocument, type ActivityRecord } from '../../utils/activityDocument'
import {
  appendActivityRecord,
  deleteActivityRecord,
  type ActivityRecordInput,
  updateActivityRecord,
} from '../../utils/activityDocumentMutations'
import { Button } from '../ui/button'
import { MarkdownContent } from '../MarkdownContent'
import { ActivityComposer } from './ActivityComposer'
import { ActivityRecordDialog } from './ActivityRecordDialog'

export type ActivityTimelineViewProps = {
  content: string
  locale: AppLocale
  pendingEditId: string | null
  onPendingEditHandled: () => void
  onContentChange: (nextContent: string) => void
  onOpenRaw: () => void
  onSave?: () => void
}

function compareVisualOrder(left: ActivityRecord, right: ActivityRecord): number {
  const leftTime = Date.parse(left.occurredAt ?? '')
  const rightTime = Date.parse(right.occurredAt ?? '')
  const timeDelta = rightTime - leftTime

  return Number.isNaN(timeDelta) || timeDelta === 0
    ? left.start - right.start
    : timeDelta
}

function formatOccurredAt(value: string, locale: AppLocale): string {
  return new Intl.DateTimeFormat(getLocaleDateLocale(locale), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function ActivityRecordWarning({
  locale,
  onOpenRaw,
  record,
}: {
  locale: AppLocale
  onOpenRaw: () => void
  record: ActivityRecord
}) {
  const title = record.valid
    ? translate(locale, 'editor.activity.unknownType', { type: record.type })
    : translate(locale, 'editor.activity.malformedTitle')

  return (
    <article
      data-testid="activity-record-warning"
      className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3"
    >
      <div className="flex items-start gap-2">
        <WarningCircle aria-hidden="true" className="mt-0.5 shrink-0 text-amber-600" size={18} />
        <div className="min-w-0 flex-1">
          <p className="m-0 text-sm font-medium">{title}</p>
          <p className="m-0 mt-1 text-xs text-muted-foreground">
            {translate(locale, 'editor.activity.malformedRawOnly')}
          </p>
          {record.content && (
            <div className="mt-2 text-sm">
              <MarkdownContent content={record.content} />
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onOpenRaw}>
          {translate(locale, 'editor.activity.editInRaw')}
        </Button>
      </div>
    </article>
  )
}

export function ActivityTimelineView({
  content,
  locale,
  onContentChange,
  onOpenRaw,
  onPendingEditHandled,
  onSave,
  pendingEditId,
}: ActivityTimelineViewProps) {
  const activity = useMemo(() => {
    const parsed = parseActivityDocument(content)
    return {
      documentIssues: parsed.issues,
      records: parsed.records.filter(record => record.editable).sort(compareVisualOrder),
      warnings: parsed.records.filter(record => !record.editable).sort((left, right) => left.start - right.start),
    }
  }, [content])
  const [editingId, setEditingId] = useState<string | null>(() => (
    pendingEditId && activity.records.some(record => record.id === pendingEditId)
      ? pendingEditId
      : null
  ))
  const editingRecord = activity.records.find(record => record.id === editingId) ?? null

  useEffect(() => {
    if (!pendingEditId) return
    onPendingEditHandled()
  }, [onPendingEditHandled, pendingEditId])

  const commitContent = (nextContent: string) => {
    onContentChange(nextContent)
    onSave?.()
  }
  const createRecord = (input: Omit<ActivityRecordInput, 'id'>) => {
    const nextContent = appendActivityRecord(content, {
      ...input,
      id: crypto.randomUUID(),
    })
    commitContent(nextContent)
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-6 py-5">
      <ActivityComposer locale={locale} onSubmit={createRecord} />
      {activity.records.length === 0
        && activity.warnings.length === 0
        && activity.documentIssues.length === 0 && (
        <section className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
          <h2 className="m-0 text-sm font-semibold">
            {translate(locale, 'editor.activity.emptyTitle')}
          </h2>
          <p className="m-0 mt-1 text-sm text-muted-foreground">
            {translate(locale, 'editor.activity.emptyDescription')}
          </p>
        </section>
      )}
      {activity.records.map(record => (
        <article
          key={record.key}
          data-testid="activity-record-card"
          className="rounded-lg border border-border bg-card px-4 py-3"
        >
          <time className="text-xs text-muted-foreground" dateTime={record.occurredAt ?? undefined}>
            {formatOccurredAt(record.occurredAt ?? '', locale)}
          </time>
          <div className="mt-2 text-sm">
            <MarkdownContent content={record.content} preserveLineBreaks />
          </div>
          {record.followUpAt && (
            <p className="m-0 mt-2 text-xs text-muted-foreground">
              {translate(locale, 'editor.activity.followUp')}
              {' · '}
              {formatOccurredAt(record.followUpAt, locale)}
            </p>
          )}
          <div className="mt-2 flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditingId(record.id)}>
              {translate(locale, 'editor.activity.editUpdate')}
            </Button>
          </div>
        </article>
      ))}
      {activity.warnings.map(record => (
        <ActivityRecordWarning
          key={record.key}
          locale={locale}
          onOpenRaw={onOpenRaw}
          record={record}
        />
      ))}
      {activity.documentIssues.length > 0 && (
        <article
          data-testid="activity-document-warning"
          className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3"
        >
          <p className="m-0 text-sm font-medium">
            {translate(locale, 'editor.activity.malformedTitle')}
          </p>
          <p className="m-0 mt-1 text-xs text-muted-foreground">
            {translate(locale, 'editor.activity.malformedRawOnly')}
          </p>
          <div className="mt-2 flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={onOpenRaw}>
              {translate(locale, 'editor.activity.editInRaw')}
            </Button>
          </div>
        </article>
      )}
      {editingRecord && (
        <ActivityRecordDialog
          key={editingRecord.key}
          locale={locale}
          open
          record={editingRecord}
          onOpenChange={(open) => {
            if (!open) setEditingId(null)
          }}
          onSave={(patch) => {
            if (!editingRecord.id) return
            commitContent(updateActivityRecord(content, editingRecord.id, patch))
            setEditingId(null)
          }}
          onDelete={() => {
            if (!editingRecord.id) return
            commitContent(deleteActivityRecord(content, editingRecord.id))
            setEditingId(null)
          }}
        />
      )}
    </div>
  )
}
