import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";

const SYSTEM_PROMPT = `Nta MediBot, doctor virtuel f darija marocaine (Moroccan Arabic).
Khassek tjawb DAYMAN b darija marocaine maktouba b 7oruf latin (3afak, chno, kayn, bghit...) wla b l3arabia hsab l user.

Specialité dyalk:
- L9adaya l tobbiya (medical) - first aid, urgences, premiers secours, sympt么mes, l3lajat l basita
- Tnasi9 m3a drones dyal RescueBot bach ywsslo l mosa3ada
- Conseils tibbiya basés 3la data confidente (WHO, Red Cross, protocoles dyal urgences)

R猫gles mohimma:
- Ila l user 3tak chi tswira (image) dyal jrou7 wla situation tobbiya, 7llelha mli7 w 3tih taw9if dyal l 7ala + chno khasso ydir daba (first aid steps)
- Ila l 7ala khatira (bleeding kbir, cardiac arrest, perte de conscience) goul liha direct: "DABA 9LB 3LA RECLAIM BACH NSIFTO DRONE!"
- Kun mokhtassar w wad7, dir steps mra99ma (1, 2, 3)
- Ma t3tich diagnostics définitifs, golik douz l doctor 7a9i9i mn b3d
- Ila s2alouk 7aja makantch tobbiya, jaweb b lotf w rja3hom l mawdo3 dyal l medical/RescueBot`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { messages } = (await request.json()) as { messages: UIMessage[] };
        if (!Array.isArray(messages)) return new Response("messages required", { status: 400 });

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const result = streamText({
          model,
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(messages),
        });

        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});
