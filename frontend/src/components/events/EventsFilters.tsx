import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { setFilter, clearFilters } from '@/app/eventsSlice';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Search, X } from 'lucide-react';
import { useLang } from '@/contexts/LangContext';
import { cn } from '@/lib/utils';
import { DateRangeCalendar } from './DateRangeCalendar';

interface EventsFiltersProps {
  className?: string;
}

export function EventsFilters({ className }: EventsFiltersProps) {
  const { t } = useLang();
  const dispatch = useAppDispatch();
  const { filters } = useAppSelector((state) => state.events);

  // Date range state
  const parseFilterDate = (dateStr: string | undefined) => {
    if (!dateStr) return undefined;
    const d = new Date(dateStr);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
  };

  const range = {
    from: parseFilterDate(filters.from),
    to: parseFilterDate(filters.to),
  };

  const handleDateSelect = (selected: any) => {
    if (!selected) return;
    if (selected.from) {
      dispatch(
        setFilter({
          key: 'from',
          value: selected.from.toISOString().split('T')[0],
        }),
      );
    }
    if (selected.to) {
      dispatch(
        setFilter({
          key: 'to',
          value: selected.to.toISOString().split('T')[0],
        }),
      );
    }
  };

  // Price state (handle as array for slider)
  const priceRange = [Number(filters.min_price || 0), Number(filters.max_price || 10000)];

  const handlePriceChange = (vals: number[]) => {
    dispatch(setFilter({ key: 'min_price', value: vals[0] }));
    dispatch(setFilter({ key: 'max_price', value: vals[1] }));
  };

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold comfortaa-bold">{t('actions.filter')}</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => dispatch(clearFilters())}
          className="h-8 px-2 text-xs"
        >
          <X className="w-3 h-3 mr-1" />
          {t('actions.cancel')}
        </Button>
      </div>

      <Separator />

      <div className="space-y-6">
        {/* Search */}
        <div className="space-y-2">
          <Label htmlFor="q">{t('labels.search')}</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="q"
              placeholder={t('placeholders.searchEvents')}
              className="pl-8"
              value={filters.q || ''}
              onChange={(e) => dispatch(setFilter({ key: 'q', value: e.target.value }))}
            />
          </div>
        </div>

        {/* City - Combobox style (simplified for now as a search-input) */}
        <div className="space-y-2">
          <Label>{t('labels.city')}</Label>
          <Input
            placeholder={t('placeholders.city')}
            value={filters.city || ''}
            onChange={(e) => dispatch(setFilter({ key: 'city', value: e.target.value }))}
          />
        </div>

        {/* Price Range */}
        <div className="space-y-4">
          <div className="flex justify-between">
            <Label>{t('labels.price')}</Label>
            <span className="text-xs font-medium text-muted-foreground">
              {priceRange[0]}€ - {priceRange[1]}€
            </span>
          </div>
          <Slider
            value={priceRange}
            min={0}
            max={10000}
            step={10}
            onValueChange={handlePriceChange}
          />
        </div>

        {/* Date Range */}
        <div className="space-y-2">
          <Label>{t('labels.date')}</Label>
          <DateRangeCalendar from={range.from} to={range.to} onSelect={handleDateSelect} />
        </div>
      </div>
    </div>
  );
}
