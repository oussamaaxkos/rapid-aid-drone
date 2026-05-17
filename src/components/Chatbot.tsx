import { useEffect, useRef, useState } from "react";
import { Send, Bot, User, Siren, Mic, MicOff, ImagePlus, X } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";

// Web Speech API types
type SpeechRecognitionType = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

const getSR = (): (new () => SpeechRecognitionType) | null => {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};

const fileToDataURL = (file: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

export default function Chatbot({ onReclaim }: { onReclaim: () => void }) {
  const [input, setInput] = useState("");
  const [image, setImage] = useState<{ url: string; name: string } | null>(null);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionType | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    messages: [
      {
        id: "intro",
        role: "assistant",
        parts: [
          {
            type: "text",
            text: "Salam! Ana **MediBot** 馃┖锔�\n\nKan3awnek f l9adaya tobbiya b darija. T9der:\n- Tketbni wla thder m3aya b sotk 馃帳\n- Tsiftli tswira dyal jar7 wla situation 馃摳\n- T9lab 3la **RECLAIM** ila l 7ala khatira",
          },
        ],
      },
    ] as UIMessage[],
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const toggleVoice = () => {
    const SR = getSR();
    if (!SR) {
      alert("Voice maktach mde3ma f had l navigateur. Jarrab Chrome.");
      return;
    }
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.lang = "ar-MA";
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let txt = "";
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      setInput(txt);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = await fileToDataURL(f);
    setImage({ url, name: f.name });
    e.target.value = "";
  };

  const send = async () => {
    const text = input.trim();
    if (!text && !image) return;
    if (listening) recRef.current?.stop();

    if (image) {
      await sendMessage({
        role: "user",
        parts: [
          { type: "text", text: text || "Chno kayn f had tswira?" },
          { type: "file", mediaType: image.url.split(";")[0].split(":")[1], url: image.url },
        ],
      } as unknown as UIMessage);
    } else {
      await sendMessage({ text });
    }
    setInput("");
    setImage(null);
  };

  const busy = status === "submitted" || status === "streaming";

  return (
    <div className="flex flex-col h-full">
      <header className="px-5 pt-6 pb-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-primary/20 grid place-items-center ring-1 ring-primary/40">
            <Bot className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-semibold">MediBot 路 Darija</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-success animate-pulse" />
              {busy ? "Kayktib..." : "Online 路 Medical assistant"}
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((m) => {
          const isUser = m.role === "user";
          return (
            <div key={m.id} className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
              {!isUser && (
                <div className="size-7 shrink-0 rounded-full bg-primary/15 grid place-items-center mt-auto">
                  <Bot className="size-3.5 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed space-y-2 ${
                  isUser
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-card text-card-foreground rounded-bl-sm border border-border/60"
                }`}
              >
                {m.parts.map((p, i) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const part = p as any;
                  if (part.type === "text")
                    return (
                      <div key={i} className="prose prose-sm dark:prose-invert max-w-none [&>*]:my-1">
                        <ReactMarkdown>{part.text}</ReactMarkdown>
                      </div>
                    );
                  if (part.type === "file" && typeof part.mediaType === "string" && part.mediaType.startsWith("image/"))
                    return <img key={i} src={part.url} alt="" className="rounded-lg max-h-48 object-cover" />;
                  return null;
                })}
              </div>
              {isUser && (
                <div className="size-7 shrink-0 rounded-full bg-secondary grid place-items-center mt-auto">
                  <User className="size-3.5" />
                </div>
              )}
            </div>
          );
        })}
        {busy && (
          <div className="flex gap-1.5 px-3 py-2">
            <span className="size-2 rounded-full bg-primary/60 animate-bounce" />
            <span className="size-2 rounded-full bg-primary/60 animate-bounce [animation-delay:120ms]" />
            <span className="size-2 rounded-full bg-primary/60 animate-bounce [animation-delay:240ms]" />
          </div>
        )}
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
          RECLAIM — Urgence
        </button>

        {image && (
          <div className="relative inline-flex items-center gap-2 bg-card border border-border rounded-xl p-2">
            <img src={image.url} alt="" className="size-12 rounded-lg object-cover" />
            <span className="text-xs text-muted-foreground max-w-[160px] truncate">{image.name}</span>
            <button
              onClick={() => setImage(null)}
              className="size-6 rounded-full bg-muted grid place-items-center"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        <div className="flex gap-2 items-center bg-card border border-border rounded-2xl px-2 py-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
          <button
            onClick={() => fileRef.current?.click()}
            className="size-9 rounded-xl bg-secondary grid place-items-center active:scale-95"
            title="Sift tswira"
          >
            <ImagePlus className="size-4" />
          </button>
          <button
            onClick={toggleVoice}
            className={`size-9 rounded-xl grid place-items-center active:scale-95 ${
              listening ? "bg-emergency text-emergency-foreground animate-pulse" : "bg-secondary"
            }`}
            title="Hder b sotk"
          >
            {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !busy && send()}
            placeholder={listening ? "Kanst9ble sotk..." : "Ktbli b darija..."}
            disabled={busy}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground py-1.5 min-w-0"
          />
          <button
            onClick={send}
            disabled={busy || (!input.trim() && !image)}
            className="size-9 rounded-xl bg-primary text-primary-foreground grid place-items-center active:scale-95 transition disabled:opacity-50"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
