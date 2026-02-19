import { motion } from "framer-motion";

const STAGE_VISUALS: Record<number, {
  icon: string;
  label: string;
  desc: string;
  soilColor: string;
  glowColor: string;
  showRoots: boolean;
  rootCount: number;
  showSprout: boolean;
  showLeaves: boolean;
}> = {
  0: { icon: "🌰", label: "Dormant Seed", desc: "Underground. Waiting.", soilColor: "from-amber-800 to-amber-900", glowColor: "", showRoots: false, rootCount: 0, showSprout: false, showLeaves: false },
  1: { icon: "🌰", label: "Germination", desc: "Seed cracks open", soilColor: "from-amber-700 to-amber-900", glowColor: "shadow-amber-400/30", showRoots: false, rootCount: 0, showSprout: false, showLeaves: false },
  2: { icon: "🌰", label: "Primary Root", desc: "Root extends downward", soilColor: "from-amber-700 to-amber-900", glowColor: "shadow-amber-300/20", showRoots: true, rootCount: 1, showSprout: false, showLeaves: false },
  3: { icon: "🌰", label: "Root Expansion", desc: "Root network forming", soilColor: "from-amber-700 to-amber-800", glowColor: "", showRoots: true, rootCount: 3, showSprout: false, showLeaves: false },
  4: { icon: "🌰", label: "Soil Pressure", desc: "Energy building beneath", soilColor: "from-amber-600 to-amber-800", glowColor: "", showRoots: true, rootCount: 3, showSprout: false, showLeaves: false },
  5: { icon: "🌱", label: "Sprout Emergence", desc: "Breaking through soil", soilColor: "from-amber-600 to-amber-800", glowColor: "", showRoots: true, rootCount: 3, showSprout: true, showLeaves: false },
  6: { icon: "🪴", label: "Early Plant", desc: "Stem strengthens, leaves form", soilColor: "from-amber-600 to-amber-800", glowColor: "", showRoots: true, rootCount: 4, showSprout: true, showLeaves: true },
};

export function SeedGrowth({
  seedStage,
  cupsFilled,
}: {
  seedStage: number;
  cupsFilled: number;
}) {
  const visual = STAGE_VISUALS[seedStage] || STAGE_VISUALS[0];

  return (
    <div className="flex flex-col items-center" data-testid="seed-growth-container">
      <div className="relative w-24 h-32 overflow-hidden rounded-xl">
        <div className={`absolute top-0 left-0 right-0 h-[45%] bg-gradient-to-b from-sky-100 to-sky-200`}>
          {visual.showSprout && (
            <motion.div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center"
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              {visual.showLeaves && (
                <div className="flex gap-1 mb-0.5">
                  <motion.div
                    className="w-2.5 h-1.5 bg-green-500 rounded-full -rotate-30"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3 }}
                  />
                  <motion.div
                    className="w-2.5 h-1.5 bg-green-500 rounded-full rotate-30"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.4 }}
                  />
                </div>
              )}
              <div className="w-1 h-4 bg-green-600 rounded-full" />
            </motion.div>
          )}
        </div>

        <div className={`absolute bottom-0 left-0 right-0 h-[55%] bg-gradient-to-b ${visual.soilColor}`}>
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
            <motion.div
              key={seedStage}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", bounce: 0.4 }}
              className={`text-2xl ${visual.glowColor ? `drop-shadow-lg ${visual.glowColor}` : ""}`}
              data-testid="text-seed-icon"
            >
              {seedStage >= 5 ? "" : visual.icon}
            </motion.div>
            {seedStage === 1 && (
              <motion.div
                className="absolute top-3 left-1/2 -translate-x-1/2 w-4 h-px bg-amber-300/80"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              />
            )}
          </div>

          {visual.showRoots && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2">
              <motion.div
                className="w-0.5 h-5 bg-white/40 rounded-full mx-auto"
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                style={{ transformOrigin: "top" }}
              />
              {visual.rootCount >= 2 && (
                <motion.div
                  className="absolute top-2 -left-2 w-0.5 h-3 bg-white/30 rounded-full rotate-30"
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ delay: 0.4, duration: 0.4 }}
                  style={{ transformOrigin: "top" }}
                />
              )}
              {visual.rootCount >= 3 && (
                <motion.div
                  className="absolute top-2 left-2 w-0.5 h-3 bg-white/30 rounded-full -rotate-30"
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ delay: 0.5, duration: 0.4 }}
                  style={{ transformOrigin: "top" }}
                />
              )}
              {visual.rootCount >= 4 && (
                <motion.div
                  className="absolute top-4 -left-3 w-0.5 h-2 bg-white/20 rounded-full rotate-45"
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ delay: 0.6, duration: 0.3 }}
                  style={{ transformOrigin: "top" }}
                />
              )}
            </div>
          )}

          {seedStage === 4 && (
            <motion.div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1.5 bg-amber-500/40 rounded-full"
              animate={{ y: [-1, 1, -1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-px bg-amber-600/30" style={{ top: "45%" }} />
      </div>

      <div className="mt-2 text-center">
        <p className="text-xs font-semibold text-foreground" data-testid="text-seed-stage-name">{visual.label}</p>
        <p className="text-[10px] text-muted-foreground">{visual.desc}</p>
      </div>
    </div>
  );
}
