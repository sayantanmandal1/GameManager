/**
 * Tests for components/chess/ChessControls.tsx
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChessControls } from './ChessControls';

describe('ChessControls', () => {
  const baseProps = {
    canResign: true,
    canOfferDraw: true,
    drawOfferFrom: null as 'me' | 'opponent' | null,
    onResign: jest.fn(),
    onOfferDraw: jest.fn(),
    onRespondDraw: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders resign and offer-draw buttons', () => {
    render(<ChessControls {...baseProps} />);
    expect(screen.getByRole('button', { name: /resign/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /offer draw/i })).toBeInTheDocument();
  });

  it('requires confirmation before resigning', () => {
    render(<ChessControls {...baseProps} />);
    fireEvent.click(screen.getAllByRole('button', { name: /resign/i })[0]);
    // Confirm dialog appears
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(baseProps.onResign).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /yes, resign/i }));
    expect(baseProps.onResign).toHaveBeenCalledTimes(1);
  });

  it('can cancel the resign confirmation without resigning', () => {
    render(<ChessControls {...baseProps} />);
    fireEvent.click(screen.getAllByRole('button', { name: /resign/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(baseProps.onResign).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('shows Accept/Decline only when opponent offered draw', () => {
    const { rerender } = render(
      <ChessControls {...baseProps} drawOfferFrom="opponent" />,
    );
    fireEvent.click(screen.getByRole('button', { name: /accept draw/i }));
    expect(baseProps.onRespondDraw).toHaveBeenCalledWith('accept');

    rerender(<ChessControls {...baseProps} drawOfferFrom="me" />);
    expect(screen.queryByRole('button', { name: /accept draw/i })).not.toBeInTheDocument();
  });

  it('disables resign and offer-draw when not allowed', () => {
    render(<ChessControls {...baseProps} canResign={false} canOfferDraw={false} />);
    expect(screen.getAllByRole('button', { name: /resign/i })[0]).toBeDisabled();
    expect(screen.getByRole('button', { name: /offer draw/i })).toBeDisabled();
  });
});
