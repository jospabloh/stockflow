import React from 'react';
import { motion } from 'framer-motion';
import { useNavigation } from '@/lib/NavigationContext';

export default function PageTransition({ children }) {
  const { direction } = useNavigation();

  const variants = {
    forward: {
      initial: { opacity: 0, x: 100 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: -100 }
    },
    back: {
      initial: { opacity: 0, x: -100 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: 100 }
    }
  };

  const current = variants[direction] || variants.forward;

  return (
    <motion.div
      initial={current.initial}
      animate={current.animate}
      exit={current.exit}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  );
}