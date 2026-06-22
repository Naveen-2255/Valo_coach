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
      You are a strictly objective, data-driven Valorant Analyst. Watch this VOD of the user playing ${agent}.
      Video AI is prone to visual hallucinations. To prevent this, you MUST follow a strict 3-step verification process. DO NOT SKIP STEPS. DO NOT GUESS.

      MATCH CONTEXT FOR THIS VIDEO:
      ${matchContext}

      **PHASE 1: HUD & INVENTORY CHECK (Objective Facts Only)**
      - Look at the bottom center of the screen at the very beginning. State the exact number of ability charges they have. State their ultimate points (e.g., 3/6).
      - Watch the abilities. An ability is ONLY used if the charge number goes down. If the charge number stays the same, the ability was CANCELLED. State exactly which abilities were actually consumed.

      **PHASE 2: COMBAT VERIFICATION (Objective Facts Only)**
      - DO NOT assume a kill happened just because the player shot their gun.
      - RULE: You must verify a kill by looking for the red skull icon or checking the top-right kill feed.
      - How does the clip end? Does the user die, survive, or win the round? If they die, check the combat report popup to see who killed them.

      **PHASE 3: THE COACHING ANALYSIS**
      - Now, and ONLY now, use the facts established in Phase 1 and 2 to analyze the player's mechanics.
      - Did they die with unused utility?
      - How was their crosshair placement?
      - Provide 2 brutally honest, highly specific tips to fix their mechanics.

      FORMAT YOUR EXACT RESPONSE LIKE THIS:

      **🔍 Step 1: HUD & Utility Analysis**
      (List the abilities they had, and verify if the charges actually went down. Confirm Ultimate status).

      **⚔️ Step 2: Combat Verification**
      (List the actual outcome of the clip. Who died, based ONLY on the kill feed/combat report).

      **🎯 Step 3: Coach's Verdict**
      (The tactical mistakes made, and the 2 tips to fix them based on the objective data).
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
