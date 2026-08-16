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
      className={`bg-[#1c1f1b]/95 backdrop-blur-xl border border-white/[0.14] rounded-lg p-6
        ${glowing ? 'shadow-xl shadow-black/20' : ''}
        ${hoverable ? 'cursor-pointer transition-shadow hover:shadow-xl hover:shadow-black/30 hover:bg-[#232720]' : ''}
        ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}
