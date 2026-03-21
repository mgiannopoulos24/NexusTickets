import * as React from 'react';

import { cn } from '@/lib/utils';

/** Single shallow layer (lighter than the navbar header’s double shadow). */
const SELECT_FULL_PANEL_SHADOW = 'shadow-[0_1px_2px_0_rgba(60,64,67,0.06)]';

/** Dropdown row purple wash (15% opacity) for hover / keyboard highlight */
export const selectFullPurpleWash =
  'hover:bg-[color-mix(in_srgb,var(--nexus-purple)_15%,transparent)] focus:bg-[color-mix(in_srgb,var(--nexus-purple)_15%,transparent)] data-[highlighted]:bg-[color-mix(in_srgb,var(--nexus-purple)_15%,transparent)]';

const selectFullItemBase =
  'comfortaa-regular flex h-[50px] min-h-[50px] w-full min-w-0 cursor-pointer items-center rounded-none px-4 text-left text-sm text-neutral-800 outline-none ring-0 transition-colors focus-visible:ring-0';

/** Classes for one full-width row in a {@link SelectFullPanelContainer} (e.g. Radix `DropdownMenuItem`). */
export function selectFullItemClassName(className?: string): string {
  return cn(selectFullItemBase, selectFullPurpleWash, className);
}

/** Panel shell: bordered card matching language dropdown; rows handle their own height. */
export function SelectFullPanelContainer({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="select-full-panel"
      className={cn(
        'flex min-w-0 w-full flex-col overflow-hidden rounded-lg border border-neutral-200/90 bg-white p-0',
        SELECT_FULL_PANEL_SHADOW,
        className,
      )}
      {...props}
    />
  );
}

/** Thin rule between sections; use with Radix `DropdownMenuSeparator` via `className`. */
export const selectFullMenuSeparatorClass = 'm-0 h-px w-full bg-neutral-100';

/** Account trigger: fixed circle (matches avatar), no stretch; brown base + subtle purple tint on hover / open. */
export function selectFullAccountTriggerClassName(className?: string): string {
  return cn(
    'inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 p-0 outline-none ring-0 transition-colors',
    'self-center [min-height:0] [min-width:0]',
    'bg-[#5c4033] text-sm font-semibold text-white',
    'focus-visible:ring-0 focus-visible:outline-none',
    'hover:bg-[color-mix(in_srgb,var(--nexus-purple)_15%,#5c4033)]',
    'data-[state=open]:bg-[color-mix(in_srgb,var(--nexus-purple)_15%,#5c4033)]',
    className,
  );
}
