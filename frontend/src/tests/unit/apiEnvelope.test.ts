import { describe, expect, it } from 'vitest';

import { apiErrorMessage, unwrap, unwrapList } from '@/app/apiEnvelope';

describe('unwrap', () => {
  it('returns the payload', () => {
    expect(unwrap<{ id: string }>({ data: { id: 'e1' }, error: null })).toEqual({ id: 'e1' });
  });

  it('throws the server message when the envelope carries an error', () => {
    expect(() =>
      unwrap({ data: null, error: { code: 'not_found', message: 'not found' } }),
    ).toThrowError('not found');
  });

  it('throws when the payload is missing', () => {
    expect(() => unwrap({ data: null, error: null })).toThrowError('Άκυρη απάντηση');
  });

  it('passes through falsy-but-present payloads', () => {
    expect(unwrap<number>({ data: 0, error: null })).toBe(0);
    expect(unwrap<string>({ data: '', error: null })).toBe('');
  });
});

describe('unwrapList', () => {
  it('returns the list', () => {
    expect(unwrapList<number>({ data: [1, 2], error: null })).toEqual([1, 2]);
  });

  it('treats an absent payload as an empty list', () => {
    // A list endpoint with nothing to return is not an error.
    expect(unwrapList({ data: null, error: null })).toEqual([]);
    expect(unwrapList({})).toEqual([]);
  });

  it('still throws on a server error', () => {
    expect(() =>
      unwrapList({ data: null, error: { code: 'forbidden', message: 'forbidden' } }),
    ).toThrowError('forbidden');
  });
});

describe('apiErrorMessage', () => {
  it('reads the message out of an RTK Query error envelope', () => {
    const err = { status: 422, data: { error: { code: 'business_rule', message: 'πολύ αργά' } } };
    expect(apiErrorMessage(err)).toBe('πολύ αργά');
  });

  it('falls back to a plain string body', () => {
    expect(apiErrorMessage({ status: 500, data: 'boom' })).toBe('boom');
  });

  it('reads a transport-level error string', () => {
    expect(apiErrorMessage({ error: 'Network request failed' })).toBe('Network request failed');
  });

  it('reads a thrown Error', () => {
    expect(apiErrorMessage(new Error('exploded'))).toBe('exploded');
  });

  it('uses the fallback for anything unrecognised', () => {
    expect(apiErrorMessage(undefined, 'default')).toBe('default');
    expect(apiErrorMessage({}, 'default')).toBe('default');
    expect(apiErrorMessage({ data: {} }, 'default')).toBe('default');
  });
});
