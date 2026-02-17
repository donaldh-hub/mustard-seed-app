import { useStore } from "@/lib/store";
import { motion } from "framer-motion";
import { CloudRain, Sun } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function ProgressPage() {
  const { treeStage, waterLevel, streak } = useStore();

  // Simple visual representation of tree stages
  const getTreeIcon = () => {
    // In a real app, these would be custom SVGs or Lottie animations
    switch (treeStage) {
      case 1: return "🌱";
      case 2: return "🌿";
      case 3: return "🪴";
      case 4: return "🌳";
      default: return "🌲";
    }
  };

  return (
    <div className="h-full p-6 flex flex-col bg-gradient-to-b from-blue-50/50 to-green-50/50">
      <header className="mb-8">
        <h1 className="text-2xl font-serif font-bold text-foreground">Your Garden</h1>
        <p className="text-muted-foreground text-sm">Consistent small steps create deep roots.</p>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center relative">
        {/* Sun/Weather Decor */}
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          className="absolute top-0 right-4 text-orange-300 opacity-50"
        >
          <Sun className="w-16 h-16" />
        </motion.div>

        {/* Tree Container */}
        <div className="relative w-64 h-64 flex items-center justify-center mb-8">
          <motion.div 
            key={treeStage}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", bounce: 0.5 }}
            className="text-9xl filter drop-shadow-xl"
          >
            {getTreeIcon()}
          </motion.div>
          
          {/* Ground */}
          <div className="absolute bottom-4 w-full h-4 bg-amber-900/10 rounded-[100%] blur-sm -z-10" />
        </div>

        {/* Stats Card */}
        <div className="w-full max-w-sm bg-white/80 backdrop-blur-md rounded-2xl p-6 shadow-sm border border-white/50 space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span className="flex items-center gap-2 text-blue-600">
                <CloudRain className="w-4 h-4" /> Water Level
              </span>
              <span>{waterLevel}%</span>
            </div>
            <Progress value={waterLevel} className="h-3 bg-blue-100" />
            <p className="text-xs text-muted-foreground text-right pt-1">
              Water to reach next stage
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-orange-50 p-4 rounded-xl text-center border border-orange-100">
              <div className="text-2xl font-bold text-orange-700">{streak}</div>
              <div className="text-xs text-orange-600/80 font-medium uppercase tracking-wider">Day Streak</div>
            </div>
            <div className="bg-green-50 p-4 rounded-xl text-center border border-green-100">
              <div className="text-2xl font-bold text-green-700">{treeStage}</div>
              <div className="text-xs text-green-600/80 font-medium uppercase tracking-wider">Growth Stage</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
