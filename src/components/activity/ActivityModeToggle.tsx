import { translate, type AppLocale } from '../../lib/i18n'
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group'
import type { ActivitySurfaceMode } from './useActivityMode'

export function ActivityModeToggle({
  locale,
  mode,
  onSelect,
}: {
  locale: AppLocale
  mode: ActivitySurfaceMode
  onSelect: (mode: ActivitySurfaceMode) => void
}) {
  return (
    <ToggleGroup
      aria-label={`${translate(locale, 'editor.activity.noteMode')} / ${translate(locale, 'editor.activity.timelineMode')}`}
      type="single"
      value={mode}
      onValueChange={(value) => {
        if (value === 'note' || value === 'timeline') onSelect(value)
      }}
    >
      <ToggleGroupItem
        aria-checked={mode === 'note'}
        aria-label={translate(locale, 'editor.activity.noteMode')}
        role="radio"
        value="note"
      >
        {translate(locale, 'editor.activity.noteMode')}
      </ToggleGroupItem>
      <ToggleGroupItem
        aria-checked={mode === 'timeline'}
        aria-label={translate(locale, 'editor.activity.timelineMode')}
        role="radio"
        value="timeline"
      >
        {translate(locale, 'editor.activity.timelineMode')}
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
