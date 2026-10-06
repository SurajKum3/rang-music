'use client';

import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import WorldExperience from '@/components/world/WorldExperience';
import type { WorldConfig } from '@/engine/world/types';

export default function WorldRoute({ world }: { world: WorldConfig }) {
  const router = useRouter();
  return (
    // initial={false}: the first world you land on is visible in the server
    // HTML instead of waiting at opacity 0 for the JS bundle. Switching worlds
    // still cross-fades.
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={world.slug} className="routeShell" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .35 }}>
        <WorldExperience world={world} onExit={() => router.push('/')} />
      </motion.div>
    </AnimatePresence>
  );
}
