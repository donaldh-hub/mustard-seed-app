import { useState, useRef, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Plus, Camera, Image, X, Droplets, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLocation } from "wouter";
import { useUpload } from "@/hooks/use-upload";
import JaeAvatar from "@assets/file_000000006e04620e9931a4040836810b_1771384491714.png";

const stageEmoji: Record<string, string> = { seed: "🌱", sprout: "🌿", growth: "🌳", bloom: "🌸" };

export default function Chat() {
  const userId = useStore((s) => s.userId);
  const [, setLocation] = useLocation();
  const [input, setInput] = useState("");
  const [showAttach, setShowAttach] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<{ file: File; url: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const { uploadFile, isUploading } = useUpload();

  useEffect(() => {
    if (!userId) setLocation("/");
  }, [userId]);

  const { data: assessment, isLoading: assessmentLoading } = useQuery({
    queryKey: ["assessment", userId],
    queryFn: () => api.getAssessment(userId!),
    enabled: !!userId,
  });

  useEffect(() => {
    if (!assessmentLoading && !assessment && userId) {
      setLocation("/assessment");
    }
  }, [assessment, assessmentLoading, userId]);

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

  const photoMutation = useMutation({
    mutationFn: async ({ file, caption }: { file: File; caption: string }) => {
      const uploadResult = await uploadFile(file);
      if (!uploadResult) throw new Error("Upload failed");

      const localDate = new Date().toISOString().split("T")[0];

      return api.sendPhoto(userId!, {
        photoUrl: uploadResult.objectPath,
        caption: caption || undefined,
        localDate,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", userId] });
      qc.invalidateQueries({ queryKey: ["user", userId] });
      qc.invalidateQueries({ queryKey: ["entries", userId] });
      qc.invalidateQueries({ queryKey: ["photo-memories", userId] });
      qc.invalidateQueries({ queryKey: ["garden", userId] });
      setPhotoPreview(null);
      setInput("");
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sendMutation.isPending, photoMutation.isPending]);

  const handleSend = () => {
    if (photoPreview) {
      photoMutation.mutate({ file: photoPreview.file, caption: input.trim() });
      return;
    }
    if (!input.trim() || sendMutation.isPending) return;
    const text = input;
    setInput("");
    sendMutation.mutate(text);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) return;

    const url = URL.createObjectURL(file);
    setPhotoPreview({ file, url });
    setShowAttach(false);
    e.target.value = "";
  };

  const clearPreview = () => {
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview.url);
      setPhotoPreview(null);
    }
  };

  if (!userId) return null;

  const isBusy = sendMutation.isPending || photoMutation.isPending || isUploading;

  return (
    <div className="h-full flex flex-col bg-background relative">
      <header className="p-4 border-b border-border/40 bg-white/50 backdrop-blur-sm sticky top-0 z-10 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-secondary/30 flex items-center justify-center border border-white shadow-sm overflow-hidden">
          <img src={JaeAvatar} alt="Jae" className="w-full h-full object-cover" />
        </div>
        <div>
          <h1 className="font-serif font-semibold text-lg" data-testid="text-jae-name">Jae M. Seed</h1>
          <p className="text-xs text-muted-foreground flex items-center gap-1" data-testid="text-current-stage">
            {assessment ? (
              <>
                Current Stage: {assessment.stage.charAt(0).toUpperCase() + assessment.stage.slice(1)} {stageEmoji[assessment.stage] || ""}
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Online
              </>
            )}
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
              Ready when you are. What's on your mind?
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
                className={`max-w-[80%] rounded-2xl shadow-sm text-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-white text-foreground rounded-bl-sm border border-border/50'
                }`}
              >
                {msg.messageType === 'photo' && msg.photoUrl && (
                  <div className="relative">
                    <img
                      src={msg.photoUrl}
                      alt="Photo"
                      className="w-full rounded-t-2xl object-cover max-h-48"
                      data-testid={`img-photo-${msg.id}`}
                    />
                    {msg.status === 'pending_analysis' && (
                      <div className="absolute inset-0 bg-black/30 rounded-t-2xl flex items-center justify-center">
                        <div className="flex items-center gap-2 text-white text-xs bg-black/50 px-3 py-1.5 rounded-full">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Reviewing...
                        </div>
                      </div>
                    )}
                    {msg.status === 'analyzed' && msg.analysisJson && (msg.analysisJson as any).water_award > 0 && (
                      <div className="absolute top-2 right-2 flex items-center gap-1 bg-blue-500/90 text-white text-xs px-2 py-1 rounded-full" data-testid={`badge-water-${msg.id}`}>
                        <Droplets className="w-3 h-3" />
                        +{(msg.analysisJson as any).water_award}
                      </div>
                    )}
                  </div>
                )}
                <div className="px-4 py-3 whitespace-pre-wrap">
                  {msg.text}
                </div>
              </div>

              {msg.sender === 'user' && (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border border-white shadow-sm shrink-0 mb-1">
                  <div className="w-4 h-4 bg-primary rounded-full opacity-50" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isBusy && (
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
            {photoMutation.isPending || isUploading ? "Uploading & analyzing..." : "Jae is thinking..."}
          </motion.div>
        )}
      </div>

      <div className="absolute bottom-[4.5rem] w-full p-4 flex flex-col gap-3 bg-gradient-to-t from-white via-white/90 to-transparent pt-8">
        <AnimatePresence>
          {photoPreview && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-primary shadow-md"
            >
              <img src={photoPreview.url} alt="Preview" className="w-full h-full object-cover" />
              <button
                onClick={clearPreview}
                className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5"
                data-testid="button-clear-preview"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showAttach && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex gap-2 mb-1"
            >
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-border shadow-sm text-sm hover:bg-muted transition-colors"
                data-testid="button-take-photo"
              >
                <Camera className="w-4 h-4 text-primary" />
                Take Photo
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-border shadow-sm text-sm hover:bg-muted transition-colors"
                data-testid="button-choose-gallery"
              >
                <Image className="w-4 h-4 text-primary" />
                Gallery
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex gap-2 items-center"
        >
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="rounded-full h-12 w-12 shrink-0 border border-border shadow-sm bg-white hover:bg-muted"
            onClick={() => setShowAttach(!showAttach)}
            disabled={isBusy}
            data-testid="button-attach"
          >
            <Plus className={`w-5 h-5 transition-transform ${showAttach ? 'rotate-45' : ''}`} />
          </Button>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={photoPreview ? "Add a caption (optional)..." : "Type a message..."}
            className="rounded-full bg-white border border-border shadow-lg h-12 px-6 focus-visible:ring-1 focus-visible:ring-primary"
            data-testid="input-chat"
          />
          <Button
            type="submit"
            size="icon"
            className="rounded-full h-12 w-12 shrink-0 bg-primary hover:bg-primary/90 shadow-md"
            disabled={(!input.trim() && !photoPreview) || isBusy}
            data-testid="button-send"
          >
            <Send className="w-5 h-5" />
          </Button>
        </form>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
          data-testid="input-file-gallery"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelect}
          data-testid="input-file-camera"
        />
      </div>
    </div>
  );
}
