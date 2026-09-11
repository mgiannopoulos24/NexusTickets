/** The band behind the hero slider cycles through the brand colours, one per slide. */
export const HERO_BAND_COLORS = ['#6d28d9', '#d4f040', '#000020'] as const;

export function heroBandColor(index: number): string {
  return HERO_BAND_COLORS[index % HERO_BAND_COLORS.length];
}

/** Dots and captions must stay legible on whichever colour is behind them. */
export function heroBandIsDark(index: number): boolean {
  return heroBandColor(index) !== '#d4f040';
}
