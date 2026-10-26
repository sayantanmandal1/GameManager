/**
 * Tests for components/ui/Modal.tsx
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { Modal } from './Modal';
import userEvent from '@testing-library/user-event';

// Mock framer-motion
jest.mock('framer-motion', () => {
  const React = require('react');
  return {
    motion: {
      div: React.forwardRef(({ children, ...props }: any, ref: any) => (
        <div ref={ref} {...props}>{children}</div>
      )),
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
  };
});

describe('Modal Component', () => {
  it('should render children when open', () => {
    render(
      <Modal isOpen={true} onClose={jest.fn()}>
        Modal Content
      </Modal>,
    );
    expect(screen.getByText('Modal Content')).toBeInTheDocument();
  });

  it('should not render children when closed', () => {
    render(
      <Modal isOpen={false} onClose={jest.fn()}>
        Modal Content
      </Modal>,
    );
    expect(screen.queryByText('Modal Content')).not.toBeInTheDocument();
  });

  it('should show title when provided', () => {
    render(
      <Modal isOpen={true} onClose={jest.fn()} title="Test Title">
        Content
      </Modal>,
    );
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('should not show title when not provided', () => {
    render(
      <Modal isOpen={true} onClose={jest.fn()}>
        Content
      </Modal>,
    );
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('labels the dialog and dismisses with Escape or the close button', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<Modal isOpen onClose={onClose} title="Join room"><input aria-label="Code" /></Modal>);
    expect(screen.getByRole('dialog', { name: 'Join room' })).toHaveAttribute('aria-modal', 'true');
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('contains keyboard focus and restores focus and scrolling on close', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    const { rerender } = render(<><button>Open</button><Modal isOpen={false} onClose={onClose}><input aria-label="Code" /><button>Join</button></Modal></>);
    screen.getByRole('button', { name: 'Open' }).focus();
    const originalOverflow = document.body.style.overflow;
    rerender(<><button>Open</button><Modal isOpen onClose={onClose}><input aria-label="Code" /><button>Join</button></Modal></>);
    const closeButton = screen.getByRole('button', { name: 'Close dialog' });
    expect(closeButton).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Join' })).toHaveFocus();
    await user.tab();
    expect(closeButton).toHaveFocus();
    rerender(<><button>Open</button><Modal isOpen={false} onClose={onClose}><input aria-label="Code" /><button>Join</button></Modal></>);
    expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
    expect(document.body.style.overflow).toBe(originalOverflow);
  });

  it('keeps mandatory game choices open while preserving keyboard focus', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<Modal isOpen onClose={onClose} title="Choose a color" dismissible={false}><button>Red</button><button>Blue</button></Modal>);
    expect(screen.queryByRole('button', { name: 'Close dialog' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Red' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Blue' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Red' })).toHaveFocus();
  });

  it('makes the background inert and preserves a pre-existing inert region', () => {
    const existing = document.createElement('div');
    existing.setAttribute('inert', '');
    document.body.appendChild(existing);
    const { container, unmount } = render(
      <><button>Behind dialog</button><Modal isOpen onClose={jest.fn()} title="Choose"><button>Confirm</button></Modal></>,
    );
    expect(container).toHaveAttribute('inert');
    expect(screen.getByRole('dialog', { name: 'Choose' })).toBeInTheDocument();
    unmount();
    expect(container).not.toHaveAttribute('inert');
    expect(existing).toHaveAttribute('inert');
    existing.remove();
  });
});
