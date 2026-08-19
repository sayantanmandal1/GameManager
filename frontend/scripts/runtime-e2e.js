'use strict';

const assert = require('node:assert/strict');
const { io } = require('socket.io-client');

const API_URL = process.env.E2E_API_URL || 'http://127.0.0.1:8000';
const SOCKET_URL = process.env.E2E_SOCKET_URL || 'http://127.0.0.1:8000';
const TIMEOUT_MS = 10_000;

async function main() {
  const suffix = String(Date.now()).slice(-7);
  const alpha = await login(`Alpha${suffix}`);
  const beta = await login(`Beta${suffix}`);
  let alphaSocket = await connect(alpha.token);
  const betaSocket = await connect(beta.token);

  try {
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
    alphaSocket.disconnect();
    alphaSocket = await connect(alpha.token);

    await verifyLudoProjection(alpha, beta, alphaSocket, betaSocket);
    await verifyVoiceRelay(alphaSocket, betaSocket);

    console.log(
      'Runtime E2E passed: rematch, lobby, reconnect, Bingo, Ludo, Chess, Photobooth, UNO, TTT, Connect Four, voice.',
    );
  } finally {
    alphaSocket.disconnect();
    betaSocket.disconnect();
  }
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
  );
  guestSocket.emit('lobby:join', { code });
  await joined;
  const ready = waitForEvent(
    hostSocket,
    'lobby:state',
    (payload) => payload.lobby?.players?.find((player) => player.id === guestId)?.isReady,
  );
  guestSocket.emit('lobby:player_ready', { ready: true });
  await ready;
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

function emitAndWait(socket, emitEvent, payload, resultEvent, predicate) {
  const result = waitForEvent(socket, resultEvent, predicate);
  socket.emit(emitEvent, payload);
  return result;
}

function waitForEvent(socket, event, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${event}`));
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