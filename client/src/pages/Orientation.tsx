import { motion } from "framer-motion";
import { useLocation } from "wouter";
import jaiOrientation from "@assets/ChatGPT_Image_Mar_7,_2026,_09_56_37_PM_1772938650664.png";

const heartbeats = [
  {
    title: "Clarity of Vision & Why",
    desc: "Know exactly what you're building and why it matters before you move.",
  },
  {
    title: "Small Steps + Consistency",
    desc: "Progress compounds when small actions are repeated daily.",
  },
  {
    title: "Mindset Over Method",
    desc: "Your thinking determines your execution more than any tactic ever will.",
  },
  {
    title: "Feedback & Adaptation",
    desc: "Review what happened, adjust what's needed, and keep moving forward.",
  },
  {
    title: "Courageous Action",
    desc: "Act even when it's uncomfortable, uncertain, or inconvenient.",
  },
];

export default function Orientation() {
  const [, setLocation] = useLocation();

  return (
    <div className="h-full overflow-y-auto no-scrollbar bg-gradient-to-b from-stone-100 via-stone-50 to-stone-200">
      <div className="flex flex-col items-center px-6 py-10 max-w-sm mx-auto">
        <div className="w-full flex items-start gap-0 mb-8 relative">
          <div className="flex-1 pt-2">
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-2xl sm:text-3xl font-bold text-stone-900 leading-tight mb-2"
              data-testid="text-orientation-headline"
            >
              Growth has structure.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="text-base text-stone-500 leading-relaxed"
              data-testid="text-orientation-subheadline"
            >
              These are the Five Heartbeats we build on.
            </motion.p>
          </div>
          <motion.img
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            src={jaiOrientation}
            alt="JAI presenting the Five Heartbeats"
            data-testid="img-jai-orientation"
            className="w-32 sm:w-36 h-auto object-contain -mr-2 -mt-2"
          />
        </div>

        <div className="w-full space-y-5 mb-8">
          {heartbeats.map((hb, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
              className="flex gap-3"
              data-testid={`heartbeat-item-${i + 1}`}
            >
              <div
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-stone-800"
                style={{
                  background: "linear-gradient(180deg, #F5D060 0%, #E8B828 100%)",
                }}
              >
                {i + 1}
              </div>
              <div>
                <h3 className="font-bold text-stone-900 text-sm leading-snug">
                  {hb.title}
                </h3>
                <p className="text-sm text-stone-500 leading-relaxed mt-0.5">
                  {hb.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          className="text-sm text-stone-400 italic text-center mb-8 leading-relaxed"
          data-testid="text-transition-copy"
        >
          Answer honestly. This isn't about perfection — <span className="font-semibold not-italic text-stone-600">it's about clarity.</span>
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.5 }}
          className="w-full pb-4"
        >
          <button
            data-testid="button-start-assessment"
            onClick={() => setLocation("/assessment")}
            className="w-full h-14 rounded-full text-lg font-bold text-stone-900 shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: "linear-gradient(180deg, #F5D060 0%, #E8B828 100%)",
              boxShadow: "0 4px 14px rgba(232, 184, 40, 0.4)",
            }}
          >
            Start Assessment
          </button>
        </motion.div>
      </div>
    </div>
  );
}
