import type { TriviaAction } from '../../../shared';
import { TriviaQuizBowlEngine } from './trivia-quiz-bowl.engine';
import { TRIVIA_QUESTION_BANK } from './trivia-questions';

describe('TriviaQuizBowlEngine', () => {
  const game = () => {
    const engine = new TriviaQuizBowlEngine((questions) => questions);
    return { engine, state: engine.initGame(['a', 'b'], { a: 'Alice', b: 'Bob' }) };
  };

  it('selects ten server questions from an original bank of at least forty', () => {
    const { engine, state } = game();
    expect(engine.rulesetId).toBe('trivia-quiz-bowl.original-10-question.v1');
    expect(TRIVIA_QUESTION_BANK.length).toBeGreaterThanOrEqual(40);
    expect(state.questions).toHaveLength(10);
    expect(new Set(state.questions.map((question) => question.prompt)).size).toBe(10);
  });

  it('accepts simultaneous answers but rejects strangers, duplicates, and malformed shapes', () => {
    const { engine, state } = game();
    expect(engine.applyAction(state, 'x', { type: 'answer_trivia', answerIndex: 0 })).toEqual({ valid: false, reason: 'Player not found' });
    expect(engine.applyAction(state, 'a', { type: 'answer_trivia', answerIndex: 4 })).toEqual({ valid: false, reason: 'Invalid answer' });
    expect(engine.applyAction(state, 'a', { type: 'answer_trivia', answerIndex: 0, bid: 2 } as unknown as TriviaAction)).toEqual({ valid: false, reason: 'Invalid answer' });
    expect(engine.applyAction(state, 'a', { type: 'answer_trivia', answerIndex: 0 }).valid).toBe(true);
    expect(engine.applyAction(state, 'a', { type: 'answer_trivia', answerIndex: 0 })).toEqual({ valid: false, reason: 'Answer already submitted' });
  });

  it('hides the correct answer and other submitted choices until reveal', () => {
    const { engine, state } = game();
    engine.applyAction(state, 'a', { type: 'answer_trivia', answerIndex: 0 });
    const view = engine.getPlayerView(state, 'b');
    expect(view.reveal).toBeNull();
    expect(view.scores).toEqual({ a: 0, b: 0 });
    expect(JSON.stringify(view.question)).not.toContain('correctAnswerIndex');
    expect(view.answeredPlayerIds).toEqual(['a']);
  });

  it('awards ten for a correct answer and a five-point first-correct bonus', () => {
    const { engine, state } = game();
    engine.applyAction(state, 'a', { type: 'answer_trivia', answerIndex: 0 });
    engine.applyAction(state, 'b', { type: 'answer_trivia', answerIndex: 0 });
    expect(state.scores).toEqual({ a: 15, b: 10 });
    expect(state.phase).toBe('reveal');
    expect(engine.getPlayerView(state, 'b').reveal).toMatchObject({ correctAnswerIndex: 0, firstCorrectId: 'a' });
  });

  it('allows only the host to advance after every player answers', () => {
    const { engine, state } = game();
    engine.applyAction(state, 'a', { type: 'answer_trivia', answerIndex: 1 });
    engine.applyAction(state, 'b', { type: 'answer_trivia', answerIndex: 1 });
    expect(engine.applyAction(state, 'b', { type: 'next_question' })).toEqual({ valid: false, reason: 'Only the host can continue' });
    expect(engine.applyAction(state, 'a', { type: 'answer_trivia', answerIndex: 0 })).toEqual({ valid: false, reason: 'Invalid next-question action' });
    engine.applyAction(state, 'a', { type: 'next_question' });
    expect(state).toMatchObject({ currentQuestionIndex: 1, answers: {}, phase: 'answering' });
  });

  it('finishes after the tenth reveal and chooses the highest score', () => {
    const { engine, state } = game();
    state.currentQuestionIndex = 9;
    state.phase = 'reveal';
    state.scores = { a: 35, b: 20 };
    const outcome = engine.applyAction(state, 'a', { type: 'next_question' });
    expect(outcome.result).toMatchObject({ winnerId: 'a', reason: 'questions_complete', scores: { a: 35, b: 20 } });
  });

  it('reports a draw when top quiz scores are tied', () => {
    const { engine, state } = game();
    state.currentQuestionIndex = 9;
    state.phase = 'reveal';
    expect(engine.applyAction(state, 'a', { type: 'next_question' }).result).toMatchObject({ winnerId: null, isDraw: true });
  });

  it('awards surrender to a remaining player', () => {
    const { engine, state } = game();
    expect(engine.surrender(state, 'a').result).toMatchObject({ winnerId: 'b', reason: 'surrender' });
  });

  it('rejects actions after quiz completion', () => {
    const { engine, state } = game();
    engine.surrender(state, 'a');
    expect(engine.applyAction(state, 'b', { type: 'answer_trivia', answerIndex: 0 })).toEqual({ valid: false, reason: 'Game already finished' });
  });
});