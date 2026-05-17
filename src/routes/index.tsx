import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import Chatbot from "@/components/Chatbot";
import ReclaimFlow from "@/components/ReclaimFlow";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RescueBot — Drone Emergency Response" },
      { name: "description", content: "Chat with RescueBot and dispatch the closest medical drone to your location in seconds." },
    ],
  }),
  component: Index,
});

function Index() {
  const [view, setView] = useState<"chat" | "reclaim">("chat");
  return (
    <main className="min-h-screen flex items-center justify-center p-0 sm:p-6">
      <div className="w-full max-w-md h-screen sm:h-[860px] sm:rounded-[2.5rem] sm:border sm:border-border overflow-hidden bg-background sm:shadow-2xl flex flex-col">
        {view === "chat"
          ? <Chatbot onReclaim={() => setView("reclaim")} />
          : <ReclaimFlow onBack={() => setView("chat")} />}
      </div>
    </main>
  );
}
