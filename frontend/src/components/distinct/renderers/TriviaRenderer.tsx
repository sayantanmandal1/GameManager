'use client';

import { Button } from '@/components/ui/Button';
import type { TriviaAction, TriviaPlayerView } from '@/shared';

interface Props { view: TriviaPlayerView; disabled: boolean; onAction: (action: TriviaAction) => void }

function answerTone(correct: boolean, selected: boolean): string {
  if (correct) return 'border-[#77cfa8] bg-[#1d4b38]';
  if (selected) return 'border-[#75b9f0] bg-[#1d3b50]';
  return 'border-white/15 bg-black/20 hover:bg-white/10';
}

export function TriviaRenderer({ view, disabled, onAction }: Readonly<Props>) {
  return (
    <div className="w-full max-w-[52rem]">
      <div className="flex flex-wrap justify-between gap-3 text-sm text-white/55"><span>Question {view.question.number} of {view.questionCount}</span><span>{view.answeredPlayerIds.length} of {view.players.length} answered</span></div>
      <h2 className="mt-5 text-center text-2xl font-black leading-snug text-white">{view.question.prompt}</h2>
      <fieldset className="mt-7 grid gap-3 border-0 p-0 sm:grid-cols-2"><legend className="sr-only">Answer choices</legend>{view.question.options.map((option, answerIndex) => {
        const correct = view.reveal?.correctAnswerIndex === answerIndex;
        const selected = view.yourAnswer === answerIndex;
        return <button key={option} type="button" disabled={disabled || !view.canAct || view.phase !== 'answering'} onClick={() => onAction({ type: 'answer_trivia', answerIndex })} aria-pressed={selected} className={`min-h-16 border p-4 text-left font-bold transition-colors disabled:opacity-100 ${answerTone(correct, selected)}`}><span className="mr-3 text-white/40">{String.fromCodePoint(65 + answerIndex)}</span>{option}</button>;
      })}</fieldset>
      <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{view.players.map((player) => <div key={player.id} className="flex justify-between border-b border-white/10 px-2 py-2 text-sm"><span className="truncate">{player.name}</span><span className="font-bold">{view.scores[player.id]}</span></div>)}</div>
      {view.phase === 'reveal' && view.youId === view.hostId && <div className="mt-6 flex justify-center"><Button disabled={disabled} onClick={() => onAction({ type: 'next_question' })}>{view.question.number === view.questionCount ? 'Finish quiz' : 'Next question'}</Button></div>}
    </div>
  );
}