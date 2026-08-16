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
    'bg-[#f4f1e8] hover:bg-white text-[#171912] shadow-lg shadow-black/20',
  secondary:
    'bg-[#252923] hover:bg-[#30352d] text-[#f4f1e8] border border-white/[0.14]',
  danger: 'bg-[#3a211f] hover:bg-[#4a2724] text-[#ff9b8a] border border-[#ff684d]/35',
  ghost: 'bg-transparent hover:bg-white/[0.07] text-[#b9beb5] hover:text-white',
};

const sizeClasses: Record<Size, string> = {
  sm: 'min-h-9 px-3 py-1.5 text-sm rounded-lg',
  md: 'min-h-11 px-5 py-2.5 text-base rounded-lg',
  lg: 'min-h-12 px-8 py-3 text-lg rounded-lg',
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
        whileHover={{ scale: disabled ? 1 : 1.02 }}
        whileTap={{ scale: disabled ? 1 : 0.98 }}
        className={`font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed
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
