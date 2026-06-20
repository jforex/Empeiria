/**
 * Specialist STREAM. Presented with a real settlement tx (proof of payment),
 * the specialist retrieves its domain slice and streams each judgment live (SSE).
 * The specialist does AND shows its own work.
 */
import { NextRequest } from "next/server";
import { specialistRetrieve, judgeOne } from "@/lib/specialist";

function sse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ domain: string }> }) {
  const { domain } = await ctx.params;
  const url = new URL(req.url);
  const question = url.searchParams.get("q");
  const proof = url.searchParams.get("proof"); // settlement tx from the gate

  if (!question || !proof) {
    return new Response("q and proof required", { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (e: unknown) => controller.enqueue(enc.encode(sse(e)));

      try {
        send({ type: "specialist_start", domain, proof });

        const candidates = await specialistRetrieve(domain, question);
        send({ type: "retrieved", count: candidates.length });

        for (const c of candidates) {
          const judged = await judgeOne(domain, question, c);
          send({
            type: "judgment",
            id: judged.id,
            title: judged.title,
            relevance: judged.relevance,
            reason: judged.judge_reason,
            kept: judged.relevance >= 0.5,
            contributor_id: judged.contributor_id,
            quality_score: judged.quality_score,
            body: judged.body,
          });
        }

        send({ type: "specialist_done" });
      } catch (err) {
        send({ type: "error", message: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
