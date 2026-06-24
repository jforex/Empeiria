/**
 * GitHub repo ingestion: fetch a repo's docs + source, chunk and embed them
 * into a repo knowledge agent. Reuses the core embed pipeline.
 */
import { createClient } from "@supabase/supabase-js";
import { embed } from "@/lib/agent-loop";
import { chunkText } from "@/lib/ingest";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const GH = "https://api.github.com";
function ghHeaders() {
  return {
    "Accept": "application/vnd.github+json",
    "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

// which files are worth ingesting
const INGEST_EXT = new Set([
  ".md", ".mdx", ".txt", ".rst",                         // docs
  ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs",     // source
  ".java", ".rb", ".php", ".c", ".cpp", ".h", ".cs",
  ".sol", ".swift", ".kt", ".sh", ".yaml", ".yml", ".toml",
]);
const SKIP_DIRS = ["node_modules/", ".git/", "dist/", "build/", ".next/", "vendor/", "target/", "__pycache__/", ".venv/"];
const SKIP_FILES = ["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "Cargo.lock", "poetry.lock"];
const MAX_FILES = 20;          // cap so ingestion stays bounded + under embed rate limits
const MAX_FILE_BYTES = 100_000; // skip huge files

function ext(path: string): string {
  const i = path.lastIndexOf(".");
  return i === -1 ? "" : path.slice(i).toLowerCase();
}
function wanted(path: string): boolean {
  if (SKIP_DIRS.some((d) => path.includes(d))) return false;
  if (SKIP_FILES.some((f) => path.endsWith(f))) return false;
  return INGEST_EXT.has(ext(path));
}

export interface RepoMeta {
  owner: string; name: string; fullName: string;
  description: string | null; stars: number; defaultBranch: string;
  ownerAvatar: string | null; ownerUrl: string;
}

/** Parse owner/name from a GitHub URL or "owner/name" string. */
export function parseRepo(input: string): { owner: string; name: string } | null {
  const s = input.trim().replace(/\.git$/, "");
  const m = s.match(/github\.com[/:]([^/]+)\/([^/]+)/) || s.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (!m) return null;
  return { owner: m[1], name: m[2] };
}

/** Fetch repo metadata. */
export async function fetchRepoMeta(owner: string, name: string): Promise<RepoMeta> {
  const res = await fetch(`${GH}/repos/${owner}/${name}`, { headers: ghHeaders() });
  if (!res.ok) throw new Error(`repo not found or inaccessible (${res.status})`);
  const r = await res.json();
  return {
    owner, name, fullName: r.full_name,
    description: r.description ?? null, stars: r.stargazers_count ?? 0,
    defaultBranch: r.default_branch ?? "main",
    ownerAvatar: r.owner?.avatar_url ?? null, ownerUrl: r.owner?.html_url ?? `https://github.com/${owner}`,
  };
}

/** Get the full file tree, filtered to ingestible files. */
async function fetchTree(owner: string, name: string, branch: string): Promise<string[]> {
  const res = await fetch(`${GH}/repos/${owner}/${name}/git/trees/${branch}?recursive=1`, { headers: ghHeaders() });
  if (!res.ok) throw new Error(`could not read repo tree (${res.status})`);
  const data = await res.json();
  const paths: string[] = (data.tree ?? [])
    .filter((n: { type: string; size?: number }) => n.type === "blob" && (n.size ?? 0) <= MAX_FILE_BYTES)
    .map((n: { path: string }) => n.path)
    .filter(wanted);
  // prioritize docs first, then source; cap the count
  paths.sort((a, b) => {
    const ad = /readme|docs?\//i.test(a) ? 0 : 1;
    const bd = /readme|docs?\//i.test(b) ? 0 : 1;
    return ad - bd;
  });
  return paths.slice(0, MAX_FILES);
}

/** Fetch a single file's text content. */
async function fetchFile(owner: string, name: string, path: string, branch: string): Promise<string> {
  const res = await fetch(`${GH}/repos/${owner}/${name}/contents/${encodeURIComponent(path)}?ref=${branch}`, { headers: ghHeaders() });
  if (!res.ok) return "";
  const data = await res.json();
  if (data.encoding === "base64" && data.content) {
    return Buffer.from(data.content, "base64").toString("utf-8");
  }
  return "";
}

export interface RepoIngestResult {
  filesIngested: number;
  chunks: number;
}

/**
 * Ingest a repo into a given repo_id (creator-style row): fetch tree, fetch files,
 * chunk + embed each, store as creator_chunks under the repo's creator_id.
 */
export async function ingestRepo(creatorId: string, owner: string, name: string, branch: string): Promise<RepoIngestResult> {
  const paths = await fetchTree(owner, name, branch);
  if (paths.length === 0) throw new Error("no ingestible files found in repo");

  let filesIngested = 0;
  let totalChunks = 0;

  for (const path of paths) {
    const content = await fetchFile(owner, name, path, branch);
    if (!content.trim() || content.length < 40) continue;

    // record the file as a content piece
    const { data: contentRow } = await db.from("creator_content").insert({
      creator_id: creatorId, source_name: path, source_type: "url",
      raw_chars: content.length, status: "processing",
    }).select().single();

    // prefix each chunk with the file path so answers can cite location
    const chunks = chunkText(content);
    let idx = 0;
  for (const chunk of chunks) {
      const text = `# ${path}\n${chunk}`;
      await new Promise((r) => setTimeout(r, 1200)); // throttle to respect embed rate limits
      const embedding = await embed(text);
      await db.from("creator_chunks").insert({
        creator_id: creatorId, content_id: contentRow?.id ?? null, chunk_index: idx,
        text, embedding,
      });
      idx++; totalChunks++;
    }
    if (contentRow) await db.from("creator_content").update({ status: "ready", chunk_count: chunks.length }).eq("id", contentRow.id);
    filesIngested++;
  }

  return { filesIngested, chunks: totalChunks };
}
