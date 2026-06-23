/**
 * Creator content ingestion endpoint.
 * Accepts plain text (pasted), or an audio URL (reuses the existing Whisper
 * transcription pipeline), ingests it into the creator's knowledge agent.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ingestText } from "@/lib/ingest";
import { transcribeFromUrl } from "@/lib/transcribe";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const { creatorId, text, audioUrl, sourceName } = await req.json();

    if (!creatorId) {
      return NextResponse.json({ error: "creatorId required" }, { status: 400 });
    }

    // verify creator exists
    const { data: creator } = await db.from("creators").select("id, name").eq("id", creatorId).single();
    if (!creator) {
      return NextResponse.json({ error: "creator not found" }, { status: 404 });
    }

    let content = "";
    let type: "text" | "audio" = "text";
    let name = sourceName ?? "pasted text";

    if (audioUrl) {
      // reuse the existing Whisper pipeline
      content = await transcribeFromUrl(audioUrl);
      type = "audio";
      name = sourceName ?? "audio upload";
      if (!content.trim()) {
        return NextResponse.json({ error: "transcription returned empty" }, { status: 500 });
      }
    } else if (text?.trim()) {
      content = text;
    } else {
      return NextResponse.json({ error: "text or audioUrl required" }, { status: 400 });
    }

    if (content.trim().length < 100) {
      return NextResponse.json({ accepted: false, reason: "Content is too short to build a useful knowledge agent — add more." }, { status: 200 });
    }

    const result = await ingestText(creatorId, content, name, type);

    return NextResponse.json({
      accepted: true,
      contentId: result.contentId,
      chunks: result.chunkCount,
      chars: result.rawChars,
      transcript: type === "audio" ? content : undefined,
    });
  } catch (err) {
    return NextResponse.json({ error: "ingestion failed", message: (err as Error).message }, { status: 500 });
  }
}
