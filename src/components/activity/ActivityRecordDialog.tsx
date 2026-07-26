import { useId, useState } from 'react'
import { translate, type AppLocale } from '../../lib/i18n'
import type { ActivityRecord } from '../../utils/activityDocument'
import type { ActivityRecordPatch } from '../../utils/activityDocumentMutations'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Textarea } from '../ui/textarea'
import { ActivityDateTimeField } from './ActivityDateTimeField'
import {
  localDateAndTimeToOffsetIso,
  offsetIsoToLocalDateAndTime,
} from './activityDateTime'

type ActivityRecordDraft = {
  content: string
  occurredDate: Date
  occurredTime: string
  followUpDate: Date | null
  followUpTime: string
}

function draftFromRecord(record: ActivityRecord): ActivityRecordDraft {
  const occurred = offsetIsoToLocalDateAndTime(record.occurredAt ?? '')
  const followUp = record.followUpAt
    ? offsetIsoToLocalDateAndTime(record.followUpAt)
    : null

  return {
    content: record.content.replace(/\r?\n$/u, ''),
    occurredDate: occurred.date,
    occurredTime: occurred.time,
    followUpDate: followUp?.date ?? null,
    followUpTime: followUp?.time ?? occurred.time,
  }
}

export function ActivityRecordDialog({
  locale,
  onDelete,
  onOpenChange,
  onSave,
  open,
  record,
}: {
  locale: AppLocale
  onDelete: () => void
  onOpenChange: (open: boolean) => void
  onSave: (patch: ActivityRecordPatch) => void
  open: boolean
  record: ActivityRecord
}) {
  const [draft, setDraft] = useState<ActivityRecordDraft>(() => draftFromRecord(record))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const contentId = useId()

  const save = () => {
    if (!draft.content.trim()) return
    try {
      onSave({
        content: draft.content,
        occurredAt: localDateAndTimeToOffsetIso(draft.occurredDate, draft.occurredTime),
        followUpAt: draft.followUpDate
          ? localDateAndTimeToOffsetIso(draft.followUpDate, draft.followUpTime)
          : null,
        type: 'update',
      })
    } catch {
      return
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{translate(locale, 'editor.activity.editUpdate')}</DialogTitle>
            <DialogDescription>
              {translate(locale, 'editor.activity.editDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <label htmlFor={contentId} className="grid gap-1 text-xs font-medium text-muted-foreground">
              {translate(locale, 'editor.activity.contentLabel')}
              <Textarea
                id={contentId}
                value={draft.content}
                onChange={event => setDraft(current => ({ ...current, content: event.target.value }))}
              />
            </label>
            <ActivityDateTimeField
              date={draft.occurredDate}
              label={translate(locale, 'editor.activity.occurredAt')}
              locale={locale}
              onDateChange={occurredDate => setDraft(current => ({ ...current, occurredDate }))}
              onTimeChange={occurredTime => setDraft(current => ({ ...current, occurredTime }))}
              time={draft.occurredTime}
            />
            {draft.followUpDate ? (
              <div className="grid gap-2">
                <ActivityDateTimeField
                  date={draft.followUpDate}
                  label={translate(locale, 'editor.activity.followUpAt')}
                  locale={locale}
                  onDateChange={followUpDate => setDraft(current => ({ ...current, followUpDate }))}
                  onTimeChange={followUpTime => setDraft(current => ({ ...current, followUpTime }))}
                  time={draft.followUpTime}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-self-start"
                  onClick={() => setDraft(current => ({ ...current, followUpDate: null }))}
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
                onClick={() => setDraft(current => ({
                  ...current,
                  followUpDate: current.occurredDate,
                  followUpTime: current.occurredTime,
                }))}
              >
                {translate(locale, 'editor.activity.addFollowUp')}
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>
              {translate(locale, 'editor.activity.deleteUpdate')}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {translate(locale, 'common.cancel')}
            </Button>
            <Button type="button" disabled={!draft.content.trim()} onClick={save}>
              {translate(locale, 'common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{translate(locale, 'editor.activity.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {translate(locale, 'editor.activity.deleteConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline">{translate(locale, 'common.cancel')}</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button type="button" variant="destructive" onClick={onDelete}>
                {translate(locale, 'common.remove')}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
