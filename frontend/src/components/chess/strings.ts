// SECURITY_NOTE: all user-visible chess strings centralized here for later i18n
// extraction. Server error `code` values map to safe, static messages — we
// never interpolate a server-provided `message` field into the UI.
export const chessStrings = {
  board: { label: 'Chess board. Use arrow keys to navigate, Enter to select.' },
  square: 'Square',
  empty: 'empty',
  justMoved: 'just moved',
  inCheck: 'in check',
  piece: {
    pawn: { white: 'white pawn', black: 'black pawn' },
    knight: { white: 'white knight', black: 'black knight' },
    bishop: { white: 'white bishop', black: 'black bishop' },
    rook: { white: 'white rook', black: 'black rook' },
    queen: { white: 'white queen', black: 'black queen' },
    king: { white: 'white king', black: 'black king' },
  },
  controls: {
    resign: 'Resign',
    resignConfirmTitle: 'Resign game?',
    resignConfirmBody: 'You will lose this game. This cannot be undone.',
    resignConfirm: 'Yes, resign',
    cancel: 'Cancel',
    offerDraw: 'Offer draw',
    drawOffered: 'Draw offered',
    drawPendingFromOpponent: 'Opponent offers a draw',
    accept: 'Accept draw',
    decline: 'Decline',
  },
  promotion: {
    title: 'Choose promotion piece',
    queen: 'Queen',
    rook: 'Rook',
    bishop: 'Bishop',
    knight: 'Knight',
  },
  clock: {
    white: "White's clock",
    black: "Black's clock",
    flagged: 'Flag fell',
    untimed: '∞',
  },
  history: { label: 'Move history', empty: 'No moves yet' },
  timeControl: {
    untimed: 'Untimed',
    blitz: 'Blitz 5+0',
    rapid: 'Rapid 10+0',
    classical: 'Classical 15+10',
    pickerLabel: 'Time control',
  },
  landing: {
    title: 'Chess',
    subtitle: 'Classical chess — real-time, two players.',
    createLobby: 'Create Lobby',
    creating: 'Creating…',
    joinLobby: 'Join Lobby',
    joinDescription: 'Enter a code to join a game',
    joinModalTitle: 'Join a Chess Lobby',
    joinCodeLabel: 'Lobby Code',
    joinCodePlaceholder: 'Enter 6-digit code',
    joinButton: 'Join Game',
    back: '← Back to Games',
  },
  errors: {
    invalid_payload: 'Invalid move.',
    not_a_seat: 'Spectators cannot play.',
    not_your_turn: 'It is not your turn.',
    illegal_move: 'Illegal move.',
    game_not_active: 'Game is no longer active.',
    rate_limited: 'Slow down — too many moves.',
    draw_already_pending: 'A draw offer is already active.',
    no_pending_offer: 'There is no draw offer to respond to.',
    own_offer: 'You cannot respond to your own draw offer.',
    no_active_game: 'No active chess game here.',
    already_seated: 'You are already seated in this game.',
    spectator_cap: 'Spectator limit reached.',
    timeout: 'Move not acknowledged. Please try again.',
    disconnected: 'Reconnecting…',
    generic: 'Something went wrong.',
  },
  gameOver: {
    win: 'You won',
    loss: 'You lost',
    draw: 'Draw',
    spectatorEnded: 'Game over',
    returnToLobby: 'Return to lobby',
    termination: {
      checkmate: 'Checkmate',
      stalemate: 'Stalemate',
      threefold: 'Threefold repetition',
      'fifty-move': '50-move rule',
      'insufficient-material': 'Insufficient material',
      'draw-agreement': 'Draw by agreement',
      resignation: 'Resignation',
      flagged: 'Flag fall',
      'draw-insufficient': 'Draw — insufficient material on flag',
    },
  },
} as const;

/** Map a server `move_rejected` code → safe localized string. */
export function errorStringFor(code: string | null | undefined): string {
  if (!code) return chessStrings.errors.generic;
  const table = chessStrings.errors as Record<string, string>;
  return table[code] ?? chessStrings.errors.generic;
}
