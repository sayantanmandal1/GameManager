interface PlayerNameProps {
  readonly name: string;
  readonly isYou?: boolean;
  readonly className?: string;
}

/** Player label whose "(you)" marker stays visible (wrapping below when tight) as long names truncate. */
export function PlayerName({ name, isYou = false, className = '' }: PlayerNameProps) {
  return (
    <p className={`flex min-w-0 flex-wrap items-baseline gap-x-1 ${className}`} title={name}>
      <span className="max-w-full truncate">{name}</span>
      {isYou && <span className="shrink-0"> (you)</span>}
    </p>
  );
}
