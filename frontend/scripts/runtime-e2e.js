'use strict';

const assert = require('node:assert/strict');
const { io } = require('socket.io-client');

const API_URL = process.env.E2E_API_URL || 'http://127.0.0.1:8000';
const SOCKET_URL = process.env.E2E_SOCKET_URL || 'http://127.0.0.1:8000';
const TIMEOUT_MS = 10_000;
const PARTNERSHIP_GAMES = new Set(['contract-bridge', 'spades', 'euchre', 'whist']);

async function main() {
  const suffix = String(Date.now()).slice(-7);
  const alpha = await login(`Alpha${suffix}`);
  const beta = await login(`Beta${suffix}`);
  const gamma = await login(`Gamma${suffix}`);
  const delta = await login(`Delta${suffix}`);
  let alphaSocket = await connect(alpha.token);
  const betaSocket = await connect(beta.token);
  const gammaSocket = await connect(gamma.token);
  const deltaSocket = await connect(delta.token);

  try {
    await verifyCatalog();
    await verifyHostRemoval(alpha, beta, alphaSocket, betaSocket);
    const ttt = await verifyTicTacToeAndHostTransfer(
      alpha,
      beta,
      alphaSocket,
      betaSocket,
    );
    alphaSocket.disconnect();
    alphaSocket = await connect(alpha.token);
    await restoreTicTacToeAndFinish(ttt, alpha, beta, alphaSocket, betaSocket);

    await verifyConnectFour(alpha, beta, alphaSocket, betaSocket);
    await verifyBingo(alpha, beta, alphaSocket, betaSocket);
    await verifyChess(alpha, beta, alphaSocket, betaSocket);
    await verifyPhotobooth(alpha, beta, alphaSocket, betaSocket);
    alphaSocket.disconnect();
    alphaSocket = await connect(alpha.token);

    await verifyUnoReconnectAndPrivacy(alpha, beta, alphaSocket, betaSocket);
    await verifyUnoFlipVisibilityAndRematch(gamma, delta, gammaSocket, deltaSocket);
    await verifyUnoNoMercyContract(gamma, delta, gammaSocket, deltaSocket);
    alphaSocket.disconnect();
    alphaSocket = await connect(alpha.token);

    await verifyLudoProjection(alpha, beta, alphaSocket, betaSocket);
    await verifyDistinctGames(
      alpha,
      beta,
      gamma,
      delta,
      alphaSocket,
      betaSocket,
      gammaSocket,
      deltaSocket,
    );
    await verifyVoiceRelay(alphaSocket, betaSocket);

    console.log(
      'Runtime E2E passed: 44-game catalog, rematch, lobby, reconnect, eight existing games, thirty-six distinct games, voice.',
    );
  } finally {
    alphaSocket.disconnect();
    betaSocket.disconnect();
    gammaSocket.disconnect();
    deltaSocket.disconnect();
  }
}

async function verifyUnoNoMercyContract(gamma, delta, gammaSocket, deltaSocket) {
  console.log('Runtime E2E UNO No Mercy: official mode contract and terminal persistence');
  const lobby = (await emitAndWait(
    gammaSocket,
    'lobby:create',
    {
      gameType: 'uno',
      maxPlayers: 99,
      unoRules: {
        mode: 'noMercy',
        targetScore: 500,
        stacking: false,
        drawToMatch: false,
        jumpIn: false,
        sevenZero: false,
        forcePlay: false,
        noBluffing: false,
      },
    },
    'lobby:state',
    (payload) => payload.lobby?.gameType === 'uno'
      && payload.lobby?.unoRules?.mode === 'noMercy',
    'UNO No Mercy: create lobby',
  )).lobby;
  assert.equal(lobby.maxPlayers, 6);
  assert.equal(lobby.unoRules.targetScore, null);
  await joinAndReady(gammaSocket, deltaSocket, lobby.code, delta.user.id);

  const gammaStatePromise = waitForEvent(
    gammaSocket,
    'uno:state',
    (payload) => payload.view?.mode === 'noMercy',
    'UNO No Mercy: host state',
  );
  const deltaStatePromise = waitForEvent(
    deltaSocket,
    'uno:state',
    (payload) => payload.view?.mode === 'noMercy',
    'UNO No Mercy: guest state',
  );
  gammaSocket.emit('lobby:start_game');
  const [gammaState, deltaState] = await Promise.all([
    gammaStatePromise,
    deltaStatePromise,
  ]);
  for (const state of [gammaState, deltaState]) {
    assert.equal(state.view.mercyLimit, 25);
    assert.equal(state.view.stacking, true);
    assert.equal(state.view.targetScore, null);
    assert.equal(state.view.yourHand.length, 7);
    assert(state.view.players.every((player) => player.visibleBackFaces.length === 0));
  }

  const gameOver = waitForEvent(
    gammaSocket,
    'uno:game_over',
    (payload) => payload.gameId === gammaState.gameId,
    'UNO No Mercy: terminal result',
  );
  deltaSocket.emit('uno:surrender', {
    gameId: gammaState.gameId,
    lobbyCode: lobby.code,
  });
  const terminal = await gameOver;
  assert.equal(terminal.result.matchOver, true);
  assert.equal(terminal.result.matchWinnerId, gamma.user.id);

  await delay(7_000);
  const persisted = await emitAndWait(
    gammaSocket,
    'uno:rejoin',
    { lobbyCode: lobby.code },
    'uno:state',
    (payload) => payload.gameId === gammaState.gameId,
    'UNO No Mercy: terminal state persists',
  );
  assert.equal(persisted.view.phase, 'finished');
  assert.equal(persisted.view.lastResult.matchWinnerId, gamma.user.id);

  await leaveLobbyAndWait(deltaSocket, lobby.code);
  await leaveLobbyAndWait(gammaSocket, lobby.code);
}

async function verifyUnoFlipVisibilityAndRematch(gamma, delta, gammaSocket, deltaSocket) {
  console.log('Runtime E2E UNO Flip: inactive faces and terminal rematch');
  const lobby = (await emitAndWait(
    gammaSocket,
    'lobby:create',
    {
      gameType: 'uno',
      maxPlayers: 2,
      unoRules: {
        mode: 'flip',
        targetScore: null,
        stacking: false,
        drawToMatch: false,
        jumpIn: false,
        sevenZero: false,
        forcePlay: false,
        noBluffing: false,
      },
    },
    'lobby:state',
    (payload) => payload.lobby?.gameType === 'uno',
    'UNO Flip: create lobby',
  )).lobby;
  await joinAndReady(gammaSocket, deltaSocket, lobby.code, delta.user.id);

  const gammaStatePromise = waitForEvent(
    gammaSocket,
    'uno:state',
    (payload) => payload.view?.mode === 'flip',
    'UNO Flip: host state',
  );
  const deltaStatePromise = waitForEvent(
    deltaSocket,
    'uno:state',
    (payload) => payload.view?.mode === 'flip',
    'UNO Flip: guest state',
  );
  gammaSocket.emit('lobby:start_game');
  const [gammaState, deltaState] = await Promise.all([
    gammaStatePromise,
    deltaStatePromise,
  ]);
  const deltaPublic = gammaState.view.players.find(
    (player) => player.id === delta.user.id,
  );
  assert(deltaPublic);
  assert.equal(deltaPublic.visibleBackFaces.length, 7);
  assert(deltaPublic.visibleBackFaces.every((face) => !Object.hasOwn(face, 'id')));
  assert(deltaState.view.yourHand.every((card) => !Object.hasOwn(card, 'dark')));
  const deltaIds = deltaState.view.yourHand.map((card) => card.id);
  assert(deltaIds.every((id) => !JSON.stringify(deltaPublic).includes(id)));

  const gameOver = waitForEvent(
    gammaSocket,
    'uno:game_over',
    (payload) => payload.gameId === gammaState.gameId,
    'UNO Flip: terminal result',
  );
  deltaSocket.emit('uno:surrender', {
    gameId: gammaState.gameId,
    lobbyCode: lobby.code,
  });
  const terminal = await gameOver;
  assert.equal(terminal.result.matchOver, true);
  assert.equal(terminal.result.matchWinnerId, gamma.user.id);

  await delay(7_000);
  const persisted = await emitAndWait(
    gammaSocket,
    'uno:rejoin',
    { lobbyCode: lobby.code },
    'uno:state',
    (payload) => payload.gameId === gammaState.gameId,
    'UNO Flip: terminal state persists',
  );
  assert.equal(persisted.view.phase, 'finished');
  assert.equal(persisted.view.matchWinnerId, gamma.user.id);

  const firstVote = waitForEvent(
    deltaSocket,
    'lobby:rematch_state',
    (payload) => payload.requestedBy?.includes(gamma.user.id),
    'UNO Flip: first rematch vote',
  );
  gammaSocket.emit('lobby:rematch_request', { lobbyCode: lobby.code });
  await firstVote;
  await delay(250);
  const stillOld = await emitAndWait(
    gammaSocket,
    'uno:rejoin',
    { lobbyCode: lobby.code },
    'uno:state',
    (payload) => payload.gameId === gammaState.gameId,
    'UNO Flip: no restart after one vote',
  );
  assert.equal(stillOld.view.phase, 'finished');

  const gammaFreshPromise = waitForEvent(
    gammaSocket,
    'uno:state',
    (payload) => payload.gameId !== gammaState.gameId && payload.view?.mode === 'flip',
    'UNO Flip: host rematch state',
  );
  const deltaFreshPromise = waitForEvent(
    deltaSocket,
    'uno:state',
    (payload) => payload.gameId !== gammaState.gameId && payload.view?.mode === 'flip',
    'UNO Flip: guest rematch state',
  );
  deltaSocket.emit('lobby:rematch_request', { lobbyCode: lobby.code });
  const [gammaFresh] = await Promise.all([gammaFreshPromise, deltaFreshPromise]);
  assert.notEqual(gammaFresh.gameId, gammaState.gameId);

  const cleanupResult = waitForEvent(
    gammaSocket,
    'uno:game_over',
    (payload) => payload.gameId === gammaFresh.gameId,
    'UNO Flip: cleanup result',
  );
  deltaSocket.emit('uno:surrender', {
    gameId: gammaFresh.gameId,
    lobbyCode: lobby.code,
  });
  await cleanupResult;
  await leaveLobbyAndWait(deltaSocket, lobby.code);
  await leaveLobbyAndWait(gammaSocket, lobby.code);
}

async function verifyHostRemoval(alpha, beta, alphaSocket, betaSocket) {
  console.log('Runtime E2E lobby: host removal');
  const lobby = (await emitAndWait(
    alphaSocket,
    'lobby:create',
    { gameType: 'bingo', maxPlayers: 2 },
    'lobby:state',
    (payload) => payload.lobby?.gameType === 'bingo',
    'host-removal: create lobby',
  )).lobby;
  const joined = waitForEvent(
    alphaSocket,
    'lobby:state',
    (payload) => payload.lobby?.players?.some((player) => player.id === beta.user.id),
    'host-removal: guest joins',
  );
  betaSocket.emit('lobby:join', { code: lobby.code });
  await joined;

  const removed = waitForEvent(
    betaSocket,
    'lobby:removed',
    (payload) => payload.lobbyCode === lobby.code,
    'host-removal: guest ejected',
  );
  const updated = waitForEvent(
    alphaSocket,
    'lobby:state',
    (payload) => payload.lobby?.code === lobby.code && payload.lobby.players.length === 1,
    'host-removal: host receives state',
  );
  alphaSocket.emit('lobby:remove_player', { targetUserId: beta.user.id });
  await Promise.all([removed, updated]);
  await leaveLobbyAndWait(alphaSocket, lobby.code);
}

async function verifyCatalog() {
  const response = await fetch(`${API_URL}/games/catalog`);
  assert.equal(response.status, 200);
  const catalog = await response.json();
  assert.equal(catalog.total, 44);
  assert.deepEqual(
    catalog.games.map((game) => game.key),
    [
      'bingo',
      'chess',
      'ludo',
      'photobooth',
      'uno',
      'tictactoe',
      'connectfour',
      'sudoku',
      'reversi',
      'checkers',
      'mancala',
      'dotsandboxes',
      'pig',
      'grid-salvo',
      'peg-codebreaker',
      'hangman',
      'go-fish',
      'crazy-eights',
      'five-dice-yacht',
      'liars-dice',
      'farkle',
      'shut-the-box',
      'draw-dominoes',
      'hearts',
      'spades',
      'gin-rummy',
      'card-war',
      'old-maid',
      'hex',
      'nine-mens-morris',
      'cee-lo',
      'trivia-quiz-bowl',
      'memory-match',
      'contract-bridge',
      'bourre',
      'bluff',
      'sevens',
      'ninety-nine',
      'euchre',
      'whist',
      'oh-hell',
      'president',
      'slapjack',
      'spoons',
    ],
  );
}

async function verifyTicTacToeAndHostTransfer(alpha, beta, alphaSocket, betaSocket) {
  const created = emitAndWait(
    alphaSocket,
    'lobby:create',
    { gameType: 'tictactoe', maxPlayers: 99, tictactoeMode: 'classic' },
    'lobby:state',
  );
  const initial = (await created).lobby;
  assert.equal(initial.maxPlayers, 2);
  assert.equal(initial.tictactoeMode, 'classic');

  const joined = waitForEvent(
    alphaSocket,
    'lobby:state',
    (payload) => payload.lobby?.players?.length === 2,
  );
  betaSocket.emit('lobby:join', { code: initial.code });
  await joined;

  const ready = waitForEvent(
    alphaSocket,
    'lobby:state',
    (payload) => payload.lobby?.players?.find((player) => player.id === beta.user.id)?.isReady,
  );
  betaSocket.emit('lobby:player_ready', { ready: true });
  await ready;

  const transferred = waitForEvent(
    betaSocket,
    'lobby:state',
    (payload) =>
      payload.lobby?.hostId === beta.user.id &&
      payload.lobby?.players?.length === 1,
  );
  alphaSocket.emit('lobby:leave');
  const transferState = (await transferred).lobby;
  assert.equal(transferState.players[0].isHost, true);

  const rejoined = waitForEvent(
    betaSocket,
    'lobby:state',
    (payload) => payload.lobby?.players?.length === 2,
  );
  alphaSocket.emit('lobby:join', { code: initial.code });
  await rejoined;

  const alphaReady = waitForEvent(
    betaSocket,
    'lobby:state',
    (payload) => payload.lobby?.players?.find((player) => player.id === alpha.user.id)?.isReady,
  );
  alphaSocket.emit('lobby:player_ready', { ready: true });
  await alphaReady;

  const alphaStatePromise = waitForEvent(alphaSocket, 'tictactoe:state');
  const betaStatePromise = waitForEvent(betaSocket, 'tictactoe:state');
  betaSocket.emit('lobby:start_game');
  const [alphaState, betaState] = await Promise.all([alphaStatePromise, betaStatePromise]);
  assert.equal(alphaState.lobbyCode, initial.code);
  assert.equal(betaState.view.players.length, 2);

  await requestGameState(alphaSocket, initial.code, 'tictactoe:state');
  await requestGameState(betaSocket, initial.code, 'tictactoe:state');
  const byId = new Map([
    [alpha.user.id, alphaSocket],
    [beta.user.id, betaSocket],
  ]);
  const firstId = alphaState.view.currentTurnId;
  const secondId = firstId === alpha.user.id ? beta.user.id : alpha.user.id;
  const firstSocket = byId.get(firstId);
  const secondSocket = byId.get(secondId);
  assert(firstSocket && secondSocket);

  const afterFirst = moveAndWait(
    firstSocket,
    secondSocket,
    'tictactoe:move',
    { gameId: alphaState.gameId, lobbyCode: initial.code, to: 0 },
    'tictactoe:state',
    (payload) =>
      payload.gameId === alphaState.gameId &&
      payload.view?.board?.filter(Boolean).length === 1,
  );
  await afterFirst;
  const afterSecond = moveAndWait(
    secondSocket,
    firstSocket,
    'tictactoe:move',
    { gameId: alphaState.gameId, lobbyCode: initial.code, to: 3 },
    'tictactoe:state',
    (payload) =>
      payload.gameId === alphaState.gameId &&
      payload.view?.board?.filter(Boolean).length === 2,
  );
  await afterSecond;

  return {
    code: initial.code,
    gameId: alphaState.gameId,
    firstId,
    secondId,
  };
}

async function restoreTicTacToeAndFinish(game, alpha, beta, alphaSocket, betaSocket) {
  await emitAndWait(
    alphaSocket,
    'lobby:join',
    { code: game.code },
    'lobby:state',
    (payload) => payload.lobby?.code === game.code,
  );
  const restored = await requestGameState(alphaSocket, game.code, 'tictactoe:state');
  assert.equal(restored.view.board[0], 'X');
  assert.equal(restored.view.board[3], 'O');
  assert.equal(restored.view.youId, alpha.user.id);

  const byId = new Map([
    [alpha.user.id, alphaSocket],
    [beta.user.id, betaSocket],
  ]);
  const firstSocket = byId.get(game.firstId);
  const secondSocket = byId.get(game.secondId);
  assert(firstSocket && secondSocket);

  await moveAndWait(
    firstSocket,
    secondSocket,
    'tictactoe:move',
    { gameId: game.gameId, lobbyCode: game.code, to: 1 },
    'tictactoe:state',
    (payload) =>
      payload.gameId === game.gameId &&
      payload.view?.board?.filter(Boolean).length === 3,
  );
  await moveAndWait(
    secondSocket,
    firstSocket,
    'tictactoe:move',
    { gameId: game.gameId, lobbyCode: game.code, to: 4 },
    'tictactoe:state',
    (payload) =>
      payload.gameId === game.gameId &&
      payload.view?.board?.filter(Boolean).length === 4,
  );
  const resultPromise = waitForEvent(firstSocket, 'tictactoe:result');
  firstSocket.emit('tictactoe:move', {
    gameId: game.gameId,
    lobbyCode: game.code,
    to: 2,
  });
  const result = await resultPromise;
  assert.equal(result.result.winnerId, game.firstId);

  const alphaRematch = waitForEvent(
    alphaSocket,
    'tictactoe:state',
    (payload) => payload.gameId !== game.gameId && payload.view?.board?.every((cell) => cell === null),
  );
  const betaRematch = waitForEvent(
    betaSocket,
    'tictactoe:state',
    (payload) => payload.gameId !== game.gameId && payload.view?.board?.every((cell) => cell === null),
  );
  const firstVote = waitForEvent(
    betaSocket,
    'lobby:rematch_state',
    (payload) => payload.requestedBy?.includes(alpha.user.id),
  );
  alphaSocket.emit('lobby:rematch_request', { lobbyCode: game.code });
  await firstVote;
  betaSocket.emit('lobby:rematch_request', { lobbyCode: game.code });
  const [alphaFresh, betaFresh] = await Promise.all([alphaRematch, betaRematch]);
  assert.notEqual(alphaFresh.gameId, game.gameId);
  assert.equal(alphaFresh.gameId, betaFresh.gameId);
}

async function verifyConnectFour(alpha, beta, alphaSocket, betaSocket) {
  const lobby = (await emitAndWait(
    alphaSocket,
    'lobby:create',
    { gameType: 'connectfour', maxPlayers: 8 },
    'lobby:state',
  )).lobby;
  assert.equal(lobby.maxPlayers, 2);
  await joinAndReady(alphaSocket, betaSocket, lobby.code, beta.user.id);

  const alphaStatePromise = waitForEvent(alphaSocket, 'connectfour:state');
  const betaStatePromise = waitForEvent(betaSocket, 'connectfour:state');
  alphaSocket.emit('lobby:start_game');
  const [alphaState] = await Promise.all([alphaStatePromise, betaStatePromise]);
  const byId = new Map([
    [alpha.user.id, alphaSocket],
    [beta.user.id, betaSocket],
  ]);
  const firstId = alphaState.view.currentTurnId;
  const secondId = firstId === alpha.user.id ? beta.user.id : alpha.user.id;
  const sequence = [
    [firstId, 0],
    [secondId, 0],
    [firstId, 1],
    [secondId, 1],
    [firstId, 2],
    [secondId, 2],
  ];
  let expectedDiscCount = 0;
  for (const [playerId, column] of sequence) {
    expectedDiscCount += 1;
    const actor = byId.get(playerId);
    const observer = byId.get(playerId === firstId ? secondId : firstId);
    await moveAndWait(
      actor,
      observer,
      'connectfour:drop',
      { gameId: alphaState.gameId, lobbyCode: lobby.code, column },
      'connectfour:state',
      (payload) =>
        payload.gameId === alphaState.gameId &&
        payload.view?.board?.filter(Boolean).length === expectedDiscCount,
    );
  }
  const winnerSocket = byId.get(firstId);
  const resultPromise = waitForEvent(winnerSocket, 'connectfour:result');
  winnerSocket.emit('connectfour:drop', {
    gameId: alphaState.gameId,
    lobbyCode: lobby.code,
    column: 3,
  });
  const result = await resultPromise;
  assert.equal(result.result.winnerId, firstId);
  assert.equal(result.result.winningCells.length, 4);
}

async function verifyUnoReconnectAndPrivacy(alpha, beta, alphaSocket, betaSocket) {
  const lobby = (await emitAndWait(
    alphaSocket,
    'lobby:create',
    {
      gameType: 'uno',
      maxPlayers: 2,
      unoRules: {
        mode: 'classic',
        targetScore: null,
        stacking: false,
        drawToMatch: false,
        jumpIn: false,
        sevenZero: false,
        forcePlay: false,
        noBluffing: false,
      },
    },
    'lobby:state',
  )).lobby;
  await joinAndReady(alphaSocket, betaSocket, lobby.code, beta.user.id);

  const alphaStatePromise = waitForEvent(alphaSocket, 'uno:state');
  const betaStatePromise = waitForEvent(betaSocket, 'uno:state');
  alphaSocket.emit('lobby:start_game');
  const [alphaState, betaState] = await Promise.all([alphaStatePromise, betaStatePromise]);
  assertPrivateUnoView(alphaState, alpha.user.id);
  assertPrivateUnoView(betaState, beta.user.id);
  const originalHandIds = alphaState.view.yourHand.map((card) => card.id).sort();

  await emitAndWait(
    alphaSocket,
    'uno:rejoin',
    { lobbyCode: lobby.code },
    'uno:state',
    (payload) => payload.view?.youId === alpha.user.id,
  );
  await emitAndWait(
    betaSocket,
    'uno:rejoin',
    { lobbyCode: lobby.code },
    'uno:state',
    (payload) => payload.view?.youId === beta.user.id,
  );

  const disconnectedViewPromise = waitForEvent(
    betaSocket,
    'uno:state',
    (payload) =>
      payload.view?.players?.find((player) => player.id === alpha.user.id)?.isConnected === false,
  );
  alphaSocket.disconnect();
  const disconnectedView = await disconnectedViewPromise;
  assert.equal(
    disconnectedView.view.players.find((player) => player.id === alpha.user.id).hand,
    undefined,
  );

  const replacement = await connect(alpha.token);
  try {
    const restored = await emitAndWait(
      replacement,
      'uno:rejoin',
      { lobbyCode: lobby.code },
      'uno:state',
      (payload) => payload.view?.youId === alpha.user.id,
    );
    assert.deepEqual(restored.view.yourHand.map((card) => card.id).sort(), originalHandIds);
    assertPrivateUnoView(restored, alpha.user.id);
  } finally {
    replacement.disconnect();
  }
}

async function verifyBingo(alpha, beta, alphaSocket, betaSocket) {
  const lobby = (await emitAndWait(
    alphaSocket,
    'lobby:create',
    { gameType: 'bingo', maxPlayers: 2 },
    'lobby:state',
  )).lobby;
  await joinAndReady(alphaSocket, betaSocket, lobby.code, beta.user.id);

  const alphaStatePromise = waitForEvent(
    alphaSocket,
    'game:state',
    (payload) => payload.view?.phase === 'setup',
  );
  const betaStatePromise = waitForEvent(
    betaSocket,
    'game:state',
    (payload) => payload.view?.phase === 'setup',
  );
  alphaSocket.emit('lobby:start_game');
  const [alphaState] = await Promise.all([alphaStatePromise, betaStatePromise]);

  const alphaReady = waitForEvent(
    betaSocket,
    'game:state',
    (payload) => payload.gameId === alphaState.gameId && payload.view?.opponentSetupDone === true,
  );
  alphaSocket.emit('bingo:randomize_board', {
    gameId: alphaState.gameId,
    lobbyCode: lobby.code,
  });
  await alphaReady;

  const playing = waitForEvent(
    alphaSocket,
    'game:state',
    (payload) => payload.gameId === alphaState.gameId && payload.view?.phase === 'playing',
  );
  betaSocket.emit('bingo:randomize_board', {
    gameId: alphaState.gameId,
    lobbyCode: lobby.code,
  });
  const playingState = await playing;
  const currentSocket =
    playingState.view.currentTurn === alpha.user.id ? alphaSocket : betaSocket;
  const observer = currentSocket === alphaSocket ? betaSocket : alphaSocket;
  const called = waitForEvent(
    observer,
    'game:state',
    (payload) =>
      payload.gameId === alphaState.gameId &&
      payload.view?.chosenNumbers?.includes(1),
  );
  currentSocket.emit('bingo:choose_number', {
    gameId: alphaState.gameId,
    lobbyCode: lobby.code,
    number: 1,
  });
  const calledState = await called;
  assert.equal(calledState.view.chosenNumbers[0], 1);
}

async function verifyChess(alpha, beta, alphaSocket, betaSocket) {
  const lobby = (await emitAndWait(
    alphaSocket,
    'lobby:create',
    {
      gameType: 'chess',
      maxPlayers: 8,
      timeControl: { baseMs: 300_000, incrementMs: 0 },
    },
    'lobby:state',
  )).lobby;
  assert.equal(lobby.maxPlayers, 2);

  const whiteStatePromise = waitForEvent(
    alphaSocket,
    'chess:state',
    (payload) => payload.role === 'white',
  );
  const blackStatePromise = waitForEvent(
    betaSocket,
    'chess:state',
    (payload) => payload.role === 'black',
  );
  betaSocket.emit('lobby:join', { code: lobby.code });
  const [whiteState, blackState] = await Promise.all([
    whiteStatePromise,
    blackStatePromise,
  ]);
  assert.equal(whiteState.view.timeControl.baseMs, 300_000);
  assert.equal(blackState.view.role, 'black');

  const applied = waitForEvent(
    betaSocket,
    'chess:move_applied',
    (payload) => payload.gameId === whiteState.gameId && payload.move?.from === 'e2',
  );
  alphaSocket.emit('chess:move', {
    gameId: whiteState.gameId,
    lobbyCode: lobby.code,
    from: 'e2',
    to: 'e4',
  });
  const move = await applied;
  assert.equal(move.move.to, 'e4');
  assert.match(move.fen, / b /);
}

async function verifyPhotobooth(alpha, beta, alphaSocket, betaSocket) {
  const lobby = (await emitAndWait(
    alphaSocket,
    'lobby:create',
    { gameType: 'photobooth', maxPlayers: 8 },
    'lobby:state',
  )).lobby;
  assert.equal(lobby.maxPlayers, 2);
  await joinAndReady(alphaSocket, betaSocket, lobby.code, beta.user.id);

  const hostStatePromise = waitForEvent(
    alphaSocket,
    'photobooth:state',
    (payload) => payload.view?.role === 'host',
  );
  const guestStatePromise = waitForEvent(
    betaSocket,
    'photobooth:state',
    (payload) => payload.view?.role === 'guest',
  );
  alphaSocket.emit('lobby:start_game');
  const [hostState] = await Promise.all([hostStatePromise, guestStatePromise]);

  const configured = waitForEvent(
    betaSocket,
    'photobooth:state',
    (payload) =>
      payload.gameId === hostState.gameId &&
      payload.view?.layout === 'grid-2x2' &&
      payload.view?.theme === 'sage',
  );
  alphaSocket.emit('photobooth:configure', {
    gameId: hostState.gameId,
    lobbyCode: lobby.code,
    layout: 'grid-2x2',
    theme: 'sage',
  });
  await configured;

  const capturePhase = waitForEvent(
    betaSocket,
    'photobooth:state',
    (payload) => payload.gameId === hostState.gameId && payload.view?.phase === 'capture',
  );
  alphaSocket.emit('photobooth:start_capture', {
    gameId: hostState.gameId,
    lobbyCode: lobby.code,
  });
  await capturePhase;

  const image =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  alphaSocket.emit('photobooth:capture', {
    gameId: hostState.gameId,
    lobbyCode: lobby.code,
    image,
  });
  await delay(250);
  const [hostCaptured, guestRedacted] = await Promise.all([
    requestGameState(alphaSocket, lobby.code, 'photobooth:state'),
    requestGameState(betaSocket, lobby.code, 'photobooth:state'),
  ]);
  assert.match(hostCaptured.view.myCapture, /^data:image\/png;base64,/);
  assert.equal(guestRedacted.view.myCapture, null);
}

async function verifyLudoProjection(alpha, beta, alphaSocket, betaSocket) {
  const lobby = (await emitAndWait(
    alphaSocket,
    'lobby:create',
    { gameType: 'ludo', maxPlayers: 2 },
    'lobby:state',
  )).lobby;
  await joinAndReady(alphaSocket, betaSocket, lobby.code, beta.user.id);

  const alphaStatePromise = waitForEvent(
    alphaSocket,
    'game:state',
    (payload) => payload.gameType === 'ludo',
  );
  const betaStatePromise = waitForEvent(
    betaSocket,
    'game:state',
    (payload) => payload.gameType === 'ludo',
  );
  alphaSocket.emit('lobby:start_game');
  const [state] = await Promise.all([alphaStatePromise, betaStatePromise]);
  assert.equal(state.view.players.length, 2);
  for (const player of state.view.players) {
    assert.equal(player.tokens.length, 4);
    assert(player.tokens.every((token) => token.stepsFromStart === 0));
  }

  const rollingSocket = state.view.currentTurn === alpha.user.id ? alphaSocket : betaSocket;
  const rollResultPromise = waitForEvent(
    alphaSocket,
    'ludo:dice_rolled',
    (payload) => payload.gameId === state.gameId,
  );
  const peerRollResultPromise = waitForEvent(
    betaSocket,
    'ludo:dice_rolled',
    (payload) => payload.gameId === state.gameId,
  );
  const stateAfterRollPromise = waitForEvent(
    alphaSocket,
    'game:state',
    (payload) => payload.gameType === 'ludo' && payload.gameId === state.gameId,
  );
  rollingSocket.emit('ludo:roll_dice', {
    gameId: state.gameId,
    lobbyCode: lobby.code,
  });

  const [rollResult, peerRollResult, stateAfterRoll] = await Promise.all([
    rollResultPromise,
    peerRollResultPromise,
    stateAfterRollPromise,
  ]);
  assert.equal(rollResult.playerId, state.view.currentTurn);
  assert(Number.isInteger(rollResult.dice));
  assert(rollResult.dice >= 1 && rollResult.dice <= 6);
  assert.equal(peerRollResult.playerId, rollResult.playerId);
  assert.equal(peerRollResult.dice, rollResult.dice);
  if (rollResult.turnSkipped) {
    assert.equal(stateAfterRoll.view.dice, null);
  }
}

async function verifyDistinctGames(
  alpha,
  beta,
  gamma,
  delta,
  alphaSocket,
  betaSocket,
  gammaSocket,
  deltaSocket,
) {
  const clients = [
    { user: alpha.user, socket: alphaSocket },
    { user: beta.user, socket: betaSocket },
    { user: gamma.user, socket: gammaSocket },
    { user: delta.user, socket: deltaSocket },
  ];
  const alphaFleet = [
    { start: 0, end: 4 },
    { start: 10, end: 13 },
    { start: 20, end: 22 },
    { start: 30, end: 32 },
    { start: 40, end: 41 },
  ];
  const betaFleet = [
    { start: 5, end: 45 },
    { start: 6, end: 36 },
    { start: 7, end: 27 },
    { start: 8, end: 28 },
    { start: 9, end: 19 },
  ];
  const scenarios = [
    {
      gameKey: 'reversi',
      action: { cell: 19 },
      assertTransition: (view) => {
        assert.equal(view.board[19], 'black');
        assert.equal(view.board[27], 'black');
        assert.equal(view.scores.black, 4);
      },
    },
    {
      gameKey: 'checkers',
      action: { from: 40, to: 33 },
      assertTransition: (view) => {
        assert.equal(view.board[40], null);
        assert.equal(view.board[33].playerId, alpha.user.id);
      },
    },
    {
      gameKey: 'mancala',
      action: { pit: 0 },
      assertTransition: (view) => {
        assert.deepEqual(view.pits[0], [0, 5, 5, 5, 5, 4]);
        assert.equal(view.currentTurnId, beta.user.id);
      },
    },
    {
      gameKey: 'dotsandboxes',
      action: { orientation: 'horizontal', row: 0, column: 0 },
      assertTransition: (view) => {
        assert.equal(view.horizontalEdges[0][0], true);
        assert.equal(view.currentTurnId, beta.user.id);
      },
    },
    {
      gameKey: 'pig',
      action: { type: 'roll' },
      assertTransition: (view) => {
        assert(Number.isInteger(view.lastRoll));
        assert(view.lastRoll >= 1 && view.lastRoll <= 6);
        if (view.lastRoll === 1) {
          assert.equal(view.turnTotal, 0);
          assert.equal(view.currentTurnId, beta.user.id);
        } else {
          assert.equal(view.turnTotal, view.lastRoll);
          assert.equal(view.currentTurnId, alpha.user.id);
        }
      },
    },
    {
      gameKey: 'grid-salvo',
      expectedMaxPlayers: 2,
      prepare: async ({ initialState, betaInitial, lobby }) => {
        assert.equal(initialState.view.phase, 'placement');
        assert.equal(initialState.view.yourOcean.every((cell) => cell === 'empty'), true);
        assert.equal(betaInitial.view.opponentOcean.every((cell) => cell === 'unknown'), true);

        const betaSeesAlphaReady = waitForEvent(
          betaSocket,
          'distinct:state',
          (payload) =>
            payload.gameId === initialState.gameId &&
            payload.view?.opponentReady === true &&
            payload.view?.yourReady === false,
        );
        alphaSocket.emit('distinct:action', {
          gameId: initialState.gameId,
          lobbyCode: lobby.code,
          action: { type: 'place_fleet', ships: alphaFleet },
        });
        const redacted = await betaSeesAlphaReady;
        assert.equal(redacted.view.opponentOcean.every((cell) => cell === 'unknown'), true);

        const alphaPlaying = waitForEvent(
          alphaSocket,
          'distinct:state',
          (payload) => payload.gameId === initialState.gameId && payload.view?.phase === 'playing',
        );
        const betaPlaying = waitForEvent(
          betaSocket,
          'distinct:state',
          (payload) => payload.gameId === initialState.gameId && payload.view?.phase === 'playing',
        );
        betaSocket.emit('distinct:action', {
          gameId: initialState.gameId,
          lobbyCode: lobby.code,
          action: { type: 'place_fleet', ships: betaFleet },
        });
        const [alphaReady] = await Promise.all([alphaPlaying, betaPlaying]);
        return alphaReady;
      },
      action: { type: 'shoot', cell: 5 },
      assertTransition: (view) => {
        assert.equal(view.yourOcean[5], 'hit');
        assert.equal(view.currentTurnId, beta.user.id);
      },
    },
    {
      gameKey: 'peg-codebreaker',
      expectedMaxPlayers: 2,
      action: { type: 'set_code', colors: ['red', 'blue', 'green', 'yellow'] },
      assertInitial: (_alphaView, betaView) => {
        assert.equal(betaView.yourSecret, null);
        assert.equal(betaView.revealedSecret, null);
      },
      assertTransition: (view) => {
        assert.equal(view.phase, 'guessing');
        assert.equal(view.currentTurnId, beta.user.id);
        assert.equal(view.revealedSecret, null);
      },
    },
    {
      gameKey: 'hangman',
      expectedMaxPlayers: 8,
      action: { type: 'set_phrase', phrase: 'HIDDEN WORD' },
      assertTransition: (view) => {
        assert.equal(view.phase, 'playing');
        assert.equal(view.currentTurnId, beta.user.id);
        assert.equal(view.pattern, '______ ____');
        assert.equal(view.revealedPhrase, null);
        assert.equal(JSON.stringify(view).includes('HIDDEN WORD'), false);
      },
      afterTransition: async ({ initialState, lobby }) => {
        const correct = waitForEvent(
          betaSocket,
          'distinct:state',
          (payload) => payload.gameId === initialState.gameId
            && payload.view?.pattern === '__DD__ ___D',
          'hangman: repeated correct letters',
        );
        betaSocket.emit('distinct:action', {
          gameId: initialState.gameId,
          lobbyCode: lobby.code,
          action: { type: 'guess_letter', letter: 'D' },
        });
        const correctState = await correct;
        assert.equal(correctState.view.misses, 0);
        assert.deepEqual(correctState.view.guessedLetters, ['D']);
        assert.equal(JSON.stringify(correctState.view).includes('HIDDEN WORD'), false);

        const wrong = waitForEvent(
          betaSocket,
          'distinct:state',
          (payload) => payload.gameId === initialState.gameId
            && payload.view?.misses === 1,
          'hangman: wrong letter builds figure',
        );
        betaSocket.emit('distinct:action', {
          gameId: initialState.gameId,
          lobbyCode: lobby.code,
          action: { type: 'guess_letter', letter: 'Z' },
        });
        const wrongState = await wrong;
        assert.equal(wrongState.view.pattern, '__DD__ ___D');
        assert.deepEqual(wrongState.view.guessedLetters, ['D', 'Z']);
      },
    },
    {
      gameKey: 'go-fish',
      expectedMaxPlayers: 5,
      action: (view) => ({
        type: 'ask',
        targetPlayerId: view.legalTargets[0],
        rank: view.legalRanks[0],
      }),
      assertInitial: (alphaView, betaView) => {
        assert(alphaView.legalRanks.length > 0);
        assert.equal(Object.prototype.hasOwnProperty.call(betaView.players[0], 'hand'), false);
      },
      assertTransition: (view) => {
        assert.notEqual(view.lastEvent, 'Cards dealt');
        assert.equal(Object.prototype.hasOwnProperty.call(view.players[0], 'hand'), false);
      },
    },
    {
      gameKey: 'crazy-eights',
      expectedMaxPlayers: 5,
      action: (view) => {
        const legalId = view.legalCardIds[0];
        if (!legalId) return { type: 'draw_card' };
        const card = view.yourHand.find((candidate) => candidate.id === legalId);
        return card?.rank === '8'
          ? { type: 'play_card', cardId: legalId, chosenSuit: 'clubs' }
          : { type: 'play_card', cardId: legalId };
      },
      assertInitial: (_alphaView, betaView) => {
        assert.equal(Object.prototype.hasOwnProperty.call(betaView.players[0], 'hand'), false);
      },
      assertTransition: (view, previousView) => {
        const alphaPublic = view.players.find((player) => player.id === alpha.user.id);
        assert(alphaPublic);
        assert.notEqual(
          `${view.topCard.id}:${alphaPublic.handCount}:${view.drawPileCount}`,
          `${previousView.topCard.id}:${previousView.yourHand.length}:${previousView.drawPileCount}`,
        );
      },
    },
    {
      gameKey: 'five-dice-yacht',
      expectedMaxPlayers: 8,
      action: { type: 'roll_dice', heldIndices: [] },
      assertTransition: (view) => {
        assert.equal(view.dice.length, 5);
        assert.equal(view.rollsUsed, 1);
        assert(view.dice.every((die) => Number.isInteger(die) && die >= 1 && die <= 6));
      },
    },
    {
      gameKey: 'liars-dice',
      expectedMaxPlayers: 6,
      action: { type: 'bid', quantity: 1, face: 1 },
      assertInitial: (_alphaView, betaView) => {
        assert.equal(betaView.yourDice.length, 5);
        assert.equal(Object.prototype.hasOwnProperty.call(betaView.players[0], 'dice'), false);
      },
      assertTransition: (view) => {
        assert.deepEqual(view.currentBid, { quantity: 1, face: 1, bidderId: alpha.user.id });
        assert.equal(view.currentTurnId, beta.user.id);
      },
    },
    {
      gameKey: 'farkle',
      expectedMaxPlayers: 8,
      action: { type: 'roll_farkle' },
      assertTransition: (view) => {
        assert(
          (view.phase === 'selecting' && view.dice.length === 6) ||
          (view.phase === 'rolling' && view.currentTurnId === beta.user.id && view.lastEvent.startsWith('Farkle')),
        );
      },
    },
    {
      gameKey: 'shut-the-box',
      expectedMaxPlayers: 4,
      action: { type: 'roll_box' },
      assertTransition: (view) => {
        assert.equal(view.phase, 'closing');
        assert.equal(view.roll.length, 2);
        assert(view.roll.every((die) => Number.isInteger(die) && die >= 1 && die <= 6));
      },
    },
    {
      gameKey: 'draw-dominoes',
      expectedMaxPlayers: 4,
      action: (view) => ({
        type: 'play_domino',
        dominoId: view.yourHand[0].id,
        end: 'right',
        flip: false,
      }),
      assertInitial: (_alphaView, betaView) => {
        assert.equal(Object.prototype.hasOwnProperty.call(betaView.players[0], 'hand'), false);
      },
      assertTransition: (view) => {
        assert.equal(view.chain.length, 1);
        assert.equal(view.currentTurnId, beta.user.id);
      },
    },
    {
      gameKey: 'hearts',
      playerCount: 4,
      expectedMaxPlayers: 4,
      skipInitialTurnAssertion: true,
      prepare: async ({ playerStates, lobby, actor }) => {
        for (let index = 0; index < playerStates.length; index += 1) {
          const state = playerStates[index];
          const cardIds = state.view.yourHand
            .filter((card) => card.id !== 'c-clubs-2')
            .slice(0, 3)
            .map((card) => card.id);
          if (index < playerStates.length - 1) {
            await emitDistinctActionAndWait(
              clients[index].socket,
              actor.socket,
              {
                gameId: playerStates[0].gameId,
                lobbyCode: lobby.code,
                action: { type: 'pass_cards', cardIds },
              },
              (payload) => payload.gameId === playerStates[0].gameId && payload.view?.players?.find((player) => player.id === state.view.youId)?.passed,
            );
            console.log(`Runtime E2E hearts: pass ${index + 1} accepted`);
          } else {
            const ready = await emitDistinctActionAndWait(
              clients[index].socket,
              actor.socket,
              {
                gameId: playerStates[0].gameId,
                lobbyCode: lobby.code,
                action: { type: 'pass_cards', cardIds },
              },
              (payload) => payload.gameId === playerStates[0].gameId && payload.view?.phase === 'playing',
            );
            console.log('Runtime E2E hearts: pass 4 accepted, trick play started');
            return ready;
          }
        }
        throw new Error('Hearts pass setup did not complete');
      },
      actorFromView: (view) => view.currentTurnId,
      action: (view) => ({ type: 'play_card', cardId: view.legalCardIds[0] }),
      isTransition: (view) => view?.trick?.length === 1,
      assertInitial: (_alphaView, _betaView, views) => {
        assert(views.every((view) => view.yourHand.length === 13));
        assert(views.every((view) => Object.prototype.hasOwnProperty.call(view.players[0], 'hand') === false));
      },
      assertTransition: (view) => {
        assert.equal(view.trick.length, 1);
        assert.equal(view.trick[0].card.id, 'c-clubs-2');
      },
    },
    {
      gameKey: 'spades',
      playerCount: 4,
      expectedMaxPlayers: 4,
      prepare: async ({ initialState, lobby }) => {
        let latest = initialState;
        for (let index = 0; index < 3; index += 1) {
          const next = waitForEvent(
            alphaSocket,
            'distinct:state',
            (payload) => payload.gameId === initialState.gameId && payload.view?.players?.filter((player) => player.bid !== null).length === index + 1,
          );
          clients[index].socket.emit('distinct:action', {
            gameId: initialState.gameId,
            lobbyCode: lobby.code,
            action: { type: 'bid_spades', bid: index + 1 },
          });
          latest = await next;
        }
        return latest;
      },
      actorFromView: (view) => view.currentTurnId,
      action: { type: 'bid_spades', bid: 4 },
      assertInitial: (_alphaView, _betaView, views) => {
        assert(views.every((view) => view.yourHand.length === 13));
        assert.deepEqual(views[0].players.map((player) => player.team), [0, 1, 0, 1]);
      },
      assertTransition: (view) => {
        assert.equal(view.phase, 'playing');
        assert.deepEqual(view.players.map((player) => player.bid), [1, 2, 3, 4]);
      },
    },
    {
      gameKey: 'gin-rummy',
      expectedMaxPlayers: 2,
      action: { type: 'gin_draw', source: 'stock' },
      assertInitial: (alphaView, betaView) => {
        assert.equal(alphaView.yourHand.length, 10);
        assert.equal(betaView.players[0].handCount, 10);
        assert.equal(JSON.stringify(betaView).includes(alphaView.yourHand[0].id), false);
      },
      assertTransition: (view) => {
        assert.equal(view.phase, 'discarding');
        assert.equal(view.players.find((player) => player.id === alpha.user.id).handCount, 11);
        assert.equal(view.stockCount, 30);
      },
    },
    {
      gameKey: 'card-war',
      expectedMaxPlayers: 2,
      action: { type: 'battle' },
      assertInitial: (alphaView) => {
        assert.deepEqual(alphaView.players.map((player) => player.cardCount), [26, 26]);
        assert.equal(Object.prototype.hasOwnProperty.call(alphaView, 'decks'), false);
      },
      assertTransition: (view) => {
        assert.equal(view.battleNumber, 1);
        assert(view.lastBattle.potSize >= 2);
      },
    },
    {
      gameKey: 'old-maid',
      playerCount: 4,
      expectedMaxPlayers: 8,
      skipInitialTurnAssertion: true,
      actorFromView: (view) => view.currentTurnId,
      action: { type: 'draw_from_player', handIndex: 0 },
      assertInitial: (alphaView, _betaView, views) => {
        assert.equal(Object.prototype.hasOwnProperty.call(alphaView.players[1], 'hand'), false);
        assert(views.find((view) => view.canAct)?.targetHandCount > 0);
      },
      assertTransition: (view, previousView) => {
        assert.notEqual(view.lastEvent, previousView.lastEvent);
      },
    },
    {
      gameKey: 'hex',
      expectedMaxPlayers: 2,
      action: { type: 'place_hex', cell: 0 },
      assertTransition: (view) => {
        assert.equal(view.board[0], 'vertical');
        assert.equal(view.currentTurnId, beta.user.id);
      },
    },
    {
      gameKey: 'nine-mens-morris',
      expectedMaxPlayers: 2,
      action: { type: 'place_stone', node: 0 },
      assertTransition: (view) => {
        assert.equal(view.board[0], alpha.user.id);
        assert.equal(view.currentTurnId, beta.user.id);
      },
    },
    {
      gameKey: 'cee-lo',
      expectedMaxPlayers: 8,
      action: { type: 'roll_ceelo' },
      assertTransition: (view) => {
        assert.equal(view.phase, 'challenger_roll');
        assert.equal(view.bankerRoll.dice.length, 3);
        assert(view.bankerRoll.dice.every((die) => Number.isInteger(die) && die >= 1 && die <= 6));
      },
    },
    {
      gameKey: 'trivia-quiz-bowl',
      expectedMaxPlayers: 10,
      skipInitialTurnAssertion: true,
      action: { type: 'answer_trivia', answerIndex: 0 },
      assertInitial: (alphaView) => {
        assert.equal(alphaView.question.number, 1);
        assert.equal(alphaView.question.options.length, 4);
        assert.equal(alphaView.reveal, null);
        assert.equal(Object.prototype.hasOwnProperty.call(alphaView.question, 'correctAnswerIndex'), false);
      },
      assertTransition: (view) => {
        assert.equal(view.answeredPlayerIds.includes(alpha.user.id), true);
        assert.equal(view.reveal, null);
      },
    },
    {
      gameKey: 'memory-match',
      expectedMaxPlayers: 4,
      action: { type: 'reveal_tile', tileIndex: 0 },
      assertInitial: (alphaView) => {
        assert.equal(alphaView.tiles.length, 24);
        assert.equal(alphaView.tiles.every((tile) => tile.symbol === null), true);
      },
      assertTransition: (view) => {
        assert.equal(view.revealedIndices.length, 1);
        assert.notEqual(view.tiles[0].symbol, null);
      },
    },
    {
      gameKey: 'bourre',
      playerCount: 4,
      expectedMaxPlayers: 7,
      skipInitialTurnAssertion: true,
      actorFromView: (view) => view.currentTurnId,
      action: { type: 'bourre_decide', play: true, discardIds: [] },
      assertInitial: (_alphaView, _betaView, views) => {
        assert(views.every((view) => view.yourHand.length === 5));
        const trumpCardId = views[0].trumpCard.id;
        for (let viewer = 0; viewer < views.length; viewer += 1) {
          const serialized = JSON.stringify(views[viewer]);
          for (let owner = 0; owner < views.length; owner += 1) {
            if (owner === viewer) continue;
            for (const hiddenCard of views[owner].yourHand) {
              if (hiddenCard.id !== trumpCardId) assert.equal(serialized.includes(`"${hiddenCard.id}"`), false);
            }
          }
        }
      },
      assertTransition: (view, previousView) => {
        assert.equal(view.players.find((player) => player.id === previousView.currentTurnId).decision, 'stayed');
        assert.notEqual(view.currentTurnId, previousView.currentTurnId);
      },
    },
    {
      gameKey: 'bluff',
      expectedMaxPlayers: 8,
      action: (view) => ({ type: 'bluff_play', cardIds: [view.yourHand[0].id] }),
      assertInitial: (alphaView, betaView) => {
        assert.equal(alphaView.yourHand.length, 26);
        assert.equal(betaView.yourHand.length, 26);
        assert.equal(JSON.stringify(betaView).includes(alphaView.yourHand[0].id), false);
      },
      assertTransition: (view) => {
        assert.equal(view.phase, 'challenge');
        assert.equal(view.pendingClaim.count, 1);
        assert.equal(view.pendingClaim.rank, 'A');
        assert.equal(Object.prototype.hasOwnProperty.call(view.pendingClaim, 'cardIds'), false);
      },
    },
    {
      gameKey: 'sevens',
      playerCount: 3,
      expectedMaxPlayers: 8,
      skipInitialTurnAssertion: true,
      actorFromView: (view) => view.currentTurnId,
      action: (view) => ({ type: 'play_sevens_card', cardId: view.legalCardIds[0] }),
      assertInitial: (_alphaView, _betaView, views) => {
        assert.equal(views.reduce((sum, view) => sum + view.yourHand.length, 0), 52);
        const actor = views.find((view) => view.canAct);
        assert.deepEqual(actor.legalCardIds, ['c-hearts-7']);
      },
      assertTransition: (view) => {
        assert.deepEqual(view.layout.hearts, { low: '7', high: '7' });
      },
    },
    {
      gameKey: 'ninety-nine',
      expectedMaxPlayers: 8,
      action: (view) => ({
        type: 'play_ninety_nine',
        cardId: view.legalPlays[0].cardId,
        chosenValue: view.legalPlays[0].values[0],
      }),
      assertInitial: (alphaView, betaView) => {
        assert.equal(alphaView.yourHand.length, 3);
        assert.equal(betaView.yourHand.length, 3);
        assert.deepEqual(alphaView.players.map((player) => player.tokens), [3, 3]);
        assert.equal(JSON.stringify(betaView).includes(alphaView.yourHand[0].id), false);
      },
      assertTransition: (view, previousView) => {
        assert.equal(view.players.find((player) => player.id === previousView.currentTurnId).handCount, 3);
        assert.notEqual(view.currentTurnId, previousView.currentTurnId);
        assert(view.total >= 0 && view.total <= 99);
      },
    },
    {
      gameKey: 'euchre',
      playerCount: 4,
      expectedMaxPlayers: 4,
      skipInitialTurnAssertion: true,
      actorFromView: (view) => view.currentTurnId,
      action: { type: 'euchre_call', euchreCall: { type: 'order_up', alone: false } },
      assertInitial: (_alphaView, _betaView, views) => {
        assert(views.every((view) => view.yourHand.length === 5));
        assert.deepEqual(views[0].players.map((player) => player.team), [0, 1, 0, 1]);
        const upcardId = views[0].upcard.id;
        for (let viewer = 0; viewer < views.length; viewer += 1) {
          const serialized = JSON.stringify(views[viewer]);
          for (let owner = 0; owner < views.length; owner += 1) {
            if (owner === viewer) continue;
            for (const hiddenCard of views[owner].yourHand) {
              if (hiddenCard.id !== upcardId) assert.equal(serialized.includes(`"${hiddenCard.id}"`), false);
            }
          }
        }
      },
      assertTransition: (view, previousView) => {
        assert.equal(view.phase, 'dealer_discard');
        assert.equal(view.makerId, previousView.currentTurnId);
        assert.equal(view.trumpSuit, previousView.upcard.suit);
        assert.equal(view.players.find((player) => player.id === view.dealerId).handCount, 6);
      },
    },
    {
      gameKey: 'whist',
      playerCount: 4,
      expectedMaxPlayers: 4,
      skipInitialTurnAssertion: true,
      actorFromView: (view) => view.currentTurnId,
      action: (view) => ({ type: 'play_whist_card', cardId: view.legalCardIds[0] }),
      assertInitial: (_alphaView, _betaView, views) => {
        assert(views.every((view) => view.yourHand.length === 13));
        assert.deepEqual(views[0].players.map((player) => player.team), [0, 1, 0, 1]);
      },
      assertTransition: (view) => {
        assert.equal(view.trick.length, 1);
        assert.equal(view.players.reduce((sum, player) => sum + player.handCount, 0), 51);
      },
    },
    {
      gameKey: 'oh-hell',
      playerCount: 4,
      expectedMaxPlayers: 7,
      skipInitialTurnAssertion: true,
      actorFromView: (view) => view.currentTurnId,
      action: (view) => ({ type: 'bid_oh_hell', bid: view.legalBids[0] }),
      assertInitial: (_alphaView, _betaView, views) => {
        assert(views.every((view) => view.yourHand.length === 7));
        assert.equal(views[0].dealNumber, 1);
        assert.equal(views[0].handSize, 7);
      },
      assertTransition: (view, previousView) => {
        assert.notEqual(view.currentTurnId, previousView.currentTurnId);
        assert.notEqual(view.players.find((player) => player.id === previousView.currentTurnId).bid, null);
      },
    },
    {
      gameKey: 'president',
      playerCount: 4,
      expectedMaxPlayers: 8,
      skipInitialTurnAssertion: true,
      actorFromView: (view) => view.currentTurnId,
      action: (view) => ({
        type: 'play_president_cards',
        cardIds: view.legalPlays[0].cardIds,
      }),
      assertInitial: (_alphaView, _betaView, views) => {
        assert.equal(views.reduce((sum, view) => sum + view.yourHand.length, 0), 52);
        for (let viewer = 0; viewer < views.length; viewer += 1) {
          const serialized = JSON.stringify(views[viewer]);
          for (let owner = 0; owner < views.length; owner += 1) {
            if (owner === viewer) continue;
            for (const hiddenCard of views[owner].yourHand) {
              assert.equal(serialized.includes(`"${hiddenCard.id}"`), false);
            }
          }
        }
      },
      assertTransition: (view, previousView) => {
        const actor = view.players.find((player) => player.id === previousView.currentTurnId);
        assert(actor);
        assert(actor.handCount < previousView.yourHand.length);
        assert.equal(view.pilePlay?.playerId, previousView.currentTurnId);
      },
    },
    {
      gameKey: 'slapjack',
      playerCount: 3,
      expectedMaxPlayers: 8,
      skipInitialTurnAssertion: true,
      actorFromView: (view) => view.currentTurnId,
      action: { type: 'flip_slapjack' },
      assertInitial: (alphaView) => {
        assert.equal(alphaView.players.reduce((sum, player) => sum + player.cardCount, 0), 52);
        assert.equal(alphaView.topCard, null);
        assert.equal(Object.prototype.hasOwnProperty.call(alphaView, 'stacks'), false);
      },
      assertTransition: (view, previousView) => {
        assert.equal(view.pileCount, 1);
        assert(view.topCard);
        assert.equal(view.topPlayerId, previousView.currentTurnId);
        assert.equal(view.players.reduce((sum, player) => sum + player.cardCount, 0), 51);
      },
    },
    {
      gameKey: 'spoons',
      playerCount: 4,
      expectedMaxPlayers: 8,
      action: (view) => ({ type: 'pass_spoon_card', cardId: view.yourHand[0].id }),
      assertInitial: (alphaView, _betaView, views) => {
        assert.deepEqual(views.map((view) => view.yourHand.length), [5, 4, 4, 4]);
        for (let viewer = 0; viewer < views.length; viewer += 1) {
          const serialized = JSON.stringify(views[viewer]);
          for (let owner = 0; owner < views.length; owner += 1) {
            if (owner === viewer) continue;
            for (const hiddenCard of views[owner].yourHand) {
              assert.equal(serialized.includes(`"${hiddenCard.id}"`), false);
            }
          }
        }
        assert.equal(alphaView.spoonsRemaining, 3);
      },
      assertTransition: (view, previousView) => {
        assert.equal(view.players.find((player) => player.id === previousView.currentTurnId).handCount, 4);
        assert.equal(view.currentTurnId, beta.user.id);
        assert.equal(view.players.find((player) => player.id === beta.user.id).handCount, 5);
      },
    },
  ];

  for (const scenario of scenarios) {
    console.log(`Runtime E2E distinct: ${scenario.gameKey}`);
    const playerCount = scenario.playerCount ?? 2;
    const activeClients = clients.slice(0, playerCount);
    const lobby = (await emitAndWait(
      alphaSocket,
      'lobby:create',
      { gameType: 'distinct', gameKey: scenario.gameKey, maxPlayers: 8 },
      'lobby:state',
      (payload) => payload.lobby?.gameKey === scenario.gameKey,
      `${scenario.gameKey}: create lobby`,
    )).lobby;
    assert.equal(lobby.gameType, 'distinct');
    assert.equal(lobby.gameKey, scenario.gameKey);
    assert.equal(lobby.maxPlayers, scenario.expectedMaxPlayers ?? 2);
    for (const client of activeClients.slice(1)) {
      await joinAndReady(alphaSocket, client.socket, lobby.code, client.user.id);
    }
    if (PARTNERSHIP_GAMES.has(scenario.gameKey)) {
      await choosePartnershipTeams(activeClients, lobby.code, alphaSocket);
    }

    const statePromises = activeClients.map((client) => waitForEvent(
      client.socket,
      'distinct:state',
      (payload) => payload.gameKey === scenario.gameKey,
    ));
    alphaSocket.emit('lobby:start_game');
    const playerStates = await Promise.all(statePromises);
    if (scenario.gameKey === 'hearts') console.log('Runtime E2E hearts: initial views received');
    const initialState = playerStates[0];
    const betaInitial = playerStates[1];
    if (scenario.gameKey !== 'grid-salvo' && !scenario.skipInitialTurnAssertion) {
      assert.equal(
        initialState.view.currentTurnId,
        alpha.user.id,
        `${scenario.gameKey} should start with the host action`,
      );
    }
    scenario.assertInitial?.(
      initialState.view,
      betaInitial.view,
      playerStates.map((state) => state.view),
    );

    const actorId = scenario.actorFromView?.(initialState.view) ?? alpha.user.id;
    let actor = activeClients.find((client) => client.user.id === actorId);
    assert(actor, `${scenario.gameKey} action player should be connected`);

    const actionState = scenario.prepare
      ? await scenario.prepare({ initialState, betaInitial, playerStates, lobby, actor })
      : initialState;
    const preparedActorId = scenario.actorFromView?.(actionState.view) ?? actor.user.id;
    actor = activeClients.find((client) => client.user.id === preparedActorId);
    assert(actor, `${scenario.gameKey} prepared action player should be connected`);
    const actorState = actionState.view.youId === actor.user.id
      ? actionState
      : await requestGameState(actor.socket, lobby.code, 'distinct:state');
    const action = typeof scenario.action === 'function'
      ? scenario.action(actorState.view)
      : scenario.action;

    const observer = activeClients.find((client) => client.user.id !== actor.user.id) ?? actor;
    const transitioned = waitForEvent(
      observer.socket,
      'distinct:state',
      (payload) =>
        payload.gameId === initialState.gameId &&
        payload.gameKey === scenario.gameKey &&
        (scenario.isTransition?.(payload.view, actorState.view) ?? true),
    );
    actor.socket.emit('distinct:action', {
      gameId: initialState.gameId,
      lobbyCode: lobby.code,
      action,
    });
    const nextState = await transitioned;
    if (scenario.gameKey === 'hearts') console.log('Runtime E2E hearts: first trick card accepted');
    scenario.assertTransition(nextState.view, actorState.view);
    await scenario.afterTransition?.({
      initialState,
      nextState,
      actorState,
      playerStates,
      lobby,
      activeClients,
    });

    const resultPromise = waitForEvent(
      observer.socket,
      'distinct:result',
      (payload) => payload.gameId === initialState.gameId,
    );
    actor.socket.emit('game:surrender', {
      gameId: initialState.gameId,
      lobbyCode: lobby.code,
    });
    const result = await resultPromise;
    if (scenario.gameKey === 'hearts') console.log('Runtime E2E hearts: surrender result received');
    assert.equal(result.gameKey, scenario.gameKey);
    assert.equal(result.result.reason, 'surrender');
    assert.notEqual(result.result.winnerId, actor.user.id);

    if (scenario.gameKey === 'reversi') {
      await verifyDistinctRematch(
        lobby.code,
        initialState.gameId,
        alpha,
        beta,
        alphaSocket,
        betaSocket,
      );
    }

    for (const client of activeClients.slice(1)) {
      await leaveLobbyAndWait(client.socket, lobby.code);
    }
    await leaveLobbyAndWait(alphaSocket, lobby.code);
  }

  await verifyContractBridge(clients);
}

async function verifyContractBridge(clients) {
  console.log('Runtime E2E distinct: contract-bridge');
  const host = clients[0];
  const lobby = (await emitAndWait(
    host.socket,
    'lobby:create',
    { gameType: 'distinct', gameKey: 'contract-bridge', maxPlayers: 8 },
    'lobby:state',
    (payload) => payload.lobby?.gameKey === 'contract-bridge',
  )).lobby;
  assert.equal(lobby.maxPlayers, 4);
  for (const client of clients.slice(1)) {
    await joinAndReady(host.socket, client.socket, lobby.code, client.user.id);
  }
  await choosePartnershipTeams(clients, lobby.code, host.socket);

  const initialPromises = clients.map((client) => waitForEvent(
    client.socket,
    'distinct:state',
    (payload) => payload.gameKey === 'contract-bridge',
  ));
  host.socket.emit('lobby:start_game');
  const initialStates = await Promise.all(initialPromises);
  const gameId = initialStates[0].gameId;
  assert(initialStates.every((state) => state.view.phase === 'setup'));
  assert(initialStates.every((state) => state.view.yourHand.length === 0));

  const dealt = await emitDistinctActionAndWait(
    host.socket,
    clients[1].socket,
    {
      gameId,
      lobbyCode: lobby.code,
      action: { type: 'select_bridge_mode', mode: 'duplicate' },
    },
    (payload) => payload.gameId === gameId && payload.view?.phase === 'auction',
  );
  assert.equal(dealt.view.dealNumber, 1);
  const privateStates = await Promise.all(clients.map((client) =>
    requestGameState(client.socket, lobby.code, 'distinct:state')));
  assert(privateStates.every((state) => state.view.yourHand.length === 13));
  for (let viewer = 0; viewer < privateStates.length; viewer += 1) {
    const serialized = JSON.stringify(privateStates[viewer].view);
    for (let owner = 0; owner < privateStates.length; owner += 1) {
      if (owner === viewer) continue;
      for (const hiddenCard of privateStates[owner].view.yourHand) {
        assert.equal(serialized.includes(`"${hiddenCard.id}"`), false);
      }
    }
  }

  const returning = clients[3];
  const returningBefore = privateStates[3].view;
  const detached = await emitAndWait(
    returning.socket,
    'lobby:leave',
    undefined,
    'lobby:left',
    (payload) => payload.lobbyCode === lobby.code && payload.seatPreserved === true,
    `${lobby.code}: detach active Bridge seat`,
  );
  assert.equal(detached.seatPreserved, true);
  await emitAndWait(
    returning.socket,
    'lobby:join',
    { code: lobby.code },
    'lobby:game_starting',
    (payload) => payload.lobbyCode === lobby.code,
    `${lobby.code}: rejoin active Bridge seat`,
  );
  const returningAfter = await requestGameState(
    returning.socket,
    lobby.code,
    'distinct:state',
  );
  assert.deepEqual(
    returningAfter.view.yourHand.map((card) => card.id),
    returningBefore.yourHand.map((card) => card.id),
  );
  assert.equal(returningAfter.view.dealNumber, returningBefore.dealNumber);
  assert.deepEqual(returningAfter.view.sessionScores, returningBefore.sessionScores);
  assert.deepEqual(returningAfter.view.auction, returningBefore.auction);

  await emitDistinctActionExpectError(
    host.socket,
    {
      gameId,
      lobbyCode: lobby.code,
      action: { type: 'bridge_call', call: { type: 'double' } },
    },
    'Double is not legal',
  );

  const auction = [
    { client: clients[0], call: { type: 'bid', level: 1, strain: 'hearts' } },
    { client: clients[1], call: { type: 'double' } },
    { client: clients[2], call: { type: 'redouble' } },
    { client: clients[3], call: { type: 'pass' } },
    { client: clients[0], call: { type: 'pass' } },
    { client: clients[1], call: { type: 'pass' } },
  ];
  let latest = dealt;
  for (const [index, step] of auction.entries()) {
    const observer = clients.find((client) => client !== step.client);
    latest = await emitDistinctActionAndWait(
      step.client.socket,
      observer.socket,
      {
        gameId,
        lobbyCode: lobby.code,
        action: { type: 'bridge_call', call: step.call },
      },
      (payload) =>
        payload.gameId === gameId
        && payload.view?.auction?.length === index + 1
        && (index < auction.length - 1 || payload.view?.phase === 'opening_lead'),
    );
  }
  assert.equal(latest.view.phase, 'opening_lead');
  assert.equal(latest.view.contract.doubling, 'redoubled');
  assert.equal(latest.view.contract.declarerId, clients[0].user.id);
  assert.equal(latest.view.contract.dummyId, clients[2].user.id);

  const beforeLead = await Promise.all(clients.map((client) =>
    requestGameState(client.socket, lobby.code, 'distinct:state')));
  const dummyCards = beforeLead[2].view.yourHand;
  for (const viewer of [0, 1, 3]) {
    const serialized = JSON.stringify(beforeLead[viewer].view);
    assert.equal(beforeLead[viewer].view.dummyHand.length, 0);
    assert(dummyCards.every((entry) => !serialized.includes(`"${entry.id}"`)));
  }

  const eastHand = beforeLead[1].view.yourHand;
  const westHand = beforeLead[3].view.yourHand;
  const openingCard = eastHand.find((candidate) =>
    westHand.some((entry) => entry.suit === candidate.suit)
      && westHand.some((entry) => entry.suit !== candidate.suit),
  ) ?? eastHand[0];
  latest = await emitDistinctActionAndWait(
    clients[1].socket,
    clients[0].socket,
    {
      gameId,
      lobbyCode: lobby.code,
      action: { type: 'play_bridge_card', cardId: openingCard.id },
    },
    (payload) => payload.gameId === gameId && payload.view?.dummyRevealed === true,
  );
  assert.equal(latest.view.currentActorId, clients[0].user.id);
  assert.equal(latest.view.dummyHand.length, 13);

  const dummyAfterLead = await requestGameState(
    clients[2].socket,
    lobby.code,
    'distinct:state',
  );
  const defenderAfterLead = await requestGameState(
    clients[3].socket,
    lobby.code,
    'distinct:state',
  );
  assert.equal(dummyAfterLead.view.partnerHand.length, 13);
  assert.equal(defenderAfterLead.view.partnerHand.length, 0);

  const immediateUndo = await emitDistinctActionAndWait(
    clients[1].socket,
    clients[0].socket,
    {
      gameId,
      lobbyCode: lobby.code,
      action: { type: 'bridge_request_undo' },
    },
    (payload) => payload.gameId === gameId
      && payload.view?.phase === 'opening_lead'
      && payload.view?.dummyRevealed === false,
  );
  assert.equal(immediateUndo.view.undoRequest, null);
  const restoredLeader = await requestGameState(
    clients[1].socket,
    lobby.code,
    'distinct:state',
  );
  assert(restoredLeader.view.yourHand.some((card) => card.id === openingCard.id));

  latest = await emitDistinctActionAndWait(
    clients[1].socket,
    clients[0].socket,
    {
      gameId,
      lobbyCode: lobby.code,
      action: { type: 'play_bridge_card', cardId: openingCard.id },
    },
    (payload) => payload.gameId === gameId && payload.view?.dummyRevealed === true,
  );

  await emitDistinctActionExpectError(
    clients[2].socket,
    {
      gameId,
      lobbyCode: lobby.code,
      action: { type: 'play_bridge_card', cardId: dummyCards[0].id },
    },
    'Not your turn',
  );
  let actorState = await requestGameState(clients[0].socket, lobby.code, 'distinct:state');
  latest = await emitDistinctActionAndWait(
    clients[0].socket,
    clients[1].socket,
    {
      gameId,
      lobbyCode: lobby.code,
      action: { type: 'play_bridge_card', cardId: actorState.view.legalCardIds[0] },
    },
    (payload) => payload.gameId === gameId && payload.view?.trick?.length === 2,
  );

  const undoRequested = await emitDistinctActionAndWait(
    clients[1].socket,
    clients[2].socket,
    {
      gameId,
      lobbyCode: lobby.code,
      action: { type: 'bridge_request_undo' },
    },
    (payload) => payload.gameId === gameId
      && payload.view?.undoRequest?.requesterId === clients[1].user.id,
  );
  assert.equal(undoRequested.view.canAct, false);
  const approvers = [clients[0], clients[2], clients[3]];
  for (const [index, approver] of approvers.entries()) {
    const finalApproval = index === approvers.length - 1;
    latest = await emitDistinctActionAndWait(
      approver.socket,
      clients[1].socket,
      {
        gameId,
        lobbyCode: lobby.code,
        action: { type: 'bridge_respond_undo', approved: true },
      },
      (payload) => payload.gameId === gameId && (
        finalApproval
          ? payload.view?.phase === 'opening_lead'
            && payload.view?.dummyRevealed === false
            && payload.view?.undoRequest === null
          : payload.view?.undoRequest?.approvals?.length === index + 1
      ),
    );
  }

  latest = await emitDistinctActionAndWait(
    clients[1].socket,
    clients[0].socket,
    {
      gameId,
      lobbyCode: lobby.code,
      action: { type: 'play_bridge_card', cardId: openingCard.id },
    },
    (payload) => payload.gameId === gameId && payload.view?.dummyRevealed === true,
  );
  actorState = await requestGameState(clients[0].socket, lobby.code, 'distinct:state');
  latest = await emitDistinctActionAndWait(
    clients[0].socket,
    clients[1].socket,
    {
      gameId,
      lobbyCode: lobby.code,
      action: { type: 'play_bridge_card', cardId: actorState.view.legalCardIds[0] },
    },
    (payload) => payload.gameId === gameId && payload.view?.trick?.length === 2,
  );

  const westState = await requestGameState(clients[3].socket, lobby.code, 'distinct:state');
  const illegalWestCard = westState.view.yourHand.find((entry) =>
    !westState.view.legalCardIds.includes(entry.id));
  if (illegalWestCard) {
    await emitDistinctActionExpectError(
      clients[3].socket,
      {
        gameId,
        lobbyCode: lobby.code,
        action: { type: 'play_bridge_card', cardId: illegalWestCard.id },
      },
      'Must follow suit',
    );
  }

  let safety = 0;
  while (latest.view.phase === 'playing' || latest.view.phase === 'opening_lead') {
    safety += 1;
    assert(safety <= 52, 'Bridge deal should complete within 52 card plays');
    if (latest.view.trickDisplayUntil > Date.now()) {
      await delay(latest.view.trickDisplayUntil - Date.now() + 50);
    }
    const cardsRemaining = latest.view.players.reduce(
      (sum, player) => sum + player.handCount,
      0,
    );
    if (cardsRemaining === 4) {
      latest = await waitForEvent(
        clients[0].socket,
        'distinct:state',
        (payload) => payload.gameId === gameId
          && payload.view?.phase === 'deal_complete',
        'Bridge final forced-card autoplay',
      );
      break;
    }
    const actor = clients.find((client) => client.user.id === latest.view.currentActorId);
    assert(actor, 'Bridge current actor should be connected');
    actorState = await requestGameState(actor.socket, lobby.code, 'distinct:state');
    const cardId = actorState.view.legalCardIds[0];
    assert(cardId, 'Bridge actor should receive at least one legal card');
    const observer = clients.find((client) => client.user.id !== actor.user.id);
    latest = await emitDistinctActionAndWait(
      actor.socket,
      observer.socket,
      {
        gameId,
        lobbyCode: lobby.code,
        action: { type: 'play_bridge_card', cardId },
      },
      (payload) => payload.gameId === gameId,
    );
  }
  assert.equal(latest.view.phase, 'deal_complete');
  assert.equal(latest.view.dealHistory.length, 1);
  assert.equal(latest.view.tricksWon[0] + latest.view.tricksWon[1], 13);
  assert.notEqual(latest.view.sessionScores[0], 0);
  const sessionScores = [...latest.view.sessionScores];

  const nextDeal = await emitDistinctActionAndWait(
    host.socket,
    clients[1].socket,
    {
      gameId,
      lobbyCode: lobby.code,
      action: { type: 'next_bridge_deal' },
    },
    (payload) => payload.gameId === gameId && payload.view?.dealNumber === 2,
  );
  assert.deepEqual(nextDeal.view.sessionScores, sessionScores);
  assert.equal(nextDeal.view.dealerId, clients[1].user.id);
  assert.deepEqual(nextDeal.view.vulnerability, [true, false]);

  const concessionAuction = [
    { client: clients[1], call: { type: 'bid', level: 1, strain: 'clubs' } },
    { client: clients[2], call: { type: 'pass' } },
    { client: clients[3], call: { type: 'pass' } },
    { client: clients[0], call: { type: 'pass' } },
  ];
  for (const [index, step] of concessionAuction.entries()) {
    await emitDistinctActionAndWait(
      step.client.socket,
      clients.find((client) => client !== step.client).socket,
      {
        gameId,
        lobbyCode: lobby.code,
        action: { type: 'bridge_call', call: step.call },
      },
      (payload) => payload.gameId === gameId
        && payload.view?.auction?.length === index + 1
        && (index < concessionAuction.length - 1 || payload.view?.phase === 'opening_lead'),
    );
  }
  const firstVote = await emitDistinctActionAndWait(
    clients[0].socket,
    clients[1].socket,
    {
      gameId,
      lobbyCode: lobby.code,
      action: { type: 'bridge_surrender_vote', confirmed: true },
    },
    (payload) => payload.gameId === gameId
      && payload.view?.surrenderVotes?.[0]?.includes(clients[0].user.id),
  );
  assert.equal(firstVote.view.phase, 'opening_lead');
  const conceded = await emitDistinctActionAndWait(
    clients[2].socket,
    clients[1].socket,
    {
      gameId,
      lobbyCode: lobby.code,
      action: { type: 'bridge_surrender_vote', confirmed: true },
    },
    (payload) => payload.gameId === gameId
      && payload.view?.phase === 'deal_complete'
      && payload.view?.dealHistory?.length === 2,
  );
  assert.deepEqual(conceded.view.tricksWon, [0, 13]);
  assert.equal(conceded.view.dealHistory.at(-1).concededByTeam, 0);
  assert.notDeepEqual(conceded.view.sessionScores, sessionScores);
}

async function verifyDistinctRematch(code, previousGameId, alpha, beta, alphaSocket, betaSocket) {
  const alphaFreshPromise = waitForEvent(
    alphaSocket,
    'distinct:state',
    (payload) => payload.gameKey === 'reversi' && payload.gameId !== previousGameId,
  );
  const betaFreshPromise = waitForEvent(
    betaSocket,
    'distinct:state',
    (payload) => payload.gameKey === 'reversi' && payload.gameId !== previousGameId,
  );
  const firstVote = waitForEvent(
    betaSocket,
    'lobby:rematch_state',
    (payload) => payload.requestedBy?.includes(alpha.user.id),
  );
  alphaSocket.emit('lobby:rematch_request', { lobbyCode: code });
  await firstVote;
  betaSocket.emit('lobby:rematch_request', { lobbyCode: code });
  const [alphaFresh, betaFresh] = await Promise.all([
    alphaFreshPromise,
    betaFreshPromise,
  ]);
  assert.equal(alphaFresh.gameId, betaFresh.gameId);
  assert.equal(alphaFresh.view.board.filter(Boolean).length, 4);

  const finished = waitForEvent(
    betaSocket,
    'distinct:result',
    (payload) => payload.gameId === alphaFresh.gameId,
  );
  alphaSocket.emit('game:surrender', {
    gameId: alphaFresh.gameId,
    lobbyCode: code,
  });
  await finished;
}

async function verifyVoiceRelay(alphaSocket, betaSocket) {
  const roomId = `voice-${String(Date.now()).slice(-6)}`;
  await emitAndWait(
    alphaSocket,
    'voice:join',
    { roomId },
    'voice:peer_joined',
  );
  const betaPeersPromise = waitForEvent(
    betaSocket,
    'voice:peer_joined',
    (payload) => payload.peers?.some((peer) => peer.socketId === alphaSocket.id),
  );
  betaSocket.emit('voice:join', { roomId });
  await betaPeersPromise;

  const offerPromise = waitForEvent(
    alphaSocket,
    'voice:offer',
    (payload) => payload.socketId === betaSocket.id,
  );
  betaSocket.emit('voice:offer', {
    targetSocketId: alphaSocket.id,
    offer: { type: 'offer', sdp: 'v=0\r\n' },
  });
  const offer = await offerPromise;
  assert.equal(offer.offer.type, 'offer');
  alphaSocket.emit('voice:leave', { roomId });
  betaSocket.emit('voice:leave', { roomId });
}

function assertPrivateUnoView(payload, userId) {
  assert.equal(payload.view.youId, userId);
  assert.equal(payload.view.yourHand.length, 7);
  for (const player of payload.view.players) {
    assert.equal(Object.prototype.hasOwnProperty.call(player, 'hand'), false);
  }
}

async function joinAndReady(hostSocket, guestSocket, code, guestId) {
  const joined = waitForEvent(
    hostSocket,
    'lobby:state',
    (payload) => payload.lobby?.players?.some((player) => player.id === guestId),
    `${code}: join ${guestId}`,
  );
  guestSocket.emit('lobby:join', { code });
  await joined;
  const ready = waitForEvent(
    hostSocket,
    'lobby:state',
    (payload) => payload.lobby?.players?.find((player) => player.id === guestId)?.isReady,
    `${code}: ready ${guestId}`,
  );
  guestSocket.emit('lobby:player_ready', { ready: true });
  await ready;
}

async function leaveLobbyAndWait(socket, code) {
  await emitAndWait(
    socket,
    'lobby:leave',
    undefined,
    'lobby:left',
    (payload) => payload?.lobbyCode === code,
    `${code}: leave lobby`,
  );
}

async function choosePartnershipTeams(clients, code, observerSocket) {
  const teams = [0, 1, 0, 1];
  for (let index = 0; index < clients.length; index += 1) {
    const client = clients[index];
    const selected = waitForEvent(
      observerSocket,
      'lobby:state',
      (payload) => payload.lobby?.code === code
        && payload.lobby.players.find((player) => player.id === client.user.id)?.team === teams[index],
      `${code}: team ${teams[index]} for ${client.user.id}`,
    );
    client.socket.emit('lobby:team_select', { team: teams[index] });
    await selected;
  }
  for (const client of clients.slice(1)) {
    const ready = waitForEvent(
      observerSocket,
      'lobby:state',
      (payload) => payload.lobby?.code === code
        && payload.lobby.players.find((player) => player.id === client.user.id)?.isReady === true,
      `${code}: re-ready ${client.user.id}`,
    );
    client.socket.emit('lobby:player_ready', { ready: true });
    await ready;
  }
}

async function requestGameState(socket, lobbyCode, event) {
  return emitAndWait(
    socket,
    'game:request_state',
    { lobbyCode },
    event,
  );
}

async function moveAndWait(actor, observer, event, payload, stateEvent, predicate) {
  const state = waitForEvent(observer, stateEvent, predicate);
  actor.emit(event, payload);
  return state;
}

async function login(username) {
  const response = await fetch(`${API_URL}/auth/guest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  if (!response.ok) throw new Error(`Guest login failed with HTTP ${response.status}`);
  const payload = await response.json();
  assert(payload.user?.id);
  assert(payload.token);
  return payload;
}

async function connect(token) {
  const socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: false,
    forceNew: true,
  });
  await waitForEvent(socket, 'connect');
  return socket;
}

function emitAndWait(socket, emitEvent, payload, resultEvent, predicate, label) {
  const result = waitForEvent(socket, resultEvent, predicate, label);
  socket.emit(emitEvent, payload);
  return result;
}

function emitDistinctActionAndWait(actor, observer, payload, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for distinct:state'));
    }, TIMEOUT_MS);
    const onState = (state) => {
      if (!predicate(state)) return;
      cleanup();
      resolve(state);
    };
    const onError = (error) => {
      cleanup();
      reject(new Error(`Distinct action rejected: ${error?.message ?? String(error)}`));
    };
    const cleanup = () => {
      clearTimeout(timer);
      observer.off('distinct:state', onState);
      actor.off('distinct:error', onError);
    };
    observer.on('distinct:state', onState);
    actor.on('distinct:error', onError);
    actor.emit('distinct:action', payload);
  });
}

function emitDistinctActionExpectError(actor, payload, expectedMessage) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for distinct:error'));
    }, TIMEOUT_MS);
    const onError = (error) => {
      if (error?.message !== expectedMessage) return;
      cleanup();
      resolve(error);
    };
    const cleanup = () => {
      clearTimeout(timer);
      actor.off('distinct:error', onError);
    };
    actor.on('distinct:error', onError);
    actor.emit('distinct:action', payload);
  });
}

function waitForEvent(socket, event, predicate = () => true, label = event) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${label}`));
    }, TIMEOUT_MS);
    const onEvent = (payload) => {
      if (!predicate(payload)) return;
      cleanup();
      resolve(payload);
    };
    const onError = (error) => {
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    };
    const cleanup = () => {
      clearTimeout(timer);
      socket.off(event, onEvent);
      socket.off('connect_error', onError);
    };
    socket.on(event, onEvent);
    socket.on('connect_error', onError);
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});