import { createContext, useContext } from 'react'
import type { AppLocale } from '../../lib/i18n'

export type ActivityRecordNavigation = {
  editInTimeline: (recordId: string) => void
  openRaw: () => void
  locale: AppLocale
}

const defaultNavigation: ActivityRecordNavigation = {
  editInTimeline: () => {},
  openRaw: () => {},
  locale: 'en',
}

export const ActivityRecordNavigationContext = createContext(defaultNavigation)

export function useActivityRecordNavigation(): ActivityRecordNavigation {
  return useContext(ActivityRecordNavigationContext)
}
