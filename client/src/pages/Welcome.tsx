import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Sprout } from "lucide-react";

export default function Welcome() {
  const [, setLocation] = useLocation();

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-green-50 to-background">
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="mb-8 p-6 bg-primary/10 rounded-full"
      >
        <Sprout className="w-16 h-16 text-primary" strokeWidth={1.5} />
      </motion.div>

      <motion.h1 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-4xl font-serif text-foreground mb-4"
      >
        Mustard Seed
      </motion.h1>

      <motion.p 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-muted-foreground text-lg mb-12 max-w-xs leading-relaxed"
      >
        Small steps. Deep roots. <br/> Your accountability partner for growth.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        className="w-full max-w-xs"
      >
        <Button 
          size="lg" 
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-full h-14 text-lg shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]"
          onClick={() => setLocation("/assessment")}
        >
          Begin Journey
        </Button>
      </motion.div>
    </div>
  );
}
