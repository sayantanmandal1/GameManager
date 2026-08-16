import { getCorsOrigins } from './cors';

describe('getCorsOrigins', () => {
  it('returns one configured origin as a string', () => {
    expect(getCorsOrigins('https://game.example')).toBe('https://game.example');
  });

  it('returns a trimmed allow-list for multiple origins', () => {
    expect(
      getCorsOrigins('https://web.example, https://mobile.example'),
    ).toEqual(['https://web.example', 'https://mobile.example']);
  });

  it('never converts an empty value into a wildcard', () => {
    expect(getCorsOrigins(' , ')).toBe('http://localhost:3000');
  });
});