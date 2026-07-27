import { WarningCircle } from '@phosphor-icons/react'
import { Component, type ReactNode } from 'react'
import { translate, type AppLocale } from '../../lib/i18n'
import { Button } from '../ui/button'

type ActivityTimelineErrorBoundaryProps = {
  children: ReactNode
  locale: AppLocale
  onOpenRaw: () => void
  onReturnToNote: () => void
}

export class ActivityTimelineErrorBoundary extends Component<
  ActivityTimelineErrorBoundaryProps,
  { error: unknown }
> {
  state: { error: unknown } = { error: null }

  static getDerivedStateFromError(error: unknown) {
    return { error }
  }

  private returnToNote = () => {
    this.setState({ error: null })
    this.props.onReturnToNote()
  }

  private openRaw = () => {
    this.setState({ error: null })
    this.props.onOpenRaw()
  }

  render() {
    if (!this.state.error) return this.props.children

    const { locale } = this.props
    return (
      <section className="m-auto flex max-w-md flex-col items-center gap-3 px-6 text-center">
        <WarningCircle aria-hidden="true" className="text-amber-600" size={28} />
        <h2 className="m-0 text-base font-semibold">
          {translate(locale, 'editor.activity.timelineErrorTitle')}
        </h2>
        <p className="m-0 text-sm text-muted-foreground">
          {translate(locale, 'editor.activity.timelineErrorDescription')}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" onClick={this.returnToNote}>
            {translate(locale, 'editor.activity.returnToNote')}
          </Button>
          <Button type="button" variant="ghost" onClick={this.openRaw}>
            {translate(locale, 'editor.activity.editInRaw')}
          </Button>
        </div>
      </section>
    )
  }
}
