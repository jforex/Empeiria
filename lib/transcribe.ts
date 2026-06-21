/**
 * Transcription core — real speech-to-text via Groq Whisper large-v3.
 * Fetches the audio from a URL and returns the transcript text.
 */
const GROQ_WHISPER_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

export async function transcribeFromUrl(audioUrl: string): Promise<string> {
  // fetch the stored audio
  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) throw new Error(`Could not fetch audio: ${audioRes.status}`);
  const audioBlob = await audioRes.blob();

  // send to Groq Whisper
  const form = new FormData();
  form.append("file", audioBlob, "audio.webm");
  form.append("model", "whisper-large-v3");
  form.append("response_format", "text");

  const res = await fetch(GROQ_WHISPER_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.LLM_API_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Whisper failed: ${res.status} ${await res.text()}`);

  const text = await res.text();
  return text.trim();
}
