import { parseOffice } from "officeparser";

// Server-side text extraction — the Stage-2 counterpart of scripts/extract_text.py.
// Location granularity is coarser than the Python tool (officeparser flattens
// structure), so [src:] tags fall back to file-level + paragraph index.

export const SUPPORTED_EXTENSIONS = [".pptx", ".docx", ".pdf", ".txt", ".md", ".vtt", ".srt"];
export const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
export const AUDIO_EXTENSIONS = [".mp3", ".wav", ".m4a", ".ogg"];

export function fileKind(name: string): "document" | "image" | "audio" | "unsupported" {
  const ext = "." + (name.split(".").pop() ?? "").toLowerCase();
  if (SUPPORTED_EXTENSIONS.includes(ext)) return "document";
  if (IMAGE_EXTENSIONS.includes(ext)) return "image";
  if (AUDIO_EXTENSIONS.includes(ext)) return "audio";
  return "unsupported";
}

// Cap extracted text per file — bounds Claude input cost and stage latency.
const MAX_EXTRACT_CHARS = 300_000;

function capText(text: string): string {
  if (text.length <= MAX_EXTRACT_CHARS) return text;
  return text.slice(0, MAX_EXTRACT_CHARS) + `\n[TRUNCATED: file text exceeded ${MAX_EXTRACT_CHARS} chars — remainder not ingested]`;
}

/** Extract raw text with per-block markers the ingest stage turns into [src:] tags. */
export async function extractText(name: string, buffer: Buffer): Promise<string> {
  const ext = "." + (name.split(".").pop() ?? "").toLowerCase();
  const header = `=== FILE: ${name} ===`;

  if ([".txt", ".md", ".vtt", ".srt"].includes(ext)) {
    return `${header}\n${capText(buffer.toString("utf-8"))}`;
  }

  if ([".pptx", ".docx", ".pdf"].includes(ext)) {
    try {
      const ast = await parseOffice(buffer);
      const text = capText(ast.toText());
      const blocks = text
        .split(/\n+/)
        .map((l: string) => l.trim())
        .filter(Boolean)
        .map((l: string, i: number) => `[block-${i + 1}] ${l}`)
        .join("\n");
      return `${header}\n${blocks || "[UNREADABLE: no extractable text]"}`;
    } catch (e) {
      return `${header}\n[UNREADABLE: ${e instanceof Error ? e.message : "extraction failed"}]`;
    }
  }

  return `${header}\n[UNREADABLE: unsupported extension ${ext}]`;
}

export function mediaTypeForImage(name: string): string {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  return ext === "jpg" ? "image/jpeg" : `image/${ext}`;
}
