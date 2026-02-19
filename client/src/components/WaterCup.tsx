import { motion, AnimatePresence } from "framer-motion";

const IDENTITY_STATEMENTS: Record<number, string> = {
  25: "I STARTED",
  50: "I CAN'T QUIT NOW",
  75: "I'M FINISHING THIS",
  100: "I FOLLOW THROUGH",
};

const MARKERS = [25, 50, 75, 100];

export function WaterCup({
  fillPercent,
  cupsFilled,
  revealedStatements,
}: {
  fillPercent: number;
  cupsFilled: number;
  revealedStatements: Record<number, string>;
}) {
  const clampedFill = Math.max(0, Math.min(fillPercent, 100));

  return (
    <div className="flex flex-col items-center" data-testid="water-cup-container">
      <div className="relative w-20 h-28">
        <div className="absolute inset-0 rounded-b-2xl rounded-t-lg border-2 border-blue-300/60 bg-blue-50/30 overflow-hidden">
          <motion.div
            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-500 to-blue-400 rounded-b-xl"
            initial={{ height: 0 }}
            animate={{ height: `${clampedFill}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            data-testid="water-fill-level"
          >
            <div className="absolute inset-0 overflow-hidden">
              <motion.div
                className="absolute -top-1 left-0 right-0 h-3 bg-blue-300/40 rounded-full"
                animate={{ x: [-2, 2, -2] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          </motion.div>

          <div className="absolute inset-0 flex flex-col justify-between py-1 pointer-events-none">
            {[...MARKERS].reverse().map((marker) => {
              const bottom = `${marker}%`;
              return (
                <div
                  key={marker}
                  className="absolute left-0 right-0 flex items-center"
                  style={{ bottom }}
                >
                  <div className="w-2.5 h-px bg-blue-400/50" />
                  <span className="text-[7px] text-blue-400/70 ml-0.5">{marker}</span>
                </div>
              );
            })}
          </div>

          <div className="absolute inset-0 pointer-events-none">
            {MARKERS.map((marker) => {
              const revealed = revealedStatements[marker];
              if (!revealed) return null;
              return (
                <motion.div
                  key={marker}
                  className="absolute right-1 text-[6px] font-bold text-white/90 tracking-tight"
                  style={{ bottom: `${marker - 5}%` }}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  {revealed}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-1.5 text-center">
        <p className="text-[10px] text-muted-foreground font-medium" data-testid="text-cup-count">
          {cupsFilled} {cupsFilled === 1 ? "cup" : "cups"} filled
        </p>
      </div>
    </div>
  );
}
