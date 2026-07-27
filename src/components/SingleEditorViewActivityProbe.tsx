import { useActivityRecordNavigation } from './activity/ActivityRecordNavigationContext'

export function SingleEditorViewActivityProbe() {
  const navigation = useActivityRecordNavigation()

  return (
    <div data-testid="activity-navigation-probe" data-locale={navigation.locale}>
      <button type="button" onClick={() => navigation.editInTimeline('record-1')}>
        Edit activity record
      </button>
      <button type="button" onClick={navigation.openRaw}>
        Open activity RAW
      </button>
    </div>
  )
}
