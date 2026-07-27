import type { ReactNode } from 'react'
import {
  ActivityRecordNavigationContext,
  type ActivityRecordNavigation,
} from './ActivityRecordNavigationContext'

export function ActivityRecordNavigationProvider({
  value,
  children,
}: {
  value: ActivityRecordNavigation
  children: ReactNode
}) {
  return (
    <ActivityRecordNavigationContext.Provider value={value}>
      {children}
    </ActivityRecordNavigationContext.Provider>
  )
}
