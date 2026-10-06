'use client';

import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // reducedMotion="user": people who ask for less motion get plain fades from
  // every motion component below. Opacity + transform only — blurring the
  // whole page per frame is the most expensive transition there is.
  return <MotionConfig reducedMotion="user">
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={pathname} className="pageTransition" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .32, ease: 'easeOut' }}>
        {children}
      </motion.div>
    </AnimatePresence>
  </MotionConfig>;
}
