import { Search, X } from 'lucide-react';

import { useListCategoriesQuery } from '@/app/eventsApi';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { clearFilters, setFilter } from '@/app/eventsSlice';
import { DateRangeCalendar } from '@/components/events/DateRangeCalendar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { useLang } from '@/contexts/langContext';
import { cn } from '@/lib/utils';

type EventsFiltersProps = {
  className?: string;
};

const MAX_PRICE = 500;

/** Local midday avoids the date shifting a day when serialised to UTC. */
function parseFilterDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
}

/**
 * The six search criteria from assignment §8: free text over the description,
 * title, category, date range, ticket price and location.
 */
export function EventsFilters({ className }: EventsFiltersProps) {
  const { t } = useLang();
  const dispatch = useAppDispatch();
  const { filters } = useAppSelector((state) => state.events);
  const { data: categories } = useListCategoriesQuery();

  const selectedCategories = filters.category_ids ?? [];

  const minPrice = filters.min_price ?? 0;
  const maxPrice = filters.max_price ?? MAX_PRICE;

  const handlePriceChange = (vals: number[]) => {
    dispatch(setFilter({ key: 'min_price', value: vals[0] }));
    dispatch(setFilter({ key: 'max_price', value: vals[1] }));
  };

  const handleDateSelect = (range: { from?: Date; to?: Date }) => {
    dispatch(setFilter({ key: 'start_at', value: range?.from ? range.from.toISOString() : undefined }));
    dispatch(setFilter({ key: 'end_at', value: range?.to ? range.to.toISOString() : undefined }));
  };

  const toggleCategory = (id: string) => {
    const next = selectedCategories.includes(id)
      ? selectedCategories.filter((c) => c !== id)
      : [...selectedCategories, id];
    dispatch(setFilter({ key: 'category_ids', value: next.length > 0 ? next : undefined }));
  };

  const hasActiveFilters =
    Object.values(filters).some((v) => v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0));

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <div className="flex items-center justify-between">
        <h2 className="comfortaa-bold text-xl font-bold">{t('actions.filter')}</h2>
        <Button
          variant="ghost"
          size="sm"
          disabled={!hasActiveFilters}
          onClick={() => dispatch(clearFilters())}
          className="h-8 px-2 text-xs"
        >
          <X className="mr-1 h-3 w-3" />
          Καθαρισμός
        </Button>
      </div>

      <Separator />

      <div className="space-y-6">
        {/* Free text — matches title, description, venue and city. */}
        <div className="space-y-2">
          <Label htmlFor="filter-q">{t('labels.search')}</Label>
          <div className="relative">
            <Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
            <Input
              id="filter-q"
              placeholder={t('placeholders.searchEvents')}
              className="pl-8"
              value={filters.q ?? ''}
              onChange={(e) =>
                dispatch(setFilter({ key: 'q', value: e.target.value || undefined }))
              }
            />
          </div>
        </div>

        {/* Title only. */}
        <div className="space-y-2">
          <Label htmlFor="filter-title">Τίτλος</Label>
          <Input
            id="filter-title"
            placeholder="π.χ. Συναυλία"
            value={filters.title ?? ''}
            onChange={(e) =>
              dispatch(setFilter({ key: 'title', value: e.target.value || undefined }))
            }
          />
        </div>

        {/* Category. */}
        <div className="space-y-2">
          <Label>Κατηγορία</Label>
          <div className="space-y-2">
            {(categories ?? []).map((c) => (
              <label
                key={c.id}
                className="comfortaa-regular flex cursor-pointer items-center gap-2 text-sm text-neutral-700"
              >
                <Checkbox
                  checked={selectedCategories.includes(c.id)}
                  onCheckedChange={() => toggleCategory(c.id)}
                />
                {c.name}
              </label>
            ))}
            {!categories && (
              <p className="comfortaa-regular text-xs text-muted-foreground">Φόρτωση…</p>
            )}
          </div>
        </div>

        {/* Location. */}
        <div className="space-y-2">
          <Label htmlFor="filter-city">{t('labels.city')}</Label>
          <Input
            id="filter-city"
            placeholder={t('placeholders.city')}
            value={filters.city ?? ''}
            onChange={(e) =>
              dispatch(setFilter({ key: 'city', value: e.target.value || undefined }))
            }
          />
        </div>

        {/* Ticket price. */}
        <div className="space-y-4">
          <div className="flex justify-between">
            <Label>{t('labels.price')}</Label>
            <span className="text-xs font-medium text-muted-foreground">
              {minPrice}€ – {maxPrice}€{maxPrice >= MAX_PRICE ? '+' : ''}
            </span>
          </div>
          <Slider
            value={[minPrice, maxPrice]}
            min={0}
            max={MAX_PRICE}
            step={5}
            onValueChange={handlePriceChange}
          />
        </div>

        {/* Date range. */}
        <div className="space-y-2">
          <Label>{t('labels.date')}</Label>
          <DateRangeCalendar
            from={parseFilterDate(filters.start_at)}
            to={parseFilterDate(filters.end_at)}
            onSelect={handleDateSelect}
          />
        </div>
      </div>
    </div>
  );
}
