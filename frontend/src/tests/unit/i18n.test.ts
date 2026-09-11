import { describe, expect, it } from 'vitest';

import { translate } from '@/lib/i18n';

describe('i18n translate', () => {
  it('resolves a key in both languages', () => {
    expect(translate('el', 'nav.events')).toBe('Εκδηλώσεις');
    expect(translate('en', 'nav.events')).toBe('Events');
  });

  it('fills {placeholders} from params', () => {
    expect(translate('en', 'common.rangeOf', { from: 1, to: 20, total: 53 })).toBe('1–20 of 53');
    expect(translate('el', 'auth.welcome', { name: 'maria' })).toBe('Καλώς ήρθες, maria');
  });

  it('leaves unknown placeholders and unknown keys visible', () => {
    expect(translate('en', 'auth.welcome')).toBe('Welcome, {name}');
    expect(translate('en', 'does.not.exist')).toBe('does.not.exist');
  });
});
