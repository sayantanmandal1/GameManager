import { MONOPOLY_CANONICAL_PREVIEW_BOARD, buildMonopolyCanonicalPreviewBoard } from './monopolyBoardData';

describe('monopolyBoardData', () => {
  it('contains 40 canonical spaces with stable ordering', () => {
    expect(MONOPOLY_CANONICAL_PREVIEW_BOARD).toHaveLength(40);
    expect(MONOPOLY_CANONICAL_PREVIEW_BOARD[0]?.name).toBe('GO');
    expect(MONOPOLY_CANONICAL_PREVIEW_BOARD[1]?.name).toBe('Mediterranean Avenue');
    expect(MONOPOLY_CANONICAL_PREVIEW_BOARD[10]?.name).toBe('In Jail / Just Visiting');
    expect(MONOPOLY_CANONICAL_PREVIEW_BOARD[20]?.name).toBe('Free Parking');
    expect(MONOPOLY_CANONICAL_PREVIEW_BOARD[30]?.name).toBe('Go To Jail');
    expect(MONOPOLY_CANONICAL_PREVIEW_BOARD[39]?.name).toBe('Boardwalk');
  });

  it('builds a board view structure with no ownership state in preview', () => {
    const board = buildMonopolyCanonicalPreviewBoard();

    expect(board).toHaveLength(40);
    expect(board.every((space) => space.ownerId === null)).toBe(true);
    expect(board.every((space) => space.mortgaged === false)).toBe(true);
    expect(board.every((space) => space.buildingCount === 0)).toBe(true);
    expect(board[5]).toMatchObject({ name: 'Reading Railroad', price: 200, mortgage: 100, kind: 'railroad' });
    expect(board[12]).toMatchObject({ name: 'Electric Company', kind: 'utility', price: 150 });
    expect(board[38]).toMatchObject({ name: 'Luxury Tax', kind: 'tax', amount: 100 });
  });
});