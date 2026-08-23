/**
 * Splices `insert` into `text` over the selection, the way a messenger's emoji
 * picker does: at the caret, replacing whatever is highlighted. Returns the new
 * text and where the caret should land afterwards.
 */
export function insertAtCaret(
  text: string,
  start: number,
  end: number,
  insert: string,
): { text: string; caret: number } {
  const from = Math.max(0, Math.min(start, text.length));
  const to = Math.max(from, Math.min(end, text.length));
  return {
    text: text.slice(0, from) + insert + text.slice(to),
    caret: from + insert.length,
  };
}
