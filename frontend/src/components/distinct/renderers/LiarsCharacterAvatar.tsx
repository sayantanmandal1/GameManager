'use client';

import Image from 'next/image';
import { getLiarsBarCharacter } from './liarsBarAssets';

export function LiarsCharacterAvatar({ playerIndex, playerName }: Readonly<{
  playerIndex: number;
  playerName: string;
}>) {
  const character = getLiarsBarCharacter(playerIndex);

  return (
    <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg border border-[#dfbd70]/25 bg-[#201a14]">
      <Image
        src={character.portrait}
        alt={`${character.name} portrait for ${playerName}`}
        width={720}
        height={760}
        sizes="56px"
        loading="lazy"
        className="h-full w-full object-cover"
      />
    </div>
  );
}
