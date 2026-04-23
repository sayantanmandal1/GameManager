/**
 * FEN → ARIA labels for every square. Mirrors backend fenToAriaLabels so
 * tests can assert parity. Kept separate so ChessBoard can memoize it.
 */
const PIECE_LABELS: Record<string, string> = {
  r: 'black rook',
  n: 'black knight',
  b: 'black bishop',
  q: 'black queen',
  k: 'black king',
  p: 'black pawn',
  R: 'white rook',
  N: 'white knight',
  B: 'white bishop',
  Q: 'white queen',
  K: 'white king',
  P: 'white pawn',
};

export function fenToAriaLabels(fen: string): Record<string, string> {
  const labels: Record<string, string> = {};
  const board = fen.split(' ')[0] ?? '';
  const ranks = board.split('/');
  if (ranks.length !== 8) return labels;
  for (let r = 0; r < 8; r++) {
    let file = 0;
    for (const ch of ranks[r]) {
      const emptyRun = parseInt(ch, 10);
      if (!Number.isNaN(emptyRun)) {
        for (let i = 0; i < emptyRun; i++) {
          const sq = String.fromCharCode('a'.charCodeAt(0) + file) + (8 - r);
          labels[sq] = `${sq}, empty`;
          file++;
        }
      } else {
        const sq = String.fromCharCode('a'.charCodeAt(0) + file) + (8 - r);
        const label = PIECE_LABELS[ch] ?? 'unknown piece';
        labels[sq] = `${sq}, ${label}`;
        file++;
      }
    }
  }
  return labels;
}
