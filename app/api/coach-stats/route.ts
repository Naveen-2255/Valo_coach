import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY as string;
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { playerName, matchData } = body;

    if (!playerName || !matchData) {
      return NextResponse.json({ error: 'Missing player data.' }, { status: 400 });
    }

    // We use 1.5-pro here because it is much more stable and rarely gets the 503 Traffic Error
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
      You are an elite Valorant Analyst and Radiant Coach. I am giving you advanced Tracker.gg style metrics for a player named ${playerName} over their last 20 matches.
      
      Tracker Data:
      ${JSON.stringify(matchData)}

      CRITICAL COACHING RUBRIC:
      1. Headshot Percentage (HS%): Pro players have 25%+. If it's below 20%, tell them to work on crosshair placement.
      2. Average Combat Score (ACS): Below 200 means low impact. Above 250 means they are carrying.
      3. Agent Roles: Look at their recent games. Are they playing Duelists, Controllers, or Sentinels? Grade them based on their role (e.g., Duelists need high KD, Initiators need assists).
      4. DO NOT hallucinate. Be highly analytical.

      Format your response exactly like this:
      **📊 Tracker Summary:**
      (Objectively analyze their HS%, ACS, and Win Rate. Are their mechanics good for their role?)

      **⚠️ The Weakness:**
      (Identify the single biggest statistical flaw in these 20 games).

      **🎯 How to Improve:**
      (Give 2 highly specific tips to fix that exact statistical weakness).
    `;

    const result = await model.generateContent(prompt);

    return NextResponse.json({ feedback: result.response.text() });

  } catch (error: any) {
    console.error("AI Stat Coach Error:", error);
    // This ensures the error is safely sent to the frontend so you can read it!
    return NextResponse.json({ error: error.message || 'Failed to analyze stats.' }, { status: 500 });
  }
}
