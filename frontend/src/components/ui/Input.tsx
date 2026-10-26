'use client';

import { forwardRef, useId, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-2 block text-sm font-medium text-game-muted">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : props['aria-describedby']}
          className={`min-h-12 w-full rounded-2xl border border-white/[0.12] bg-black/20 px-4 py-3
            text-base text-white placeholder:text-game-muted
            focus:outline-none focus:ring-2 focus:ring-game-blue/30 focus:border-game-blue
            transition-colors ${error ? 'border-red-400/60' : ''} ${className}`}
          {...props}
        />
        {error && <p id={`${inputId}-error`} role="alert" className="mt-2 text-sm text-game-coral">{error}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
