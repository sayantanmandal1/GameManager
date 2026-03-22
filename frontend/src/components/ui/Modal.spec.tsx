/**
 * Tests for components/ui/Modal.tsx
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from './Modal';

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
});
