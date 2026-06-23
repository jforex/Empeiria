/**
 * Content ingestion: turn a creator's text into embedded, retrievable chunks.
 * Any input format (pasted text, audio transcript, PDF, URL) converges here once
 * it's plain text. Chunks are ~500 tokens with overlap, split on natural
 * boundaries so each chunk stays coherent.
 */
import { createClient } from "@supabase/supabase-js";
import { embed } from "@/lib/agent-loop";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ~4 chars per token; 500 tokens ≈ 2000 chars, 50-token overlap ≈ 200 chars
const CHUNK_CHARS = 2000;
const OVERLAP_CHARS = 200;

/** Split text into coherent, overlapping chunks on sentence/paragraph boundaries. */
export function chunkText(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= CHUNK_CHARS) return clean ? [clean] : [];

  // split into sentences, then greedily pack into chunks
  const sentences = clean.match(/[^.!?]+[.!?]+|\S+$/g) ?? [clean];
  const chunks: string[] = [];
  let cur = "";

  for (const s of sentences) {
    if ((cur + s).length > CHUNK_CHARS && cur) {
      chunks.push(cur.trim());
      // start next chunk with an overlap tail of the previous one
      cur = cur.slice(-OVERLAP_CHARS) + s;
    } else {
      cur += s;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

export interface IngestResult {
  contentId: string;
  chunkCount: number;
  rawChars: number;
}

/**
 * Ingest plain text for a creator: record the content, chunk it, embed each
 * chunk, store them. Returns the content id + chunk count.
 */
export async function ingestText(
  creatorId: string,
  text: string,
  sourceName: string,
  sourceType: "text" | "audio" | "pdf" | "url",
): Promise<IngestResult> {
  const rawChars = text.trim().length;

  // 1. record the content (status: processing)
  const { data: content, error: cErr } = await db.from("creator_content").insert({
    creator_id: creatorId, source_name: sourceName, source_type: sourceType,
    raw_chars: rawChars, status: "processing",
  }).select().single();
  if (cErr) throw cErr;

  try {
    // 2. chunk
    const chunks = chunkText(text);
    if (chunks.length === 0) throw new Error("no text to ingest");

    // 3. embed + store each chunk
    let idx = 0;
    for (const chunk of chunks) {
      const embedding = await embed(chunk);
      const { error: chErr } = await db.from("creator_chunks").insert({
        creator_id: creatorId, content_id: content.id, chunk_index: idx,
        text: chunk, embedding,
      });
      if (chErr) throw chErr;
      idx++;
    }

    // 4. mark ready
    await db.from("creator_content").update({ status: "ready", chunk_count: chunks.length }).eq("id", content.id);
    return { contentId: content.id, chunkCount: chunks.length, rawChars };
  } catch (err) {
    await db.from("creator_content").update({ status: "failed" }).eq("id", content.id);
    throw err;
  }
}
