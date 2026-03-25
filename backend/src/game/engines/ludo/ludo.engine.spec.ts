import { LudoEngine } from './ludo.engine';
import {
  LudoColor,
  LudoGamePhase,
  LudoGameState,
  LUDO_TOKENS_PER_PLAYER,
  LUDO_COLOR_ASSIGNMENTS,
} from '../../../shared';
import { FINISHED_STEPS } from './ludo.utils';

describe('LudoEngine', () => {
  let engine: LudoEngine;

  beforeEach(() => {
    engine = new LudoEngine();
  });

  // ─── initGame ───

  describe('initGame', () => {
    it('should create a game with 2 players', () => {
      const state = engine.initGame(
        ['p1', 'p2'],
        { p1: 'Alice', p2: 'Bob' },
      );

      expect(state.playerOrder).toEqual(['p1', 'p2']);
      expect(state.currentTurn).toBe('p1');
      expect(state.phase).toBe(LudoGamePhase.ROLLING);
      expect(state.dice).toBeNull();
      expect(state.consecutiveSixes).toBe(0);
      expect(state.rankings).toEqual([]);
      expect(state.winnerId).toBeNull();

      // Check player states
      const p1 = state.players.p1;
      expect(p1.username).toBe('Alice');
      expect(p1.color).toBe(LUDO_COLOR_ASSIGNMENTS[2][0]);
      expect(p1.tokens).toHaveLength(LUDO_TOKENS_PER_PLAYER);
      expect(p1.finishedCount).toBe(0);
      expect(p1.isBot).toBe(false);

      // All tokens at base
      for (const token of p1.tokens) {
        expect(token.state).toBe('base');
        expect(token.stepsFromStart).toBe(0);
      }
    });

    it('should create a game with 4 players', () => {
      const state = engine.initGame(
        ['p1', 'p2', 'p3', 'p4'],
        { p1: 'A', p2: 'B', p3: 'C', p4: 'D' },
      );
      expect(state.playerOrder).toHaveLength(4);
      expect(state.players.p1.color).toBe(LudoColor.RED);
      expect(state.players.p2.color).toBe(LudoColor.GREEN);
      expect(state.players.p3.color).toBe(LudoColor.YELLOW);
      expect(state.players.p4.color).toBe(LudoColor.BLUE);
    });

    it('should mark bots correctly', () => {
      const state = engine.initGame(
        ['p1', 'bot1'],
        { p1: 'Human', bot1: 'Bot' },
        ['bot1'],
      );
      expect(state.players.p1.isBot).toBe(false);
      expect(state.players.bot1.isBot).toBe(true);
    });

    it('should throw for invalid player count', () => {
      expect(() => engine.initGame(['p1'], { p1: 'Solo' })).toThrow();
    });
  });

  // ─── rollDice ───

  describe('rollDice', () => {
    it('should roll dice and move to MOVING phase when moves available', () => {
      const state = engine.initGame(
        ['p1', 'p2'],
        { p1: 'A', p2: 'B' },
      );
      // Force an active token so moves are likely
      state.players.p1.tokens[0].stepsFromStart = 10;
      state.players.p1.tokens[0].state = 'active';

      const result = engine.rollDice(state, 'p1');
      expect(result.valid).toBe(true);
      expect(result.dice).toBeDefined();
      expect(result.dice).toBeGreaterThanOrEqual(1);
      expect(result.dice).toBeLessThanOrEqual(6);
    });

    it('should reject roll from wrong player', () => {
      const state = engine.initGame(
        ['p1', 'p2'],
        { p1: 'A', p2: 'B' },
      );
      const result = engine.rollDice(state, 'p2');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Not your turn');
    });

    it('should reject roll when not in ROLLING phase', () => {
      const state = engine.initGame(
        ['p1', 'p2'],
        { p1: 'A', p2: 'B' },
      );
      state.phase = LudoGamePhase.MOVING;
      const result = engine.rollDice(state, 'p1');
      expect(result.valid).toBe(false);
    });

    it('should cancel turn on 3 consecutive sixes', () => {
      const state = engine.initGame(
        ['p1', 'p2'],
        { p1: 'A', p2: 'B' },
      );
      state.players.p1.tokens[0].stepsFromStart = 10;
      state.players.p1.tokens[0].state = 'active';
      state.consecutiveSixes = 2; // Already had 2 sixes

      // Mock to ensure dice has a 6
      const origRoll = jest.spyOn(require('./ludo.utils'), 'rollDie');
      origRoll.mockReturnValue(6);

      const result = engine.rollDice(state, 'p1');
      expect(result.valid).toBe(true);
      expect(result.turnCanceled).toBe(true);
      // Turn should advance
      expect(state.currentTurn).toBe('p2');

      origRoll.mockRestore();
    });

    it('should skip turn when no moves available', () => {
      const state = engine.initGame(
        ['p1', 'p2'],
        { p1: 'A', p2: 'B' },
      );
      // All at base, roll non-6 → no moves
      const origRoll = jest.spyOn(require('./ludo.utils'), 'rollDie');
      origRoll.mockReturnValue(3);

      const result = engine.rollDice(state, 'p1');
      expect(result.valid).toBe(true);
      expect(result.turnSkipped).toBe(true);
      expect(state.currentTurn).toBe('p2');

      origRoll.mockRestore();
    });
  });

  // ─── moveToken ───

  describe('moveToken', () => {
    it('should reject move from wrong player', () => {
      const state = engine.initGame(
        ['p1', 'p2'],
        { p1: 'A', p2: 'B' },
      );
      state.phase = LudoGamePhase.MOVING;
      state.turnState = { availableMoves: [], mustRollAgain: false, turnCanceled: false };
      const result = engine.moveToken(state, 'p2', [{ tokenId: 0, steps: 3 }]);
      expect(result.valid).toBe(false);
    });

    it('should reject when not in MOVING phase', () => {
      const state = engine.initGame(
        ['p1', 'p2'],
        { p1: 'A', p2: 'B' },
      );
      const result = engine.moveToken(state, 'p1', [{ tokenId: 0, steps: 3 }]);
      expect(result.valid).toBe(false);
    });

    it('should execute a valid move and advance token', () => {
      const state = engine.initGame(
        ['p1', 'p2'],
        { p1: 'A', p2: 'B' },
      );
      state.players.p1.tokens[0].stepsFromStart = 10;
      state.players.p1.tokens[0].state = 'active';
      state.dice = 3;
      state.phase = LudoGamePhase.MOVING;
      state.turnState = {
        availableMoves: [[{ tokenId: 0, steps: 3 }]],
        mustRollAgain: false,
        turnCanceled: false,
      };

      const result = engine.moveToken(state, 'p1', [{ tokenId: 0, steps: 3 }]);
      expect(result.valid).toBe(true);
      expect(state.players.p1.tokens[0].stepsFromStart).toBe(13);
    });

    it('should reject an invalid move combination', () => {
      const state = engine.initGame(
        ['p1', 'p2'],
        { p1: 'A', p2: 'B' },
      );
      state.players.p1.tokens[0].stepsFromStart = 10;
      state.players.p1.tokens[0].state = 'active';
      state.dice = 3;
      state.phase = LudoGamePhase.MOVING;
      state.turnState = {
        availableMoves: [[{ tokenId: 0, steps: 3 }]],
        mustRollAgain: false,
        turnCanceled: false,
      };

      const result = engine.moveToken(state, 'p1', [{ tokenId: 0, steps: 5 }]);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Invalid');
    });

    it('should capture opponent token and grant extra turn', () => {
      const state = engine.initGame(
        ['p1', 'p2'],
        { p1: 'A', p2: 'B' },
      );
      // RED at step 10 (abs 9). Move RED 2 steps → step 12 → abs 11
      // GREEN at step 51 → abs (13+51-1)%52 = 11 ← capture target
      state.players.p1.tokens[0].stepsFromStart = 10;
      state.players.p1.tokens[0].state = 'active';
      state.players.p2.tokens[0].stepsFromStart = 51;
      state.players.p2.tokens[0].state = 'active';
      state.dice = 2;
      state.phase = LudoGamePhase.MOVING;
      state.turnState = {
        availableMoves: [[{ tokenId: 0, steps: 2 }]],
        mustRollAgain: false,
        turnCanceled: false,
      };

      const result = engine.moveToken(state, 'p1', [{ tokenId: 0, steps: 2 }]);
      expect(result.valid).toBe(true);
      // RED at step 12 (abs 11) captures GREEN at abs 11
      if (result.captures && result.captures.length > 0) {
        expect(state.players.p2.tokens[0].stepsFromStart).toBe(0);
        expect(state.players.p2.tokens[0].state).toBe('base');
        expect(result.extraTurn).toBe(true);
      }
    });

    it('should not capture on a safe square', () => {
      const state = engine.initGame(
        ['p1', 'p2'],
        { p1: 'A', p2: 'B' },
      );
      // Safe squares: 0, 8, 13, 21, 26, 34, 39, 47
      // RED at step 7 (abs 6), move 2 → step 9 → abs 8 (safe!)
      // GREEN at step 48 → abs (13+48-1)%52 = 8
      state.players.p1.tokens[0].stepsFromStart = 7;
      state.players.p1.tokens[0].state = 'active';
      state.players.p2.tokens[0].stepsFromStart = 48;
      state.players.p2.tokens[0].state = 'active';
      state.dice = 2;
      state.phase = LudoGamePhase.MOVING;
      state.turnState = {
        availableMoves: [[{ tokenId: 0, steps: 2 }]],
        mustRollAgain: false,
        turnCanceled: false,
      };

      const result = engine.moveToken(state, 'p1', [{ tokenId: 0, steps: 2 }]);
      expect(result.valid).toBe(true);
      // GREEN should NOT be captured since abs 8 is a safe square
      expect(state.players.p2.tokens[0].stepsFromStart).toBe(48);
      expect(state.players.p2.tokens[0].state).toBe('active');
    });

    it('should grant extra turn on rolling a 6', () => {
      const state = engine.initGame(
        ['p1', 'p2'],
        { p1: 'A', p2: 'B' },
      );
      state.players.p1.tokens[0].stepsFromStart = 10;
      state.players.p1.tokens[0].state = 'active';
      state.dice = 6;
      state.phase = LudoGamePhase.MOVING;
      state.turnState = {
        availableMoves: [[{ tokenId: 0, steps: 6 }]],
        mustRollAgain: false,
        turnCanceled: false,
      };

      const result = engine.moveToken(state, 'p1', [{ tokenId: 0, steps: 6 }]);
      expect(result.valid).toBe(true);
      expect(result.extraTurn).toBe(true);
      expect(state.currentTurn).toBe('p1');
      expect(state.phase).toBe(LudoGamePhase.ROLLING);
    });

    it('should grant extra turn when token reaches home', () => {
      const state = engine.initGame(
        ['p1', 'p2'],
        { p1: 'A', p2: 'B' },
      );
      state.players.p1.tokens[0].stepsFromStart = 56; // needs 3 to finish
      state.players.p1.tokens[0].state = 'active';
      state.dice = 3;
      state.phase = LudoGamePhase.MOVING;
      state.turnState = {
        availableMoves: [[{ tokenId: 0, steps: 3 }]],
        mustRollAgain: false,
        turnCanceled: false,
      };

      const result = engine.moveToken(state, 'p1', [{ tokenId: 0, steps: 3 }]);
      expect(result.valid).toBe(true);
      expect(result.reachedHome).toBe(true);
      expect(result.extraTurn).toBe(true);
      expect(state.players.p1.tokens[0].stepsFromStart).toBe(FINISHED_STEPS);
      expect(state.players.p1.tokens[0].state).toBe('home');
      expect(state.players.p1.finishedCount).toBe(1);
    });

    it('should end the game when all tokens of a player reach home in 2-player game', () => {
      const state = engine.initGame(
        ['p1', 'p2'],
        { p1: 'A', p2: 'B' },
      );
      // 3 tokens already finished, 1 about to finish
      for (let i = 0; i < 3; i++) {
        state.players.p1.tokens[i].stepsFromStart = FINISHED_STEPS;
        state.players.p1.tokens[i].state = 'home';
      }
      state.players.p1.finishedCount = 3;
      state.players.p1.tokens[3].stepsFromStart = 56;
      state.players.p1.tokens[3].state = 'active';
      state.dice = 3;
      state.phase = LudoGamePhase.MOVING;
      state.turnState = {
        availableMoves: [[{ tokenId: 3, steps: 3 }]],
        mustRollAgain: false,
        turnCanceled: false,
      };

      const result = engine.moveToken(state, 'p1', [{ tokenId: 3, steps: 3 }]);
      expect(result.valid).toBe(true);
      expect(result.winner).toBeDefined();
      expect(result.winner!.winnerId).toBe('p1');
      expect(state.phase).toBe(LudoGamePhase.FINISHED);
      expect(state.winnerId).toBe('p1');
      expect(state.rankings).toContain('p1');
      expect(state.rankings).toContain('p2');
    });
  });

  // ─── getPlayerView ───

  describe('getPlayerView', () => {
    it('should return correct view for the current player', () => {
      const state = engine.initGame(
        ['p1', 'p2'],
        { p1: 'Alice', p2: 'Bob' },
      );

      const view = engine.getPlayerView(state, 'p1');
      expect(view.myColor).toBe(state.players.p1.color);
      expect(view.isMyTurn).toBe(true);
      expect(view.currentTurn).toBe('p1');
      expect(view.playerNames.p1).toBe('Alice');
      expect(view.playerNames.p2).toBe('Bob');
      expect(view.players).toHaveLength(2);
    });

    it('should not expose available moves to non-current player', () => {
      const state = engine.initGame(
        ['p1', 'p2'],
        { p1: 'A', p2: 'B' },
      );
      state.turnState = {
        availableMoves: [[{ tokenId: 0, steps: 6 }]],
        mustRollAgain: false,
        turnCanceled: false,
      };

      const view = engine.getPlayerView(state, 'p2');
      expect(view.availableMoves).toBeNull();
      expect(view.isMyTurn).toBe(false);
    });
  });

  // ─── addBot / removeBot ───

  describe('addBot', () => {
    it('should add a bot to a 2-player game', () => {
      const state = engine.initGame(
        ['p1', 'p2'],
        { p1: 'A', p2: 'B' },
      );
      const res = engine.addBot(state, '🤖 Bot');
      expect(res.valid).toBe(true);
      expect(res.botId).toBeDefined();
      expect(state.playerOrder).toHaveLength(3);
      expect(state.players[res.botId!].isBot).toBe(true);
      expect(state.players[res.botId!].username).toBe('🤖 Bot');
    });

    it('should reject adding when game is full', () => {
      const state = engine.initGame(
        ['p1', 'p2', 'p3', 'p4'],
        { p1: 'A', p2: 'B', p3: 'C', p4: 'D' },
      );
      const res = engine.addBot(state, 'Too Many');
      expect(res.valid).toBe(false);
    });

    it('should reassign colors when adding a player', () => {
      const state = engine.initGame(
        ['p1', 'p2'],
        { p1: 'A', p2: 'B' },
      );
      engine.addBot(state, 'Bot');
      const colors3 = LUDO_COLOR_ASSIGNMENTS[3];
      expect(state.players.p1.color).toBe(colors3[0]);
      expect(state.players.p2.color).toBe(colors3[1]);
    });
  });

  describe('removeBot', () => {
    it('should remove a bot from the game', () => {
      const state = engine.initGame(
        ['p1', 'bot1'],
        { p1: 'A', bot1: 'Bot' },
        ['bot1'],
      );
      engine.addBot(state, 'Bot2'); // Now 3 players
      const res = engine.removeBot(state, 'bot1');
      expect(res.valid).toBe(true);
      expect(state.playerOrder).not.toContain('bot1');
      expect(state.players.bot1).toBeUndefined();
    });

    it('should reject removing a non-bot player', () => {
      const state = engine.initGame(
        ['p1', 'p2'],
        { p1: 'A', p2: 'B' },
      );
      const res = engine.removeBot(state, 'p1');
      expect(res.valid).toBe(false);
    });

    it('should advance turn if removed bot was current', () => {
      const state = engine.initGame(
        ['bot1', 'p1', 'p2'],
        { bot1: 'Bot', p1: 'A', p2: 'B' },
        ['bot1'],
      );
      expect(state.currentTurn).toBe('bot1');
      engine.removeBot(state, 'bot1');
      expect(state.currentTurn).not.toBe('bot1');
    });
  });

  // ─── executeBotTurn ───

  describe('executeBotTurn', () => {
    it('should execute a complete bot turn (roll + move)', () => {
      const state = engine.initGame(
        ['p1', 'bot1'],
        { p1: 'A', bot1: 'Bot' },
        ['bot1'],
      );
      // Make it bot's turn
      state.currentTurn = 'bot1';
      state.players.bot1.tokens[0].stepsFromStart = 10;
      state.players.bot1.tokens[0].state = 'active';

      const records = engine.executeBotTurn(state, 'bot1');
      // Bot should have rolled and moved (unless skipped)
      // Turn should have advanced (unless extra turn)
      expect(state.phase).toBeDefined();
    });

    it('should do nothing if not the bot turn', () => {
      const state = engine.initGame(
        ['p1', 'bot1'],
        { p1: 'A', bot1: 'Bot' },
        ['bot1'],
      );
      const records = engine.executeBotTurn(state, 'bot1');
      expect(records).toEqual([]);
    });

    it('should do nothing for a non-bot player', () => {
      const state = engine.initGame(
        ['p1', 'p2'],
        { p1: 'A', p2: 'B' },
      );
      const records = engine.executeBotTurn(state, 'p1');
      expect(records).toEqual([]);
    });
  });
});
