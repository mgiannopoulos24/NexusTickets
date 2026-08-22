import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2');
  });

  it('handles conditional classes', () => {
    const isHidden = false;
    const isVisible = true;
    expect(cn('base', isHidden && 'hidden', isVisible && 'visible')).toBe('base visible');
  });

  it('ignores null and undefined', () => {
    expect(cn('base', null, undefined, 'end')).toBe('base end');
  });

  it('resolves Tailwind conflicts', () => {
    expect(cn('px-4', 'px-6')).toBe('px-6');
  });
});
