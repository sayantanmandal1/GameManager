import type { BridgeDoubling, BridgeStrain } from '../../../shared';
import {
  bridgeContractPoints,
  scoreDuplicateDeal,
  scoreHomeDeal,
  scoreRubberDeal,
} from './bridge-scoring';

function contract(
  level: number,
  strain: BridgeStrain,
  doubling: BridgeDoubling = 'undoubled',
) {
  return { level, strain, doubling };
}

describe('Bridge scoring', () => {
  describe('duplicate raw scoring', () => {
    it.each([
      [contract(3, 'notrump'), 9, false, 400],
      [contract(3, 'notrump'), 9, true, 600],
      [contract(4, 'hearts'), 10, false, 420],
      [contract(4, 'hearts'), 10, true, 620],
      [contract(5, 'clubs'), 11, false, 400],
      [contract(6, 'notrump'), 12, true, 1440],
      [contract(7, 'spades'), 13, false, 1510],
      [contract(2, 'spades', 'doubled'), 9, false, 570],
      [contract(1, 'notrump', 'redoubled'), 8, false, 760],
    ])('scores %# correctly', (bid, tricks, vulnerable, expected) => {
      expect(scoreDuplicateDeal(bid, tricks, vulnerable).declarerScore).toBe(expected);
    });

    it.each([
      [contract(4, 'spades'), 9, false, 50],
      [contract(4, 'spades'), 8, true, 200],
      [contract(4, 'spades', 'doubled'), 9, false, 100],
      [contract(4, 'spades', 'doubled'), 6, false, 800],
      [contract(4, 'spades', 'doubled'), 7, true, 800],
      [contract(4, 'spades', 'redoubled'), 7, true, 1600],
    ])('applies undertrick ladder %#', (bid, tricks, vulnerable, penalty) => {
      const score = scoreDuplicateDeal(bid, tricks, vulnerable);
      expect(score).toMatchObject({
        made: false,
        penaltyPoints: penalty,
        declarerScore: -penalty,
        defenderScore: penalty,
      });
    });
  });

  describe('rubber scoring components', () => {
    it('keeps contract points and overtricks separate from duplicate game bonuses', () => {
      expect(scoreRubberDeal(contract(2, 'notrump'), 9, false)).toMatchObject({
        made: true,
        contractPoints: 70,
        overtrickPoints: 30,
        bonusPoints: 0,
        declarerScore: 100,
      });
      expect(scoreRubberDeal(contract(4, 'hearts'), 10, false)).toMatchObject({
        contractPoints: 120,
        declarerScore: 120,
      });
    });

    it('awards penalties only to defenders when a rubber contract is set', () => {
      expect(scoreRubberDeal(contract(3, 'diamonds', 'doubled'), 7, false)).toMatchObject({
        made: false,
        penaltyPoints: 300,
        declarerScore: 0,
        defenderScore: 300,
      });
    });
  });

  describe('home scoring', () => {
    it.each([
      [contract(1, 'clubs'), 7, 50],
      [contract(3, 'hearts'), 9, 50],
      [contract(3, 'hearts'), 10, 100],
      [contract(4, 'hearts'), 10, 250],
      [contract(6, 'spades'), 12, 300],
      [contract(7, 'notrump'), 13, 400],
    ])('uses the selected made-contract schedule %#', (bid, tricks, expected) => {
      expect(scoreHomeDeal(bid, tricks).declarerScore).toBe(expected);
    });

    it('deducts 50 per undertrick, 100 doubled, and 200 redoubled', () => {
      expect(scoreHomeDeal(contract(5, 'hearts'), 9).declarerScore).toBe(-100);
      expect(scoreHomeDeal(contract(5, 'hearts', 'doubled'), 9).declarerScore).toBe(-200);
      expect(scoreHomeDeal(contract(5, 'hearts', 'redoubled'), 9).declarerScore).toBe(-400);
    });
  });

  it('uses standard denomination and doubling contract values', () => {
    expect(bridgeContractPoints(contract(3, 'clubs'))).toBe(60);
    expect(bridgeContractPoints(contract(4, 'spades', 'doubled'))).toBe(240);
    expect(bridgeContractPoints(contract(3, 'notrump', 'redoubled'))).toBe(400);
  });
});