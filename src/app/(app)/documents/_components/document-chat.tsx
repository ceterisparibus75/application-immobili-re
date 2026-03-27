"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Bot, User } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };

export function DocumentChat({ documentId }: { documentId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: Message = { role: "user", content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setLoading(true);
    try {
      const r = await fetch(`/api/documents/${documentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      if (r.ok) {
        const data = (await r.json()) as { reply: string };
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "Une erreur s’est produite." }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Erreur de connexion." }]);
    } finally {
      setLoading(false);
    }
  }

  const SUGGESTIONS = [
    "Résume ce document",
    "Quelles sont les dates importantes ?",
    "Qui sont les parties ?",
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      {messages.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-6 text-center">
          <Bot className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground max-w-xs">
            Posez vos questions sur ce document. L’IA a accès à l’intégralité de son contenu.
          </p>
          <div className="flex flex-wrap gap-2 justify-center mt-1">
            {SUGGESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => setInput(q)}
                className="text-xs px-2.5 py-1 rounded-full border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.length > 0 && (
        <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && <Bot className="h-5 w-5 text-violet-500 shrink-0 mt-0.5" />}
              <div
                className={`rounded-lg px-3 py-2 text-sm max-w-[85%] whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {m.content}
              </div>
              {m.role === "user" && <User className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />}
            </div>
          ))}
          {loading && (
            <div className="flex gap-2 justify-start">
              <Bot className="h-5 w-5 text-violet-500 shrink-0 mt-0.5" />
              <div className="rounded-lg px-3 py-2 bg-muted">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      <div className="flex gap-2 pt-3 border-t mt-auto shrink-0">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Posez une question sur ce document..."
          className="min-h-[56px] max-h-[120px] resize-none text-sm"
          disabled={loading}
        />
        <Button
          onClick={() => void send()}
          disabled={loading || !input.trim()}
          size="icon"
          className="shrink-0 self-end"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
