import { useMemo, useState } from "react";
import { ArrowLeft, Send, CheckCircle2, Plane, MapPin, HeartPulse } from "lucide-react";
import DroneMap3D, { type Drone } from "./DroneMap3D";

// Drones spread across the rural valley (parked on terrain)
const DRONES: Drone[] = [
  { id: "DR-01", position: [3.2, 0, 2.6] },
  { id: "DR-02", position: [-3.6, 0, 1.4] },
  { id: "DR-03", position: [1.6, 0, -3.2] },
  { id: "DR-04", position: [-2.2, 0, 3.4] },
  { id: "DR-05", position: [4.0, 0, -1.6] },
];

// Atlas Mountains region (Morocco) — High Atlas approx coordinates
const PATIENT_GPS = { lat: 31.0596, lng: -7.9135 };

const INJURIES = ["Bleeding", "Cardiac", "Breathing", "Trauma", "Burn", "Other"];

const FIRST_AID: Record<string, string> = {
  Bleeding: "Apply firm pressure with a clean cloth. Elevate the wound above the heart if possible. Do not remove embedded objects.",
  Cardiac: "Sit the person down, loosen tight clothing. If unresponsive and not breathing, start CPR: 30 chest compressions, 2 breaths.",
  Breathing: "Keep the person upright, loosen clothing. Stay calm and encourage slow breaths. Clear the airway of any obstruction.",
  Trauma: "Do not move the person if a spinal injury is suspected. Keep them still and warm. Control any bleeding.",
  Burn: "Cool the burn with running water for 20 minutes. Do not apply ice, butter, or creams. Cover loosely with clean cloth.",
  Other: "Keep the patient calm, warm and still. Monitor breathing and consciousness until the drone arrives.",
};

export default function ReclaimFlow({ onBack }: { onBack: () => void }) {
  const [name, setName] = useState("");
  const [injury, setInjury] = useState("Bleeding");
  const [severity, setSeverity] = useState(3);
  const [notes, setNotes] = useState("");
  const [dispatched, setDispatched] = useState(false);
  const [showAid, setShowAid] = useState(false);

  const closest = useMemo(() => {
    let best = DRONES[0], bestD = Infinity;
    for (const d of DRONES) {
      const dist = Math.hypot(d.position[0], d.position[2]);
      if (dist < bestD) { bestD = dist; best = d; }
    }
    // convert scene units → ~km (1 unit ≈ 0.4 km for display)
    return { drone: best, distance: bestD * 0.4 };
  }, []);

  const send = () => setDispatched(true);

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 pt-5 pb-3 flex items-center gap-3 border-b border-border/50">
        <button onClick={onBack} className="size-9 rounded-xl bg-card border border-border grid place-items-center active:scale-95">
          <ArrowLeft className="size-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold">High Atlas · Rural Relief</h1>
          <p className="text-xs text-muted-foreground truncate">{DRONES.length} drones on ground · Closest {closest.distance.toFixed(1)} km</p>
        </div>
        <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emergency/20 text-emergency border border-emergency/40 animate-pulse">LIVE</span>
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
            ALT 1840m · ATLAS
          </div>
        </div>

        {dispatched && (
          <div className="absolute bottom-3 left-3 right-3 px-3 py-2 rounded-xl bg-success/15 border border-success/40 backdrop-blur text-xs font-medium text-success flex items-center gap-2">
            <Plane className="size-4" /> {closest.drone.id} took off — ETA 3m 20s
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
                  <p className="text-sm font-semibold">What should I do? — First Aid</p>
                  <p className="text-[11px] text-muted-foreground">Guidance for: {injury}</p>
                </div>
              </div>
              <span className="text-xs text-primary">{showAid ? "Hide" : "Show"}</span>
            </button>
            {showAid && (
              <div className="px-4 pb-4 text-xs leading-relaxed text-foreground/85 border-t border-border/60 pt-3">
                {FIRST_AID[injury]}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Your name</label>
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="mt-1 w-full bg-input border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Medical need</label>
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
              <label className="text-xs font-medium text-muted-foreground">Severity</label>
              <span className="text-xs font-semibold text-emergency">{severity}/5</span>
            </div>
            <input
              type="range" min={1} max={5} value={severity}
              onChange={(e) => setSeverity(Number(e.target.value))}
              className="w-full mt-2 accent-[oklch(0.65_0.25_25)]"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Describe the situation</label>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={3} placeholder="What happened? Who is affected?"
              className="mt-1 w-full bg-input border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <button
            onClick={send}
            className="w-full h-13 py-3.5 rounded-2xl font-bold text-emergency-foreground flex items-center justify-center gap-2 active:scale-[0.98] transition"
            style={{ background: "var(--gradient-emergency)", boxShadow: "var(--shadow-emergency)" }}
          >
            <Send className="size-4" /> Send & Launch Drone
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4">
          <div className="flex flex-col items-center text-center gap-3 py-4">
            <div className="size-16 rounded-full bg-success/20 grid place-items-center ring-2 ring-success/40">
              <CheckCircle2 className="size-8 text-success" />
            </div>
            <h2 className="text-lg font-bold">Drone in the air</h2>
            <p className="text-sm text-muted-foreground max-w-[280px]">
              {closest.drone.id} has lifted off and is flying through the Atlas valley to reach you.
            </p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <Row label="Patient" value={name || "—"} />
            <Row label="GPS" value={`${PATIENT_GPS.lat.toFixed(4)}°, ${PATIENT_GPS.lng.toFixed(4)}°`} mono />
            <Row label="Condition" value={injury} />
            <Row label="Severity" value={`${severity}/5`} />
            <Row label="Drone" value={closest.drone.id} />
            <Row label="Distance" value={`${closest.distance.toFixed(2)} km`} />
            <Row label="ETA" value="3m 20s" highlight />
          </div>

          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <HeartPulse className="size-4 text-emergency" />
              <p className="text-sm font-semibold">While you wait — First Aid</p>
            </div>
            <p className="text-xs leading-relaxed text-foreground/85">{FIRST_AID[injury]}</p>
          </div>

          <button onClick={onBack} className="w-full py-3 rounded-2xl bg-card border border-border text-sm font-medium active:scale-[0.98]">
            Back to chat
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
