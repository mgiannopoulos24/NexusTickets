import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const nexusButtonAltVariants = cva('', {
  variants: {
    intent: {
      navbarGlobe:
        '!h-full min-h-0 shrink-0 cursor-pointer rounded-none border-b-4 border-b-transparent px-3 text-neutral-600 outline-0 transition-colors hover:bg-[var(--nexus-lightgray)] hover:border-b-[var(--nexus-purple)] focus-visible:ring-2 focus-visible:ring-[var(--nexus-purple)] focus-visible:ring-offset-2 focus-visible:outline-none',
      languageTrigger:
        'comfortaa-regular !h-auto min-h-0 w-full cursor-pointer justify-between rounded-md border-0 bg-transparent px-2.5 py-2 text-left text-sm font-normal text-neutral-800 shadow-none hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-[var(--nexus-purple)]/40 focus-visible:ring-inset',
      languageOption:
        'comfortaa-regular !h-auto min-h-0 w-full cursor-pointer justify-start rounded-sm border-0 bg-transparent px-2 py-1.5 text-left text-sm font-normal text-neutral-800 shadow-none hover:bg-neutral-100',
    },
  },
});

export type NexusButtonAltIntent = NonNullable<
  VariantProps<typeof nexusButtonAltVariants>['intent']
>;

export type ButtonAltProps = Omit<React.ComponentProps<typeof Button>, 'variant' | 'size'> &
  VariantProps<typeof nexusButtonAltVariants> & {
    intent: NexusButtonAltIntent;
    /** Navbar globe tab active (panel open); language row selected state */
    active?: boolean;
  };

export function ButtonAlt({ intent, className, active, ...props }: ButtonAltProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="default"
      className={cn(
        nexusButtonAltVariants({ intent }),
        intent === 'navbarGlobe' &&
          active &&
          'bg-[var(--nexus-lightgray)] border-b-[var(--nexus-purple)]',
        intent === 'languageOption' && active && 'bg-violet-50 text-[var(--nexus-purple)]',
        className,
      )}
      {...props}
    />
  );
}

export { nexusButtonAltVariants };
