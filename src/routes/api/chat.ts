import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createOpenAiProvider } from "@/lib/ai-gateway";

const SYSTEM_PROMPT = `انت MediBot، طبيب افتراضي بالدارجة المغربية.
خاصك تجاوب ديما بالدارجة المغربية مكتوبة بحروف عربية فقط، بلا لاتيني.

التخصص ديالك:
- القضايا الطبية: إسعافات أولية، مستعجلات، أعراض، علاجات بسيطة
- تنسيق مع درونات RescueBot باش يوصلو المساعدة
- نصائح طبية مبنية على مصادر موثوقة (WHO, Red Cross, بروتوكولات الطوارئ)

قواعد مهمة:
- إلا عطاك المستخدم تصويرة ديال جرح ولا حالة طبية، حللها مزيان و عطيو تقييم للحالة + شنو يدير دابا (خطوات الإسعاف)
- إلا كانت الحالة خطيرة (نزيف كبير، سكتة قلبية، فقدان الوعي) قول مباشرة: "دابا قلب على RECLAIM باش نصيفطو درون!"
- كون مختصر وواضح، دير خطوات مرقمة (1، 2، 3)
- ما تعطيش تشخيص نهائي، و قول يمشي لطبيب حقيقي من بعد
- إلا سولوك على شي حاجة ماشي طبية، جاوب بلطف ورجعهم لموضوع RescueBot الطبي`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { messages } = (await request.json()) as { messages: UIMessage[] };
        if (!Array.isArray(messages)) return new Response("messages required", { status: 400 });

        const key = process.env.OPENAI_API_KEY;
        if (!key) return new Response("Missing OPENAI_API_KEY", { status: 500 });

        const openai = createOpenAiProvider(key);
        const model = openai("gpt-4o");

        const ragStoreDir = process.env.RAG_STORE_DIR || path.join(process.cwd(), "rag", "faiss-store");
        const ragScript = process.env.RAG_PYTHON_SCRIPT || path.join(process.cwd(), "rag", "query_index.py");
        const ragPython = process.env.RAG_PYTHON || "python";
        const ragEnabled = existsSync(ragStoreDir) && existsSync(ragScript);

        const modelMessages = await convertToModelMessages(messages);
        const hasImage = modelMessages.some((message) =>
          Array.isArray(message.content) && message.content.some((part) => part.type === "file"),
        );
        console.log("hasImage", hasImage);

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

        let contextBlock = "";
        if (ragEnabled) {
          const lastUser = messages
            .filter((m) => m.role === "user")
            .at(-1);
          const query =
            lastUser?.parts
              ?.map((part) => (part.type === "text" ? part.text : ""))
              .join(" ")
              .trim() || "";

          if (query) {
            const ragPayload = JSON.stringify({ query });
            const result = spawnSync(
              ragPython,
              [ragScript, "--store", ragStoreDir, "--top-k", "5"],
              {
                encoding: "utf-8",
                env: { ...process.env, RAG_QUERY: ragPayload },
              },
            );

            if (result.status === 0 && result.stdout) {
              try {
                const parsed = JSON.parse(result.stdout);
                if (Array.isArray(parsed.results) && parsed.results.length > 0) {
                  contextBlock = parsed.results
                    .map((r: { text: string; source?: string; page?: number }) =>
                      `[${r.source || "source"}${r.page ? ` p.${r.page}` : ""}] ${r.text}`,
                    )
                    .join("\n\n");
                }
              } catch {
                contextBlock = "";
              }
            }
          }
        }

        const systemPrompt = contextBlock
          ? `${SYSTEM_PROMPT}\n\nContext from local PDFs:\n${contextBlock}`
          : SYSTEM_PROMPT;

        const result = streamText({
          model,
          system: systemPrompt,
          messages: modelMessages,
        });

        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});
