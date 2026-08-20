import { hasExactActionShape } from './action-shape';

describe('hasExactActionShape', () => {
  it('ignores unrelated undefined fields materialized by DTO transformation', () => {
    expect(hasExactActionShape({
      type: 'pass_cards',
      cardIds: ['c-clubs-A', 'c-hearts-2', 'c-spades-Q'],
      cardId: undefined,
      bid: undefined,
    }, 'pass_cards', ['cardIds'])).toBe(true);
  });

  it('rejects a defined extra field', () => {
    expect(hasExactActionShape({
      type: 'pass_cards',
      cardIds: ['c-clubs-A', 'c-hearts-2', 'c-spades-Q'],
      bid: 3,
    }, 'pass_cards', ['cardIds'])).toBe(false);
  });

  it('requires every declared required field to be defined', () => {
    expect(hasExactActionShape({ type: 'pass_cards', cardIds: undefined }, 'pass_cards', ['cardIds'])).toBe(false);
  });
});