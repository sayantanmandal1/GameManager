'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';

interface CardProps extends HTMLMotionProps<'div'> {
  hoverable?: boolean;
  glowing?: boolean;
}

export function Card({
  hoverable = false,
  glowing = false,
  className = '',
  children,
  ...props
}: CardProps) {
  return (
    <motion.div
      role={props.onClick ? 'button' : undefined}
      tabIndex={props.onClick ? 0 : undefined}
      onKeyDown={props.onClick ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.currentTarget.click();
        }
      } : undefined}
      whileHover={hoverable ? { y: -3 } : undefined}
      whileTap={hoverable ? { scale: 0.98 } : undefined}
      className={`premium-panel p-6
        ${glowing ? 'ring-1 ring-white/[0.04]' : ''}
        ${hoverable ? 'cursor-pointer transition-colors hover:border-white/25 hover:bg-white/[0.06]' : ''}
        ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}
