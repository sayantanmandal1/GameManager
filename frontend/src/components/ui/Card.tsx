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
      whileHover={hoverable ? { scale: 1.02, y: -4 } : undefined}
      className={`bg-game-card border border-game-border rounded-2xl p-6
        ${glowing ? 'shadow-lg shadow-primary/10' : ''}
        ${hoverable ? 'cursor-pointer transition-shadow hover:shadow-xl hover:shadow-primary/20' : ''}
        ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}
