import type { TriviaAction, TriviaGameState, TriviaPlayerView, TriviaQuestion, TriviaResult } from '../../../shared';
import { DistinctActionResult, DistinctGameAdapter } from '../distinct-game.adapter';
import { hasExactActionShape, isBoundedInteger } from '../action-shape';
import { secureShuffle } from '../standard-cards';
import { TRIVIA_QUESTION_BANK } from './trivia-questions';

type QuestionShuffler = (questions: TriviaQuestion[]) => TriviaQuestion[];

export class TriviaQuizBowlEngine implements DistinctGameAdapter<TriviaGameState, TriviaAction, TriviaPlayerView, TriviaResult> {
  readonly key = 'trivia-quiz-bowl' as const;
  readonly rulesetId = 'trivia-quiz-bowl.original-10-question.v1';
  readonly minPlayers = 2;
  readonly maxPlayers = 10;

  constructor(private readonly shuffleQuestions: QuestionShuffler = secureShuffle) {}

  initGame(playerIds: string[], playerNames: Record<string, string>): TriviaGameState {
    this.requirePlayers(playerIds);
    const questions = this.shuffleQuestions(TRIVIA_QUESTION_BANK.map((question) => ({ ...question, options: [...question.options] as TriviaQuestion['options'] }))).slice(0, 10);
    return {
      players: playerIds.map((id, index) => ({ id, name: playerNames[id] || `Player ${index + 1}` })),
      hostId: playerIds[0],
      questions,
      currentQuestionIndex: 0,
      answers: {},
      scores: Object.fromEntries(playerIds.map((id) => [id, 0])),
      firstCorrectId: null,
      phase: 'answering',
      winnerId: null,
      isDraw: false,
      finishReason: null,
    };
  }

  applyAction(state: TriviaGameState, playerId: string, action: TriviaAction): DistinctActionResult<TriviaResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (!state.players.some((player) => player.id === playerId)) return { valid: false, reason: 'Player not found' };
    if (state.phase === 'answering') return this.answer(state, playerId, action);
    return this.nextQuestion(state, playerId, action);
  }

  getPlayerView(state: TriviaGameState, playerId: string): TriviaPlayerView {
    const question = state.questions[state.currentQuestionIndex];
    return {
      gameKey: this.key,
      players: state.players.map((player) => ({ ...player })),
      youId: playerId,
      hostId: state.hostId,
      question: { number: state.currentQuestionIndex + 1, prompt: question.prompt, options: [...question.options] as TriviaQuestion['options'] },
      questionCount: state.questions.length,
      answeredPlayerIds: Object.keys(state.answers),
      yourAnswer: state.answers[playerId] ?? null,
      reveal: state.phase === 'answering' ? null : {
        correctAnswerIndex: question.correctAnswerIndex,
        answers: { ...state.answers },
        firstCorrectId: state.firstCorrectId,
      },
      scores: { ...state.scores },
      phase: state.phase,
      winnerId: state.winnerId,
      isDraw: state.isDraw,
      canAct: state.phase === 'answering'
        ? state.answers[playerId] === undefined
        : state.phase === 'reveal' && playerId === state.hostId,
    };
  }

  surrender(state: TriviaGameState, playerId: string): DistinctActionResult<TriviaResult> {
    if (state.phase === 'finished') return { valid: false, reason: 'Game already finished' };
    if (!state.players.some((player) => player.id === playerId)) return { valid: false, reason: 'Player not found' };
    const remaining = state.players.filter((player) => player.id !== playerId);
    const highScore = Math.max(...remaining.map((player) => state.scores[player.id]));
    state.phase = 'finished';
    state.winnerId = remaining.find((player) => state.scores[player.id] === highScore)!.id;
    state.isDraw = false;
    state.finishReason = 'surrender';
    return { valid: true, result: this.getResult(state) };
  }

  getResult(state: TriviaGameState): TriviaResult {
    if (!state.finishReason) throw new Error('Trivia Quiz Bowl game is not finished');
    return { gameKey: this.key, winnerId: state.winnerId, isDraw: state.isDraw, reason: state.finishReason, scores: { ...state.scores } };
  }

  private answer(state: TriviaGameState, playerId: string, action: TriviaAction): DistinctActionResult<TriviaResult> {
    if (!hasExactActionShape(action, 'answer_trivia', ['answerIndex']) || !isBoundedInteger(action.answerIndex, 0, 3)) {
      return { valid: false, reason: 'Invalid answer' };
    }
    if (state.answers[playerId] !== undefined) return { valid: false, reason: 'Answer already submitted' };
    state.answers[playerId] = action.answerIndex;
    const question = state.questions[state.currentQuestionIndex];
    if (action.answerIndex === question.correctAnswerIndex && !state.firstCorrectId) state.firstCorrectId = playerId;
    if (Object.keys(state.answers).length === state.players.length) this.revealAnswers(state);
    return { valid: true };
  }

  private revealAnswers(state: TriviaGameState): void {
    const correctAnswerIndex = state.questions[state.currentQuestionIndex].correctAnswerIndex;
    for (const player of state.players) {
      if (state.answers[player.id] === correctAnswerIndex) state.scores[player.id] += 10;
    }
    if (state.firstCorrectId) state.scores[state.firstCorrectId] += 5;
    state.phase = 'reveal';
  }

  private nextQuestion(state: TriviaGameState, playerId: string, action: TriviaAction): DistinctActionResult<TriviaResult> {
    if (playerId !== state.hostId) return { valid: false, reason: 'Only the host can continue' };
    if (!hasExactActionShape(action, 'next_question', [])) return { valid: false, reason: 'Invalid next-question action' };
    if (state.currentQuestionIndex === state.questions.length - 1) {
      this.finishQuiz(state);
      return { valid: true, result: this.getResult(state) };
    }
    state.currentQuestionIndex += 1;
    state.answers = {};
    state.firstCorrectId = null;
    state.phase = 'answering';
    return { valid: true };
  }

  private finishQuiz(state: TriviaGameState): void {
    const highScore = Math.max(...Object.values(state.scores));
    const leaders = state.players.filter((player) => state.scores[player.id] === highScore);
    state.phase = 'finished';
    state.winnerId = leaders.length === 1 ? leaders[0].id : null;
    state.isDraw = leaders.length > 1;
    state.finishReason = 'questions_complete';
  }

  private requirePlayers(playerIds: string[]): void {
    if (playerIds.length < 2 || playerIds.length > 10 || new Set(playerIds).size !== playerIds.length) {
      throw new Error('Trivia Quiz Bowl requires two to ten distinct players');
    }
  }
}