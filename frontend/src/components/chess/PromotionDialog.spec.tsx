/**
 * Tests for components/chess/PromotionDialog.tsx
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PromotionDialog } from './PromotionDialog';

describe('PromotionDialog', () => {
  beforeAll(() => {
    // jsdom stubs for <dialog>
    if (!HTMLDialogElement.prototype.showModal) {
      HTMLDialogElement.prototype.showModal = function () {
        this.setAttribute('open', '');
      };
      HTMLDialogElement.prototype.close = function () {
        this.removeAttribute('open');
      };
    }
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <PromotionDialog
        open={false}
        color="w"
        onPick={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(container.querySelector('dialog')).toBeNull();
  });

  it('renders all four promotion options when open', () => {
    render(
      <PromotionDialog open color="w" onPick={jest.fn()} onCancel={jest.fn()} />,
    );
    expect(screen.getByRole('button', { name: /queen/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rook/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /bishop/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /knight/i })).toBeInTheDocument();
  });

  it('defaults focus to Queen', async () => {
    render(
      <PromotionDialog open color="w" onPick={jest.fn()} onCancel={jest.fn()} />,
    );
    // requestAnimationFrame is used for focus; flush
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    });
    const queen = screen.getByRole('button', { name: /queen/i });
    expect(document.activeElement).toBe(queen);
  });

  it('calls onPick with the chosen piece', () => {
    const onPick = jest.fn();
    render(
      <PromotionDialog open color="w" onPick={onPick} onCancel={jest.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /rook/i }));
    expect(onPick).toHaveBeenCalledWith('r');
  });

  it('calls onCancel on Escape', () => {
    const onCancel = jest.fn();
    render(
      <PromotionDialog open color="w" onPick={jest.fn()} onCancel={onCancel} />,
    );
    const dlg = screen.getByTestId('promotion-dialog');
    fireEvent.keyDown(dlg, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
  });
});
