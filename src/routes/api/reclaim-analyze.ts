import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createOpenAiProvider } from "@/lib/ai-gateway";

const TAGS = ["Bleeding", "Cardiac", "Breathing", "Trauma", "Burn", "Other"];

const SYSTEM_PROMPT = `أنت مساعد فرز طبي.
حلّل تقرير المستخدم (النص وأي صور). إذا كانت الصورة غير واضحة أو لا يمكن تحليلها، قل ذلك باختصار في الملخص وكمّل اعتمادا على النص.
الملخص وكل القيم النصية لازم تكون بالدارجة المغربية وبحروف عربية فقط.
  بعدها قدّم:
  - ملخص قصير
  - الجنس إذا تم ذكره ("ذكر" أو "أنثى" أو "غير محدد")
  - العمر إذا تم ذكره
  - تصنيف من اللائحة المسموح بها
  - شدة من 1 إلى 5
  - درجة الاستعجال (منخفض/متوسط/مرتفع/حرج)
  أرجع JSON فقط بالمفاتيح: summary, suggestedGender, suggestedAge, suggestedTag, severity, urgency.`;

export const Route = createFileRoute("/api/reclaim-analyze")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const { notes, images, selectedTag, selectedGender, selectedAge } = (await request.json()) as {
            notes?: string;
            images?: Array<{ url: string; name: string }>;
            selectedTag?: string;
            selectedGender?: string;
            selectedAge?: string;
          };

          const key = process.env.OPENAI_API_KEY;
          if (!key) return new Response("Missing OPENAI_API_KEY", { status: 500 });

          const openai = createOpenAiProvider(key);
          const model = openai("gpt-4o");

          const parts: UIMessage["parts"] = [];
          const textBlock = [
            notes ? `Notes: ${notes}` : "",
            selectedTag ? `Selected tag: ${selectedTag}` : "",
            selectedGender ? `Selected gender: ${selectedGender}` : "",
            selectedAge ? `Selected age: ${selectedAge}` : "",
            `Allowed tags: ${TAGS.join(", ")}`,
          ]
            .filter(Boolean)
            .join("\n");

          if (textBlock) {
            parts.push({ type: "text", text: textBlock });
          }

          for (const image of images ?? []) {
            const mediaType = image.url.split(";")[0].split(":")[1] || "image/jpeg";
            parts.push({ type: "file", mediaType, url: image.url });
          }

          const messages: UIMessage[] = [
            { id: "analysis", role: "user", parts },
          ];

          const modelMessages = await convertToModelMessages(messages);
          for (const message of modelMessages) {
            if (!Array.isArray(message.content)) continue;
            for (const part of message.content) {
              if (part.type === "file" && typeof part.data === "string" && part.data.startsWith("data:")) {
                const commaIndex = part.data.indexOf(",");
                if (commaIndex > -1) {
                  const base64 = part.data.slice(commaIndex + 1);
                  part.data = Buffer.from(base64, "base64");
                }
              }
            }
          }

          const result = streamText({
            model,
            system: SYSTEM_PROMPT,
            messages: modelMessages,
          });

          const response = await result.text;
          const cleaned = response
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/```\s*$/i, "")
            .trim();
          const lower = cleaned.toLowerCase();
          if (lower.includes("can't assist") || lower.includes("cannot assist") || lower.includes("i'm sorry")) {
            const fallbackSummary = notes
              ? `الوصف: ${notes}`
              : "لا يوجد وصف واضح. تعذر تحليل الصورة.";
            const fallbackGender =
              selectedGender === "ذكر" || selectedGender === "أنثى"
                ? selectedGender
                : "غير محدد";
            return Response.json({
              summary: fallbackSummary,
              suggestedGender: fallbackGender,
              suggestedAge: selectedAge || "",
              suggestedTag: selectedTag && TAGS.includes(selectedTag) ? selectedTag : "Other",
            });
          }
          try {
            const parsed = JSON.parse(cleaned);
            return Response.json(parsed);
          } catch {
            return Response.json({ summary: response });
          }
        } catch (error) {
          console.error("/api/reclaim-analyze error", error);
          return new Response("Reclaim analyze failed", { status: 500 });
        }
      },
    },
  },
});
