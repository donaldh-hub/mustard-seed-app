import { useState, useRef, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Sparkles, Lightbulb } from "lucide-react";
import { processJaeResponse, getSuggestions } from "@/lib/heartbeat"; 
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const { messages, addMessage, isTyping } = useStore();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    // Load initial suggestions
    setSuggestions(getSuggestions());
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async (text: string = input) => {
    if (!text.trim()) return;
    
    setInput("");
    
    addMessage({
      text: text,
      sender: "user",
    });

    // Process via Heartbeat Relay
    await processJaeResponse(text);
    
    // Refresh suggestions after interaction
    setTimeout(() => {
      setSuggestions(getSuggestions());
    }, 2000);
  };

  return (
    <div className="h-full flex flex-col bg-background relative">
      {/* Header / Jae Presence */}
      <header className="p-4 border-b border-border/40 bg-white/50 backdrop-blur-sm sticky top-0 z-10 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-secondary/30 flex items-center justify-center border border-white shadow-sm">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="font-serif font-semibold text-lg">Jae</h1>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Online
          </p>
        </div>
      </header>

      {/* Chat Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-6 pb-32 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed"
      >
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-end gap-2 mb-4 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'jae' && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-secondary/30 flex items-center justify-center border border-white shadow-sm shrink-0 mb-1">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
              )}

              <div 
                className={`max-w-[80%] px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.sender === 'user' 
                    ? 'bg-primary text-primary-foreground rounded-br-sm' 
                    : 'bg-white text-foreground rounded-bl-sm border border-border/50'
                }`}
              >
                {msg.text}
              </div>

              {msg.sender === 'user' && (
                 <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border border-white shadow-sm shrink-0 mb-1">
                    <div className="w-4 h-4 bg-primary rounded-full opacity-50" />
                 </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isTyping && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-muted-foreground text-xs ml-4"
          >
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" />
            </div>
            Jae is thinking...
          </motion.div>
        )}
      </div>

      {/* Input Area + Suggestions */}
      <div className="absolute bottom-[4.5rem] w-full p-4 flex flex-col gap-3 bg-gradient-to-t from-white via-white/90 to-transparent pt-8">
        {/* Suggestion Chips */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mask-linear-fade">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSend(s)}
              className="whitespace-nowrap px-4 py-2 bg-secondary/50 hover:bg-secondary text-secondary-foreground text-xs rounded-full border border-secondary-foreground/10 transition-colors flex items-center gap-2 shadow-sm"
            >
              <Lightbulb className="w-3 h-3" />
              {s}
            </button>
          ))}
        </div>

        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex gap-2 items-center"
        >
          <Input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="rounded-full bg-white border border-border shadow-lg h-12 px-6 focus-visible:ring-1 focus-visible:ring-primary"
          />
          <Button 
            type="submit" 
            size="icon" 
            className="rounded-full h-12 w-12 shrink-0 bg-primary hover:bg-primary/90 shadow-md"
            disabled={!input.trim()}
          >
            <Send className="w-5 h-5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
