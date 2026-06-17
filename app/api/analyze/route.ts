import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import os from 'os';

const apiKey = process.env.GEMINI_API_KEY as string;
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

export async function POST(req: NextRequest) {
  try {
    const data = await req.formData();
    const file: File | null = data.get('video') as unknown as File;
    const agent: string = data.get('agent') as string || 'the player'; // NEW: Get the agent name

    if (!file) {
      return NextResponse.json({ error: 'No video uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const tempFilePath = path.join(os.tmpdir(), file.name);
    await writeFile(tempFilePath, buffer);

    const uploadResult = await fileManager.uploadFile(tempFilePath, {
      mimeType: file.type,
      displayName: "Valorant VOD",
    });

    console.log("Uploaded. Waiting for Google to process a potentially large video...");

    let googleFile = await fileManager.getFile(uploadResult.file.name);
    while (googleFile.state === 'PROCESSING') {
      console.log('Processing video... waiting 3 seconds.');
      await new Promise((resolve) => setTimeout(resolve, 3000));
      googleFile = await fileManager.getFile(uploadResult.file.name);
    }

    if (googleFile.state === 'FAILED') {
      throw new Error("Google AI failed to process the video file.");
    }

    console.log(`Video ready! Asking coach to analyze ${agent}...`);

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    // NEW: Highly specific, strict prompt to lock onto your agent and ignore the rest
    const prompt = `
      You are a Radiant-level Valorant coach analyzing a VOD. 
      The user is playing as the agent: ${agent}. 

      CRITICAL INSTRUCTIONS TO PREVENT HALLUCINATIONS:
      Video game footage can be blurry. DO NOT guess or invent details. 
      - Do NOT confidently name an enemy agent (like Sova or Cypher) unless you clearly see their character model or the kill feed. Use "the enemy" if unsure.
      - Do NOT say abilities were available unless you clearly see the HUD ability icons at the bottom of the screen.
      - Do NOT say the player "missed" or "whiffed" unless you clearly see the bullet tracers missing.
      - Focus heavily on crosshair placement (is it at head level?), positioning (are they in the open?), and crossfire vulnerabilities.

      Before answering, carefully analyze the video step-by-step. Then, format your final response EXACTLY like this:

      **The Situation:**
      (Briefly describe the exact gunfight or death objectively. What weapon was ${agent} using? Where were they on the map? Who did they fight?)

      **The Mistake:**
      (What was the actual tactical error? Focus on positioning, crosshair placement, movement, or map awareness. Do not invent missed shots or fake ability usage.)

      **The Fix:**
      1. (First actionable tip)
      2. (Second actionable tip)
    `;

    const result = await model.generateContent([
      {
        fileData: {
          mimeType: uploadResult.file.mimeType,
          fileUri: uploadResult.file.uri
        }
      },
      prompt
    ]);

    return NextResponse.json({ feedback: result.response.text() });

  } catch (error: any) {
    console.error("AI Coach Error:", error);
    return NextResponse.json({ error: error.message || 'Failed to analyze video.' }, { status: 500 });
  }
}
