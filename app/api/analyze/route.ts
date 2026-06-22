import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import os from 'os';

// ADD THIS LINE TO FIX VERCEL TIMEOUTS:
export const maxDuration = 60; 

const apiKey = process.env.GEMINI_API_KEY as string;
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

export async function POST(req: NextRequest) {
  try {
    const data = await req.formData();
    const file: File | null = data.get('video') as unknown as File;
    const agent: string = data.get('agent') as string;
    const matchContext: string = data.get('matchContext') as string || 'No match context provided.';

    if (!file) return NextResponse.json({ error: 'No video uploaded' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const tempFilePath = path.join(os.tmpdir(), file.name);
    await writeFile(tempFilePath, buffer);

    const uploadResult = await fileManager.uploadFile(tempFilePath, { mimeType: file.type, displayName: "Valorant VOD" });

    let googleFile = await fileManager.getFile(uploadResult.file.name);
    while (googleFile.state === 'PROCESSING') {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      googleFile = await fileManager.getFile(uploadResult.file.name);
    }
    if (googleFile.state === 'FAILED') throw new Error("Video processing failed.");

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    // NEW SUPER-PROMPT: Combining Stats Context with Video Analysis
    const prompt = `
      You are a strictly objective, data-driven Valorant Analyst. Watch this VOD of the user playing ${agent}.
      Video AI is prone to visual hallucinations. To prevent this, you MUST follow a strict 3-step verification process. DO NOT SKIP STEPS. DO NOT GUESS.

      **PHASE 1: HUD & INVENTORY CHECK (Objective Facts Only)**
      - Look at the bottom center of the screen at the very beginning. State the exact number of ability charges they have. State their ultimate points (e.g., 3/6).
      - Watch the abilities. In Valorant, players can equip an ability (causing screen effects) and then CANCEL it without using it.
      - RULE: An ability is ONLY used if the charge number goes down. If the charge number stays the same, the ability was CANCELLED. State exactly which abilities were actually consumed.

      **PHASE 2: COMBAT VERIFICATION (Objective Facts Only)**
      - DO NOT assume a kill happened just because the player shot their gun.
      - RULE: You must verify a kill by looking for the red skull icon or checking the top-right kill feed.
      - How does the clip end? Does the user die, survive, or win the round? If they die, check the combat report popup to see who killed them.

      **PHASE 3: THE COACHING ANALYSIS**
      - Now, and ONLY now, use the facts established in Phase 1 and 2 to analyze the player's mechanics.
      - Did they die with unused utility? (e.g., "You died with 2 Leers available").
      - How was their crosshair placement? (Were they aiming at walls? Head height?)
      - How was their movement? (Did they dry-peek? Did they run with a knife out in a dangerous area?)
      - Provide 2 brutally honest, highly specific tips to fix their mechanics.

      FORMAT YOUR EXACT RESPONSE LIKE THIS:

      **🔍 Step 1: HUD & Utility Analysis**
      (List the abilities they had, and verify if the charges actually went down. Confirm Ultimate status).

      **⚔️ Step 2: Combat Verification**
      (List the actual outcome of the clip. Who died, based ONLY on the kill feed/combat report).

      **🎯 Step 3: Coach's Verdict**
      (The tactical mistakes made, and the 2 tips to fix them based on the objective data).
    `;

    const result = await model.generateContent([{ fileData: { mimeType: uploadResult.file.mimeType, fileUri: uploadResult.file.uri } }, prompt]);
    return NextResponse.json({ feedback: result.response.text() });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
