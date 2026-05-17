import { useEffect, useRef, useState } from "react";
import { Send, Bot, User, Siren } from "lucide-react";

interface Message { role: "bot" | "user"; text: string; }

const initialMessages: Message[] = [
  { role: "bot", text: "Hi, I'm RescueBot. I can answer questions or dispatch a medical drone." },
  { role: "bot", text: "Tap the red Reclaim button below if you need urgent help." },
];

const botReply = (input: string) => {
  const t = input.toLowerCase();
  if (t.includes("drone")) return "Our drones carry first-aid kits, defibrillators and medication. ETA is usually under 4 minutes.";
  if (t.includes("help") || t.includes("emergency")) return "For an emergency, please tap the Reclaim button — it will dispatch the closest drone.";
  return "I'm here to help. You can ask about drones, coverage, or tap Reclaim for an emergency.";
};

export default function Chatbot({ onReclaim }: { onReclaim: () => void }) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setTimeout(() => setMessages((m) => [...m, { role: "bot", text: botReply(text) }]), 500);
  };

  return (
    <div className="flex flex-col h-full">
      <header className="px-5 pt-6 pb-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-primary/20 grid place-items-center ring-1 ring-primary/40">
            <Bot className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-semibold">RescueBot</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-success animate-pulse" /> Online · Drones ready
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "bot" && (
              <div className="size-7 shrink-0 rounded-full bg-primary/15 grid place-items-center mt-auto">
                <Bot className="size-3.5 text-primary" />
              </div>
            )}
            <div className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
              m.role === "user"
                ? "bg-primary text-primary-foreground rounded-br-sm"
                : "bg-card text-card-foreground rounded-bl-sm border border-border/60"
            }`}>
              {m.text}
            </div>
            {m.role === "user" && (
              <div className="size-7 shrink-0 rounded-full bg-secondary grid place-items-center mt-auto">
                <User className="size-3.5" />
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="px-4 pb-3 pt-2 space-y-3">
        <button
          onClick={onReclaim}
          className="relative w-full h-14 rounded-2xl font-bold text-emergency-foreground text-base tracking-wide flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          style={{ background: "var(--gradient-emergency)", boxShadow: "var(--shadow-emergency)" }}
        >
          <span className="relative flex size-3">
            <span className="absolute inline-flex size-full rounded-full bg-white/70 opacity-75 animate-ping" />
            <span className="relative inline-flex size-3 rounded-full bg-white" />
          </span>
          <Siren className="size-5" />
          RECLAIM — Emergency
        </button>

        <div className="flex gap-2 items-center bg-card border border-border rounded-2xl px-3 py-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask RescueBot..."
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground py-1.5"
          />
          <button
            onClick={send}
            className="size-9 rounded-xl bg-primary text-primary-foreground grid place-items-center active:scale-95 transition"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
