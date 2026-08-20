import type { LobbyPlayer, LobbyTeam } from '@/shared';

interface Props {
  readonly players: LobbyPlayer[];
  readonly currentUserId: string;
  readonly onSelect: (team: LobbyTeam) => void;
}

const TEAM_STYLE = [
  { label: 'Team 1', color: '#e8cb72', surface: 'bg-[#e8cb72]/10 border-[#e8cb72]/35' },
  { label: 'Team 2', color: '#79bce5', surface: 'bg-[#79bce5]/10 border-[#79bce5]/35' },
] as const;

export function PartnershipTeamPicker({ players, currentUserId, onSelect }: Props) {
  const current = players.find((player) => player.id === currentUserId);
  return (
    <section className="mb-5 border-y border-white/10 py-4" aria-labelledby="partnership-heading">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-game-muted">PARTNERSHIPS</p>
          <h3 id="partnership-heading" className="mt-1 font-bold text-white">Choose your team</h3>
        </div>
        <span className="text-xs text-game-muted">Two players per team</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {TEAM_STYLE.map((style, team) => {
          const typedTeam = team as LobbyTeam;
          const members = players.filter((player) => player.team === typedTeam);
          const selected = current?.team === typedTeam;
          const full = members.length >= 2 && !selected;
          return (
            <button
              key={style.label}
              type="button"
              disabled={full}
              aria-pressed={selected}
              onClick={() => onSelect(typedTeam)}
              className={`min-h-28 border p-3 text-left transition ${style.surface} ${selected ? 'ring-2 ring-white/70' : 'hover:border-white/45'} disabled:cursor-not-allowed disabled:opacity-45`}
            >
              <span className="flex items-center justify-between gap-2">
                <strong style={{ color: style.color }}>{style.label}</strong>
                <span className="text-xs text-white/45">{members.length}/2</span>
              </span>
              <span className="mt-3 flex flex-col gap-1.5">
                {members.map((member) => (
                  <span key={member.id} className="flex items-center gap-2 text-xs text-white/75">
                    <span>{member.avatar}</span>
                    <span className="truncate">{member.username}{member.id === currentUserId ? ' · you' : ''}</span>
                  </span>
                ))}
                {members.length === 0 && <span className="text-xs text-white/35">Open seats</span>}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}