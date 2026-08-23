'use client';

import { motion } from 'framer-motion';
import type { UnoCard as UnoCardT, UnoCardFace, UnoSide } from '@/shared';
import {
  UNO_COLOR_HEX,
  WILD_WHEEL_LIGHT,
  WILD_WHEEL_DARK,
  isWildKind,
  faceOf,
  cardGlyph,
  cornerGlyph,
  cardAriaLabel,
  wildOverlay,
} from './cardStyle';

interface UnoCardProps {
  card?: UnoCardT | null;
  face?: UnoCardFace | null;
  side?: UnoSide;
  faceDown?: boolean;
  width?: number;
  onClick?: () => void;
  disabled?: boolean;
  playable?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

function CardBack({ width, dark }: { width: number; dark: boolean }) {
  const height = width * 1.5;
  return (
    <div
      className="relative overflow-hidden rounded-[14%] border-[3px] border-white shadow-md"
      style={{ width, height, background: dark ? '#0a0a0a' : '#141414' }}
    >
      <div
        className="absolute left-1/2 top-1/2 flex items-center justify-center rounded-[50%]"
        style={{
          width: width * 1.05,
          height: width * 0.62,
          transform: 'translate(-50%,-50%) rotate(-20deg)',
          background: dark ? '#8b5cf6' : '#e63946',
        }}
      >
        <span
          className="font-black italic text-white"
          style={{ fontSize: width * 0.3, textShadow: '1px 1px 0 rgba(0,0,0,0.4)' }}
        >
          UNO
        </span>
      </div>
    </div>
  );
}

export function UnoCard({
  card,
  face: projectedFace,
  side = 'light',
  faceDown = false,
  width = 66,
  onClick,
  disabled = false,
  playable = false,
  className = '',
  style,
}: UnoCardProps) {
  const height = width * 1.5;
  const dark = side === 'dark';

  if (faceDown || (!card && !projectedFace)) {
    const back = <CardBack width={width} dark={dark} />;
    return onClick ? (
      <button onClick={onClick} disabled={disabled} className={className} style={style}>
        {back}
      </button>
    ) : (
      <div className={className} style={style}>
        {back}
      </div>
    );
  }

  const face = projectedFace ?? faceOf(card!, side);
  const isWild = isWildKind(face.kind);
  const c = face.color ? UNO_COLOR_HEX[face.color] : null;
  const glyph = cardGlyph(face);
  const corner = cornerGlyph(face);
  const overlay = wildOverlay(face.kind);
  const wheel = dark ? WILD_WHEEL_DARK : WILD_WHEEL_LIGHT;

  const faceEl = (
    <div
      className="relative overflow-hidden rounded-[14%] border-[3px] border-white shadow-md"
      style={{ width, height, background: isWild ? '#171717' : c!.bg }}
    >
      <span
        className="absolute font-black text-white"
        style={{ top: height * 0.05, left: width * 0.1, fontSize: width * 0.2 }}
      >
        {corner}
      </span>
      <span
        className="absolute rotate-180 font-black text-white"
        style={{ bottom: height * 0.05, right: width * 0.1, fontSize: width * 0.2 }}
      >
        {corner}
      </span>

      <div
        className="absolute left-1/2 top-1/2 flex items-center justify-center rounded-[50%] bg-white"
        style={{
          width: width * 1.02,
          height: width * 0.66,
          transform: 'translate(-50%,-50%) rotate(-20deg)',
        }}
      >
        {isWild ? (
          <div
            className="rounded-full"
            style={{ width: width * 0.5, height: width * 0.5, background: wheel, transform: 'rotate(20deg)' }}
          />
        ) : (
          <span
            className="font-black"
            style={{ color: c!.deep, fontSize: glyph.length > 1 ? width * 0.36 : width * 0.6 }}
          >
            {glyph}
          </span>
        )}
      </div>

      {isWild && overlay && (
        <span
          className="absolute left-1/2 top-1/2 font-black text-white"
          style={{
            transform: 'translate(-50%,-50%)',
            fontSize: overlay.length > 2 ? width * 0.26 : width * 0.34,
            textShadow: '1.5px 1.5px 0 rgba(0,0,0,0.55)',
          }}
        >
          {overlay}
        </span>
      )}
    </div>
  );

  if (!onClick) {
    return (
      <div className={className} style={style} aria-label={cardAriaLabel(face)}>
        {faceEl}
      </div>
    );
  }

  return (
    <motion.button
      type="button"
      aria-label={cardAriaLabel(face)}
      onClick={onClick}
      disabled={disabled}
      whileHover={playable ? { y: -16 } : { y: -4 }}
      whileTap={{ scale: 0.96 }}
      className={`relative transition-shadow disabled:cursor-not-allowed ${
        playable ? 'cursor-pointer' : 'cursor-default'
      } ${disabled && !playable ? 'opacity-55 saturate-50' : ''} ${className}`}
      style={{
        filter: playable ? `drop-shadow(0 8px 14px ${c ? c.glow : 'rgba(255,255,255,0.4)'})` : undefined,
        ...style,
      }}
    >
      {faceEl}
    </motion.button>
  );
}
