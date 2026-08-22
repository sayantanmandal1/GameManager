import type { StandardCard } from '@/shared';

interface Props {
  readonly card: StandardCard;
  readonly selected?: boolean;
  readonly disabled?: boolean;
  readonly onClick?: () => void;
  readonly label?: string;
  readonly size?: 'micro' | 'mini' | 'regular';
  readonly className?: string;
}

const SUIT_GLYPHS: Record<StandardCard['suit'], string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
};

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
  const classes = `group relative flex ${dimensions} shrink-0 overflow-hidden rounded-lg border border-black/15 bg-[#fffdf7] text-left font-black shadow-[0_8px_18px_rgba(0,0,0,0.28)] transition ${red ? 'text-[#c52f3d]' : 'text-[#17231f]'} ${selected ? 'outline outline-4 outline-[#f3cf64]' : ''} disabled:cursor-not-allowed disabled:opacity-45 ${className}`;
  const glyph = SUIT_GLYPHS[card.suit];
  let cornerSize = 'text-sm';
  let centerSize = 'text-4xl';
  if (size === 'mini') {
    cornerSize = 'text-xs';
    centerSize = 'text-2xl';
  } else if (size === 'micro') {
    cornerSize = 'text-[8px]';
    centerSize = 'text-base';
  }
  const content = (
    <>
      <span className={`absolute left-1.5 top-1 flex flex-col items-center leading-none ${cornerSize}`}>
        <span>{card.rank}</span><span>{glyph}</span>
      </span>
      <span className={`absolute inset-0 flex items-center justify-center ${centerSize}`}>{glyph}</span>
      <span className={`absolute bottom-1 right-1.5 flex rotate-180 flex-col items-center leading-none ${cornerSize}`}>
        <span>{card.rank}</span><span>{glyph}</span>
      </span>
      <span className="pointer-events-none absolute inset-[3px] rounded-[5px] border border-black/[0.06]" />
    </>
  );
  return onClick
    ? <button type="button" className={`${classes} enabled:hover:-translate-y-2 enabled:hover:shadow-[0_14px_24px_rgba(0,0,0,0.4)]`} disabled={disabled} onClick={onClick} aria-pressed={selected} aria-label={label ?? `${card.rank} of ${card.suit}`}>{content}</button>
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