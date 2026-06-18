import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY as string;
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: NextRequest) {
  try {
    const { playerName, matchData } = await req.json();

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // This prompt forces the AI to act exactly like a Tracker.gg Analyst
    const prompt = `
      You are an elite Valorant Analyst and Radiant Coach. I am giving you advanced Tracker.gg style metrics for a player named ${playerName} over their last 5 matches.
      
      Tracker Data:
      ${JSON.stringify(matchData)}

      CRITICAL COACHING RUBRIC (YOU MUST FOLLOW THIS):
      1. Headshot Percentage (HS%): Pro players have 25%+. If it's below 20%, tell them to stop spraying/crouching and work on crosshair placement.
      2. Average Combat Score (ACS): Below 200 means low impact. Above 250 means they are hard-carrying.
      3. Agent Roles: Duelists (Reyna/Jett) MUST have high First Bloods. Initiators/Controllers should have high assists. Sentinels should have high survivability (low deaths).
      4. DO NOT hallucinate. Do not roast them for low assists if they are playing a Duelist. 

      Format your response like a professional dashboard analysis:
      **📊 Tracker Summary:**
      (Objectively analyze their HS%, ACS, and K/D. Are their mechanics good for their role?)

      **⚠️ The Weakness:**
      (Identify the single biggest statistical flaw in these 5 games based on the numbers).

      **🎯 How to Improve:**
      (Give 2 highly specific, mechanical or game-sense tips to fix that exact statistical weakness).
    `;

    const result = await model.generateContent(prompt);

    return NextResponse.json({ feedback: result.response.text() });

  } catch (error: any) {
    console.error("AI Stat Coach Error:", error);
    return NextResponse.json({ error: 'Failed to analyze stats.' }, { status: 500 });
  }
}
