import { fireEvent, render, screen } from '@testing-library/react';
import type { LobbyPlayer } from '@/shared';
import { PartnershipTeamPicker } from './PartnershipTeamPicker';

const players: LobbyPlayer[] = [
  { id: 'a', username: 'Alice', avatar: 'A', isReady: false, isHost: true, team: 0, joinedAt: new Date() },
  { id: 'b', username: 'Bob', avatar: 'B', isReady: false, isHost: false, team: 0, joinedAt: new Date() },
  { id: 'c', username: 'Cara', avatar: 'C', isReady: false, isHost: false, team: 1, joinedAt: new Date() },
  { id: 'd', username: 'Dev', avatar: 'D', isReady: false, isHost: false, team: null, joinedAt: new Date() },
];

describe('PartnershipTeamPicker', () => {
  it('shows both team rosters and capacity', () => {
    render(<PartnershipTeamPicker players={players} currentUserId="d" onSelect={jest.fn()} />);

    expect(screen.getByRole('button', { name: /Team 1/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Team 2/ })).toBeEnabled();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Cara')).toBeInTheDocument();
  });

  it('submits only the selected team number', () => {
    const onSelect = jest.fn();
    render(<PartnershipTeamPicker players={players} currentUserId="d" onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: /Team 2/ }));
    expect(onSelect).toHaveBeenCalledWith(1);
  });
});