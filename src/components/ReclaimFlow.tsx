import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Send, CheckCircle2, Plane, MapPin, HeartPulse, Mic, MicOff, ImagePlus, X } from "lucide-react";
import DroneMap3D, { type Drone } from "./DroneMap3D";

// Drones spread across the rural valley (parked on terrain)
const DRONES: Drone[] = [
  { id: "DR-01", position: [3.2, 0, 2.6] },
  { id: "DR-02", position: [-3.6, 0, 1.4] },
  { id: "DR-03", position: [1.6, 0, -3.2] },
  { id: "DR-04", position: [-2.2, 0, 3.4] },
  { id: "DR-05", position: [4.0, 0, -1.6] },
];

  // Rural Morocco (approx coordinates)
const PATIENT_GPS = { lat: 31.0596, lng: -7.9135 };

const INJURIES = ["Bleeding", "Cardiac", "Breathing", "Trauma", "Burn", "Other"];

const FIRST_AID: Record<string, string> = {
  Bleeding: "اضغط بقوة على الجرح بقطعة قماش نظيفة. ارفع الجرح فوق مستوى القلب إن أمكن. لا تزيل الأجسام المغروسة.",
  Cardiac: "اجعل الشخص يجلس وأرخِ الملابس الضيقة. إذا كان لا يستجيب ولا يتنفس، ابدأ الإنعاش: 30 ضغطة صدرية ثم نَفَسَين.",
  Breathing: "أبقِ الشخص جالسا، وأرخِ الملابس. اهدأ وشجّعه على تنفس ببطء. نظّف مجرى الهواء من أي عائق.",
  Trauma: "لا تحرّك المصاب إذا شُكّ بإصابة في العمود الفقري. أبقه ثابتا ودافئا. تحكم في أي نزيف.",
  Burn: "برّد الحرق بماء جارٍ لمدة 20 دقيقة. لا تضع الثلج أو الزبدة أو الكريمات. غطّه بقطعة قماش نظيفة بخفة.",
  Other: "أبقِ المصاب هادئا ودافئا وثابتا. راقب التنفس والوعي حتى وصول الدرون.",
};

type SpeechRecognitionType = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onstart: (() => void) | null;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e?: { error?: string }) => void) | null;
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

export default function ReclaimFlow({ onBack }: { onBack: () => void }) {
  const [name, setName] = useState("");
  const [injury, setInjury] = useState("Bleeding");
  const [gender, setGender] = useState<"ذكر" | "أنثى" | "غير محدد">("غير محدد");
  const [age, setAge] = useState("");
  const [severity, setSeverity] = useState(3);
  const [notes, setNotes] = useState("");
  const [listening, setListening] = useState(false);
  const [images, setImages] = useState<Array<{ url: string; name: string }>>([]);
  const [analysis, setAnalysis] = useState<
    | null
    | {
        summary: string;
        suggestedGender?: string;
        suggestedAge?: string;
        suggestedTag?: string;
        severity?: number;
        urgency?: string;
      }
  >(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [dispatched, setDispatched] = useState(false);
  const [showAid, setShowAid] = useState(false);
  const recRef = useRef<SpeechRecognitionType | null>(null);
  const lastResultIndexRef = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const closest = useMemo(() => {
    let best = DRONES[0], bestD = Infinity;
    for (const d of DRONES) {
      const dist = Math.hypot(d.position[0], d.position[2]);
      if (dist < bestD) { bestD = dist; best = d; }
    }
    // convert scene units → ~km (1 unit ≈ 8.5 km for display)
    return { drone: best, distance: bestD * 8.5 };
  }, []);

  const toggleVoice = async () => {
    const SR = getSR();
    if (!SR) {
      alert("Voice maktach mde3ma f had l navigateur. Jarrab Chrome.");
      return;
    }
    if (listening) {
      recRef.current?.stop();
      return;
    }
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      alert("Khassk t3ti permission dyal microphone bash tkhddem.");
      return;
    }
    const rec = new SR();
    rec.lang = "ar-MA";
    rec.continuous = true;
    rec.interimResults = false;
    lastResultIndexRef.current = 0;
    rec.onstart = () => setListening(true);
    rec.onresult = (e) => {
      let combined = "";
      for (let i = lastResultIndexRef.current; i < e.results.length; i++) {
        const result = e.results[i];
        if (!result.isFinal) continue;
        combined += (combined ? " " : "") + result[0].transcript;
      }
      lastResultIndexRef.current = e.results.length;
      const finalText = combined.trim();
      if (finalText) {
        setNotes((prev) => (prev ? `${prev} ${finalText}` : finalText));
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = (e) => {
      setListening(false);
      if (e?.error === "not-allowed") {
        alert("Permission dyal microphone mrefda.");
      }
    };
    recRef.current = rec;
    rec.start();
  };

  const runAnalysis = async () => {
    if (!notes.trim() && images.length === 0) return;
    setAnalysisLoading(true);
    setAnalysisError(null);

    try {
      const response = await fetch("/api/reclaim-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes,
          images,
          selectedTag: injury,
          selectedGender: gender,
          selectedAge: age,
        }),
      });

      if (!response.ok) {
        throw new Error("Analyze failed");
      }

      const data = (await response.json()) as {
        summary: string;
        suggestedGender?: string;
        suggestedAge?: string;
        suggestedTag?: string;
        severity?: number;
        urgency?: string;
      };
      setAnalysis(data);
    } catch {
      setAnalysisError("Could not analyze this report.");
    } finally {
      setAnalysisLoading(false);
    }
  };

  const onPickImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const next = await Promise.all(
      files.map(async (f) => ({ url: await fileToDataURL(f), name: f.name })),
    );
    setImages((prev) => [...prev, ...next]);
    e.target.value = "";
  };

  const send = () => setDispatched(true);

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 pt-5 pb-3 flex items-center gap-3 border-b border-border/50">
        <button onClick={onBack} className="size-9 rounded-xl bg-card border border-border grid place-items-center active:scale-95">
          <ArrowLeft className="size-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold">المجال القروي · المغرب</h1>
          <p className="text-xs text-muted-foreground truncate">{DRONES.length} درونات على الأرض · الأقرب {closest.distance.toFixed(1)} كم</p>
        </div>
        <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emergency/20 text-emergency border border-emergency/40 animate-pulse">مباشر</span>
      </header>

      <div className="relative h-[42vh] bg-background border-b border-border/50">
        <DroneMap3D drones={DRONES} closestId={closest.drone.id} dispatched={dispatched} />

        {/* GPS coordinate badge */}
        <div className="absolute top-3 left-3 right-3 flex justify-between gap-2">
          <div className="px-2.5 py-1.5 rounded-lg bg-background/85 backdrop-blur border border-border/60 flex items-center gap-1.5 text-[10px] font-mono">
            <MapPin className="size-3 text-emergency" />
            {PATIENT_GPS.lat.toFixed(4)}°N, {Math.abs(PATIENT_GPS.lng).toFixed(4)}°W
          </div>
          <div className="px-2.5 py-1.5 rounded-lg bg-background/85 backdrop-blur border border-border/60 text-[10px] font-mono">
            الارتفاع 1840م · المغرب القروي
          </div>
        </div>

        {dispatched && (
          <div className="absolute bottom-3 left-3 right-3 px-3 py-2 rounded-xl bg-success/15 border border-success/40 backdrop-blur text-xs font-medium text-success flex items-center gap-2">
            <Plane className="size-4" /> {closest.drone.id} أقلعت — الوصول خلال 3د 20ث
          </div>
        )}

        {analysis && !dispatched && (
          <div className="absolute top-14 left-3 right-3 rounded-xl bg-background/90 backdrop-blur border border-border/60 p-3 text-xs space-y-2">
            <p className="font-semibold">فرز أولي بالذكاء الاصطناعي (أكد قبل الإرسال)</p>
            <p className="text-foreground/80">{analysis.summary}</p>
            <div className="flex flex-wrap gap-2">
              {analysis.suggestedGender && (
                <span className="px-2 py-1 rounded-full bg-card border border-border text-[10px]">
                  الجنس: {analysis.suggestedGender}
                </span>
              )}
              {analysis.suggestedAge && (
                <span className="px-2 py-1 rounded-full bg-card border border-border text-[10px]">
                  العمر: {analysis.suggestedAge}
                </span>
              )}
              {analysis.suggestedTag && (
                <span className="px-2 py-1 rounded-full bg-card border border-border text-[10px]">
                  التصنيف: {analysis.suggestedTag}
                </span>
              )}
              {analysis.severity && (
                <span className="px-2 py-1 rounded-full bg-card border border-border text-[10px]">
                  الشدة: {analysis.severity}/5
                </span>
              )}
              {analysis.urgency && (
                <span className="px-2 py-1 rounded-full bg-card border border-border text-[10px]">
                  الاستعجال: {analysis.urgency}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const nextTag = analysis.suggestedTag && INJURIES.includes(analysis.suggestedTag)
                    ? analysis.suggestedTag
                    : "Other";
                  setInjury(nextTag);

                  if (analysis.severity) {
                    setSeverity(Math.min(5, Math.max(1, analysis.severity)));
                  }

                  if (analysis.suggestedGender === "ذكر" || analysis.suggestedGender === "أنثى") {
                    setGender(analysis.suggestedGender);
                  }
                  if (analysis.suggestedAge) {
                    setAge(analysis.suggestedAge);
                  }

                  setAnalysis(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold"
              >
                اعتماد الاقتراح
              </button>
              <button
                onClick={() => setAnalysis(null)}
                className="px-3 py-1.5 rounded-lg bg-card border border-border text-[11px] font-semibold"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}
      </div>

      {!dispatched ? (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* First-aid assistant */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowAid((s) => !s)}
              className="w-full px-4 py-3 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-full bg-emergency/15 grid place-items-center">
                  <HeartPulse className="size-4 text-emergency" />
                </div>
                <div>
                  <p className="text-sm font-semibold">ماذا أفعل؟ — إسعاف أولي</p>
                  <p className="text-[11px] text-muted-foreground">إرشادات لـ: {injury}</p>
                </div>
              </div>
              <span className="text-xs text-primary">{showAid ? "إخفاء" : "عرض"}</span>
            </button>
            {showAid && (
              <div className="px-4 pb-4 text-xs leading-relaxed text-foreground/85 border-t border-border/60 pt-3">
                {FIRST_AID[injury]}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">الاسم الكامل</label>
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="الاسم الكامل"
              className="mt-1 w-full bg-input border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">الجنس</label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {["ذكر", "أنثى", "غير محدد"].map((g) => (
                <button
                  key={g}
                  onClick={() => setGender(g as "ذكر" | "أنثى" | "غير محدد")}
                  className={`px-2 py-2 rounded-xl text-xs font-medium border transition ${
                    gender === g
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border text-foreground/80"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">العمر</label>
            <input
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="العمر"
              className="mt-1 w-full bg-input border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">الحالة الطبية</label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {INJURIES.map((i) => (
                <button key={i} onClick={() => setInjury(i)}
                  className={`px-2 py-2 rounded-xl text-xs font-medium border transition ${
                    injury === i ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground/80"
                  }`}>
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center">
              <label className="text-xs font-medium text-muted-foreground">الشدة</label>
              <span className="text-xs font-semibold text-emergency">{severity}/5</span>
            </div>
            <input
              type="range" min={1} max={5} value={severity}
              onChange={(e) => setSeverity(Number(e.target.value))}
              className="w-full mt-2 accent-[oklch(0.65_0.25_25)]"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">صف الحالة</label>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={3} placeholder="ماذا حدث؟ من المتأثر؟"
              className="mt-1 w-full bg-input border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
            />
            <div className="mt-2 flex items-center gap-2">
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onPickImages} />
              <button
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl bg-card border border-border px-3 py-2 text-xs font-medium"
              >
                <ImagePlus className="size-4" /> إضافة صور
              </button>
              <button
                onClick={toggleVoice}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${
                  listening ? "bg-emergency text-emergency-foreground border-emergency" : "bg-card border-border"
                }`}
              >
                {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                {listening ? "جاري الاستماع..." : "تحدث"}
              </button>
              <button
                onClick={runAnalysis}
                disabled={analysisLoading || (!notes.trim() && images.length === 0)}
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold bg-primary text-primary-foreground disabled:opacity-50"
              >
                {analysisLoading ? "جار التحليل..." : "حلّل"}
              </button>
            </div>
            {analysisError && <p className="mt-2 text-[11px] text-emergency">تعذر تحليل التقرير.</p>}
            {images.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {images.map((img, idx) => (
                  <div key={`${img.name}-${idx}`} className="relative inline-flex items-center gap-2 bg-card border border-border rounded-xl p-2">
                    <img src={img.url} alt="" className="size-12 rounded-lg object-cover" />
                    <span className="text-[10px] text-muted-foreground max-w-[140px] truncate">{img.name}</span>
                    <button
                      onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                      className="size-6 rounded-full bg-muted grid place-items-center"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={send}
            className="w-full h-13 py-3.5 rounded-2xl font-bold text-emergency-foreground flex items-center justify-center gap-2 active:scale-[0.98] transition"
            style={{ background: "var(--gradient-emergency)", boxShadow: "var(--shadow-emergency)" }}
          >
            <Send className="size-4" /> إرسال وإطلاق الدرون
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4">
          <div className="flex flex-col items-center text-center gap-3 py-4">
            <div className="size-16 rounded-full bg-success/20 grid place-items-center ring-2 ring-success/40">
              <CheckCircle2 className="size-8 text-success" />
            </div>
            <h2 className="text-lg font-bold">الدرون في الجو</h2>
            <p className="text-sm text-muted-foreground max-w-[280px]">
              {closest.drone.id} أقلعت وتتجه عبر وادي الأطلس للوصول إليك.
            </p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <Row label="المريض" value={name || "—"} />
            <Row label="الإحداثيات" value={`${PATIENT_GPS.lat.toFixed(4)}°, ${PATIENT_GPS.lng.toFixed(4)}°`} mono />
            <Row label="الجنس" value={gender} />
            <Row label="العمر" value={age || "—"} />
            <Row label="الحالة" value={injury} />
            <Row label="الشدة" value={`${severity}/5`} />
            <Row label="ملاحظات" value={notes || "—"} />
            <Row label="الصور" value={images.length ? `${images.length} مرفقة` : "—"} />
            <Row label="الدرون" value={closest.drone.id} />
            <Row label="المسافة" value={`${closest.distance.toFixed(2)} كم`} />
            <Row label="وقت الوصول" value="3د 20ث" highlight />
          </div>

          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <HeartPulse className="size-4 text-emergency" />
              <p className="text-sm font-semibold">أثناء الانتظار — إسعاف أولي</p>
            </div>
            <p className="text-xs leading-relaxed text-foreground/85">{FIRST_AID[injury]}</p>
          </div>

          <button onClick={onBack} className="w-full py-3 rounded-2xl bg-card border border-border text-sm font-medium active:scale-[0.98]">
            الرجوع إلى الدردشة
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, highlight, mono }: { label: string; value: string; highlight?: boolean; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center text-sm gap-3">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`font-semibold text-right ${highlight ? "text-success" : ""} ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}
