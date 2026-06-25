import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY as string;
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: NextRequest) {
  try {
    const data = await req.formData();
    const file: File | null = data.get('video') as unknown as File;
    const agent: string = data.get('agent') as string;
    const matchContext: string = data.get('matchContext') as string || 'No match context provided.';

    if (!file) return NextResponse.json({ error: 'No video uploaded' }, { status: 400 });

    // Grab the raw bytes into memory (NO HARD DRIVE NEEDED!)
    const bytes = await file.arrayBuffer();

    // 1. Upload directly to Google via REST API (Cloudflare safe)
    const uploadRes = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Command': 'start, upload, finalize',
        'X-Goog-Upload-Header-Content-Length': bytes.byteLength.toString(),
        'X-Goog-Upload-Header-Content-Type': file.type,
        'Content-Type': file.type,
      },
      body: bytes
    });

    const uploadData = await uploadRes.json();
    if (!uploadData.file) throw new Error("Failed to upload to Google AI.");

    const fileUri = uploadData.file.uri;
    const fileName = uploadData.file.name;
    const mimeType = uploadData.file.mimeType;

    // 2. Wait for Google to process the video on their end
    let fileState = uploadData.file.state;
    while (fileState === 'PROCESSING') {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const checkRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`);
      const checkData = await checkRes.json();
      fileState = checkData.state;
    }

    if (fileState === 'FAILED') throw new Error("Google AI failed to process the video.");

    // 3. Ask the AI Coach using our Chain-of-Thought prompt
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
      You are a strictly objective, tough-love Valorant Analyst. Watch this VOD of ${agent}.
      
      MATCH CONTEXT: ${matchContext}

      **PHASE 1: VERIFICATION (Do not output this phase, just think about it)**
      - Check their HUD for abilities and ultimate points.
      - Verify kills ONLY by looking at the kill feed or combat report.

      **PHASE 2: THE COACHING ANALYSIS**
      Now, use the facts to grade them and build a timeline. 
      Format your EXACT response like this:

      **📊 VOD REPORT CARD**
      *   **Overall Grade:** [A, B, C, D, or F]
      *   **Aim:** [1 to 5 Stars, use ★ and ☆]
      *   **Positioning:** [1 to 5 Stars]
      *   **Utility:** [1 to 5 Stars]
      *   **Game Sense:** [1 to 5 Stars]

      **⏱️ MATCH TIMELINE**
      (List 2 to 4 specific timestamps from the video with a ✅ for good plays or ❌ for mistakes. Be highly actionable).
      *   [Timestamp] [✅ or ❌] [What they did right or wrong. E.g., "❌ 0:15 - Wide swung alone instead of waiting for your initiator's flash."]
      *   [Timestamp] [✅ or ❌] [Next event]

      **🗣️ COACH'S VERDICT**
      (Give one short paragraph of actionable advice. Talk like a real coach. E.g., "You won the duel, but immediately repeeked the same angle. In Gold+, that gets traded instantly. Back off after the first kill.")
    `;

    const result = await model.generateContent([
      { fileData: { mimeType: mimeType, fileUri: fileUri } },
      prompt
    ]);

    return NextResponse.json({ feedback: result.response.text() });

  } catch (error: unknown) {
    console.error("VOD Error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process VOD';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
