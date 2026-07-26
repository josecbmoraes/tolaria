import { CalendarBlank } from '@phosphor-icons/react'
import { getLocaleDateLocale, type AppLocale } from '../../lib/i18n'
import { Button } from '../ui/button'
import { Calendar } from '../ui/calendar'
import { Input } from '../ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

export function ActivityDateTimeField({
  date,
  label,
  locale,
  onDateChange,
  onTimeChange,
  time,
}: {
  date: Date
  label: string
  locale: AppLocale
  onDateChange: (date: Date) => void
  onTimeChange: (time: string) => void
  time: string
}) {
  const formattedDate = new Intl.DateTimeFormat(getLocaleDateLocale(locale), {
    dateStyle: 'medium',
  }).format(date)

  return (
    <fieldset className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem]">
      <legend className="mb-1 text-xs font-medium text-muted-foreground">{label}</legend>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="justify-start font-normal">
            <CalendarBlank aria-hidden="true" size={16} />
            {formattedDate}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            defaultMonth={date}
            onSelect={(selected) => {
              if (selected) onDateChange(selected)
            }}
          />
        </PopoverContent>
      </Popover>
      <Input
        aria-label={`${label} time`}
        inputMode="numeric"
        pattern="[0-9]{2}:[0-9]{2}"
        value={time}
        onChange={event => onTimeChange(event.target.value)}
      />
    </fieldset>
  )
}
