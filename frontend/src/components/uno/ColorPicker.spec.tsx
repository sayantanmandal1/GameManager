import { fireEvent, render, screen } from '@testing-library/react';
import { ColorPicker } from './ColorPicker';

jest.mock('framer-motion', () => {
  const React = require('react');
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      div: React.forwardRef(({ children, ...props }: any, ref: any) => (
        <div ref={ref} {...props}>{children}</div>
      )),
      button: React.forwardRef(({ children, ...props }: any, ref: any) => (
        <button ref={ref} {...props}>{children}</button>
      )),
    },
  };
});

describe('ColorPicker', () => {
  it('offers surrender while an opening Wild color choice is mandatory', () => {
    const onPick = jest.fn();
    const onSurrender = jest.fn();
    render(
      <ColorPicker
        open
        side="light"
        title="Choose the opening color"
        canCancel={false}
        onPick={onPick}
        onCancel={jest.fn()}
        onSurrender={onSurrender}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Choose the opening color' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close color picker' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Surrender match' }));
    expect(onSurrender).toHaveBeenCalledTimes(1);
  });
});
