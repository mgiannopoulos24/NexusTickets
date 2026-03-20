import * as React from "react";

import { cn } from "@/lib/utils";

/** Matches navbar header drop shadow */
export const SELECT_ALT_HEADER_SHADOW =
  "shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)]";

export const selectAltListScroll =
  "max-h-[min(14rem,calc(100vh-12rem))] overflow-y-auto [scrollbar-color:rgb(203_213_225)_rgb(255_255_255)] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-neutral-300 [&::-webkit-scrollbar-track]:bg-white";

/** Single wrapper around the whole custom select (trigger + list) in place */
export function SelectAltPanelContainer({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="select-alt-panel"
      className={cn(
        "flex min-w-0 flex-col rounded-lg border border-neutral-200/90 bg-white p-2",
        SELECT_ALT_HEADER_SHADOW,
        className,
      )}
      {...props}
    />
  );
}

/** Scrollable list region inside {@link SelectAltPanelContainer} */
export function SelectAltScrollRegion({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="select-alt-scroll"
      className={cn(
        "mt-1.5 border-t border-neutral-100 pt-1.5",
        selectAltListScroll,
        className,
      )}
      {...props}
    />
  );
}
