import { useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLang } from '@/contexts/langContext';

interface DateRangeCalendarProps {
  from?: Date;
  to?: Date;
  onSelect?: (range: { from?: Date; to?: Date }) => void;
  className?: string;
}

export function DateRangeCalendar({ from, to, onSelect, className }: DateRangeCalendarProps) {
  const { t } = useLang();
  const [currentMonth, setCurrentMonth] = useState(from ?? new Date());
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  // Fully controlled: the caller holds the range and passes it back down.
  const selection = { from, to };

  const daysInMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    0,
  ).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  const monthName = currentMonth.toLocaleString('el-GR', { month: 'long', year: 'numeric' });

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentMonth.getMonth() === today.getMonth() &&
      currentMonth.getFullYear() === today.getFullYear()
    );
  };

  const normalizeDate = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);

  const isStartDate = (day: number) => {
    if (!selection.from) return false;
    const from = normalizeDate(selection.from);
    return (
      day === from.getDate() &&
      currentMonth.getMonth() === from.getMonth() &&
      currentMonth.getFullYear() === from.getFullYear()
    );
  };

  const isEndDate = (day: number) => {
    if (!selection.to) return false;
    const to = normalizeDate(selection.to);
    return (
      day === to.getDate() &&
      currentMonth.getMonth() === to.getMonth() &&
      currentMonth.getFullYear() === to.getFullYear()
    );
  };

  const isInRange = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day, 12, 0, 0);
    const start = selection.from;
    const end = selection.to || hoverDate;

    if (!start) return false;
    if (!end && !hoverDate) return false;

    const effectiveEnd = end || hoverDate;
    if (!effectiveEnd) return false;

    return date > start && date < effectiveEnd;
  };

  const handleDayClick = (day: number) => {
    const clickedDate = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day,
      12,
      0,
      0,
    );

    let newSelection: { from?: Date; to?: Date };

    if (!selection.from || (selection.from && selection.to)) {
      newSelection = { from: clickedDate, to: undefined };
    } else if (clickedDate < selection.from) {
      newSelection = { from: clickedDate, to: undefined };
    } else {
      newSelection = { from: selection.from, to: clickedDate };
    }

    onSelect?.(newSelection);
  };

  const getDayClass = (day: number) => {
    if (isStartDate(day)) return 'border-2 border-green-600 bg-green-100 text-green-900';
    if (isEndDate(day)) return 'border-2 border-red-600 bg-red-100 text-red-900';
    if (isInRange(day)) {
      if (selection.from && selection.to) {
        return 'bg-gray-200 text-gray-700';
      }
      return 'bg-green-50 text-gray-700';
    }
    return '';
  };

  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(<div key={`empty-${i}`} className="h-7 w-7 sm:h-9 sm:w-9" />);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(
      <button
        key={day}
        onClick={() => handleDayClick(day)}
        onMouseEnter={() =>
          selection.from &&
          !selection.to &&
          setHoverDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day, 12, 0, 0))
        }
        onMouseLeave={() => setHoverDate(null)}
        className={cn(
          'h-7 w-7 sm:h-9 sm:w-9 rounded-md text-xs sm:text-sm transition-colors hover:bg-neutral-100',
          isToday(day) && 'font-bold underline',
          getDayClass(day),
        )}
      >
        {day}
      </button>,
    );
  }

  const goToPrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const daysOfWeek = t('calendar.days').split(',');

  return (
    <div className={cn('w-full max-w-xs max-w-sm', className)}>
      <div className="flex items-center justify-between mb-2 sm:mb-4">
        <button onClick={goToPrevMonth} className="p-1.5 sm:p-2 hover:bg-neutral-100 rounded-md">
          <ChevronLeftIcon className="h-3 w-3 sm:h-4 sm:w-4" />
        </button>
        <span className="text-xs sm:text-sm font-medium capitalize">{monthName}</span>
        <button onClick={goToNextMonth} className="p-1.5 sm:p-2 hover:bg-neutral-100 rounded-md">
          <ChevronRightIcon className="h-3 w-3 sm:h-4 sm:w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-1 sm:mb-2">
        {daysOfWeek.map((d) => (
          <div
            key={d}
            className="h-6 sm:h-8 flex items-center justify-center text-[10px] sm:text-xs text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">{days}</div>

      <div className="mt-3 sm:mt-4 flex gap-2 sm:gap-4 text-[10px] sm:text-xs">
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 border-2 border-green-600 rounded" />
          <span className="hidden sm:inline">{t('calendar.start')}</span>
          <span className="sm:hidden">{t('calendar.from')}</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 border-2 border-red-600 rounded" />
          <span className="hidden sm:inline">{t('calendar.end')}</span>
          <span className="sm:hidden">{t('calendar.to')}</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 bg-gray-200 rounded" />
          <span className="hidden sm:inline">{t('calendar.period')}</span>
          <span className="sm:hidden">{t('calendar.periodShort')}</span>
        </div>
      </div>
    </div>
  );
}
