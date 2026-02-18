import { useState, useRef, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLocation } from "wouter";
import JaeAvatar from "@assets/file_000000006e04620e9931a4040836810b_1771384491714.png";

export default function Home() {
  const userId = useStore((s) => s.userId);
  const [, setLocation] = useLocation();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  useEffect(() => {
    if (!userId) setLocation("/");
  }, [userId]);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["messages", userId],
    queryFn: () => api.getMessages(userId!),
    enabled: !!userId,
  });

  const sendMutation = useMutation({
    mutationFn: (text: string) => api.sendMessage(userId!, text),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", userId] });
      qc.invalidateQueries({ queryKey: ["user", userId] });
      qc.invalidateQueries({ queryKey: ["entries", userId] });
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sendMutation.isPending]);

  const handleSend = () => {
    if (!input.trim() || sendMutation.isPending) return;
    const text = input;
    setInput("");
    sendMutation.mutate(text);
  };

  if (!userId) return null;

  return (
    <div className="h-full flex flex-col bg-background relative">
      <header className="p-4 border-b border-border/40 bg-white/50 backdrop-blur-sm sticky top-0 z-10 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-secondary/30 flex items-center justify-center border border-white shadow-sm overflow-hidden">
          <img src={JaeAvatar} alt="Jae" className="w-full h-full object-cover" />
        </div>
        <div>
          <h1 className="font-serif font-semibold text-lg">Jae</h1>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Online
          </p>
        </div>
      </header>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 pb-32"
      >
        {isLoading && (
          <div className="text-center text-muted-foreground text-sm py-8">Loading messages...</div>
        )}

        {!isLoading && messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-end gap-2 justify-start"
          >
            <div className="w-10 h-10 rounded-full overflow-hidden border border-white shadow-sm shrink-0 mb-1">
              <img src={JaeAvatar} alt="Jae" className="w-full h-full object-cover" />
            </div>
            <div className="max-w-[80%] px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed bg-white text-foreground rounded-bl-sm border border-border/50">
              Hi, I'm Jae. I'm here to help you grow, one small step at a time. Ready to begin?
            </div>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg: any) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-end gap-2 mb-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'jae' && (
                <div className="w-10 h-10 rounded-full overflow-hidden border border-white shadow-sm shrink-0 mb-1">
                  <img src={JaeAvatar} alt="Jae" className="w-full h-full object-cover" />
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

        {sendMutation.isPending && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-muted-foreground text-xs ml-14"
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

      <div className="absolute bottom-[4.5rem] w-full p-4 flex flex-col gap-3 bg-gradient-to-t from-white via-white/90 to-transparent pt-8">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex gap-2 items-center"
        >
          <Input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="rounded-full bg-white border border-border shadow-lg h-12 px-6 focus-visible:ring-1 focus-visible:ring-primary"
            data-testid="input-chat"
          />
          <Button 
            type="submit" 
            size="icon" 
            className="rounded-full h-12 w-12 shrink-0 bg-primary hover:bg-primary/90 shadow-md"
            disabled={!input.trim() || sendMutation.isPending}
            data-testid="button-send"
          >
            <Send className="w-5 h-5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
