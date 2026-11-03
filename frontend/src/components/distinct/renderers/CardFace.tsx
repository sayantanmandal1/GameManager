import type { StandardCard } from '@/shared';
import { PlayingCardArtwork } from './PlayingCardArtwork';

interface Props {
  readonly card: StandardCard;
  readonly selected?: boolean;
  readonly disabled?: boolean;
  readonly onClick?: () => void;
  readonly label?: string;
  readonly size?: 'micro' | 'mini' | 'regular' | 'fluid';
  readonly className?: string;
}

export function CardFace({
  card,
  selected = false,
  disabled = false,
  onClick,
  label,
  size = 'regular',
  className = '',
}: Props) {
  const red = card.suit === 'hearts' || card.suit === 'diamonds';
  let dimensions = 'h-24 w-16';
  if (size === 'mini') dimensions = 'h-[4.5rem] w-12';
  else if (size === 'micro') dimensions = 'h-12 w-8';
  else if (size === 'fluid') dimensions = 'aspect-[2/3] w-full';
  const classes = `group relative flex ${dimensions} shrink-0 overflow-hidden rounded-xl border border-black/15 bg-[#fffdf7] text-left font-bold shadow-[0_5px_12px_rgba(0,0,0,0.2)] transition-[transform,box-shadow] ${red ? 'text-[#c52f3d]' : 'text-[#17231f]'} ${selected ? 'outline outline-4 outline-game-blue' : ''} disabled:cursor-not-allowed disabled:opacity-45 ${className}`;
  const content = <PlayingCardArtwork card={card} />;
  return onClick
    ? <button type="button" className={`${classes} enabled:hover:-translate-y-1 enabled:active:translate-y-0 enabled:active:shadow-none`} disabled={disabled} onClick={onClick} aria-pressed={selected} aria-label={label ?? `${card.rank} of ${card.suit}`}>{content}</button>
    : <span className={classes} aria-label={label ?? `${card.rank} of ${card.suit}`}>{content}</span>;
}

export function CardBack({ size = 'regular', className = '' }: Readonly<{
  size?: 'tiny' | 'regular';
  className?: string;
}>) {
  const dimensions = size === 'tiny' ? 'h-12 w-8' : 'h-20 w-[3.35rem]';
  return (
    <span
      aria-hidden="true"
      className={`relative block ${dimensions} shrink-0 overflow-hidden rounded-md border-2 border-[#f8f2df] bg-[#173d61] shadow-[0_5px_12px_rgba(0,0,0,0.32)] ${className}`}
    >
      <span className="absolute inset-[3px] rounded-[3px] border border-[#d9b85f]/75 bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.08)_0,rgba(255,255,255,0.08)_2px,transparent_2px,transparent_6px)]" />
      <span className="absolute inset-[7px] grid place-items-center rounded-sm border border-white/35 bg-[#a92736]">
        <span className="h-3 w-3 rotate-45 border border-[#f4d889] bg-[#173d61]" />
      </span>
    </span>
  );
}