'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import { forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends HTMLMotionProps<'button'> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-game-text hover:bg-white text-[#0b0d12] shadow-[0_2px_12px_rgba(255,255,255,0.08)]',
  secondary:
    'bg-white/[0.06] hover:bg-white/[0.1] text-game-text border border-white/[0.12]',
  danger: 'bg-red-400/10 hover:bg-red-400/20 text-game-coral border border-red-300/25',
  ghost: 'bg-transparent hover:bg-white/[0.06] text-game-muted hover:text-white',
};

const sizeClasses: Record<Size, string> = {
  sm: 'min-h-11 px-4 py-2 text-sm rounded-xl',
  md: 'min-h-12 px-5 py-3 text-sm rounded-2xl',
  lg: 'min-h-14 px-7 py-3.5 text-base rounded-2xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      className = '',
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: disabled || isLoading ? 1 : 0.97 }}
        aria-busy={isLoading || undefined}
        className={`inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed
          ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Loading…
          </span>
        ) : (
          children
        )}
      </motion.button>
    );
  },
);

Button.displayName = 'Button';
