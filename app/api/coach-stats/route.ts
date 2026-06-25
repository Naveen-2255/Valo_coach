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
      You are a tough-love, highly analytical Radiant Valorant Coach. Analyze this player's last 20 matches.
      Player: ${playerName}
      Data: ${JSON.stringify(matchData)}

      CRITICAL INSTRUCTIONS:
      - Give actionable, personality-driven coaching. Do not sound like a robot. Sound like a real Esports coach.
      - Calculate their "Estimated Potential Rank" based on their mechanics (HS% > 25% = High, ACS > 230 = High).
      - Find their 3 biggest specific mistakes based on the numbers (e.g., low assists on initiators, dying too much, low win rate on a specific map).

      Format EXACTLY like this:

      **📋 AI COACHING REPORT CARD**
      *   **Player:** ${playerName}
      *   **Top Strength:** (e.g., Raw Aim, High Impact, Good Support)
      *   **Top Weakness:** (e.g., Over-aggression, Inconsistent, Weak Agent Pool)
      *   **Today's Grade:** (A+, B-, C, etc.)
      *   **Estimated Potential Rank:** (Guess their rank based on ACS and HS%)

      **🏅 MECHANICS BREAKDOWN**
      *   Aim: [Estimate Rank, e.g., Gold 2] (based on HS%)
      *   Impact: [Estimate Rank] (based on ACS)
      *   Teamplay: [Estimate Rank] (based on Assists & Agent role)

      **⚠️ 3 BIGGEST MISTAKES**
      1. ❌ [Mistake 1 - Actionable, e.g., "You are playing Clove but dying 18 times a game. Stop dry-peeking before your duelists."]
      2. ❌ [Mistake 2]
      3. ❌ [Mistake 3]

      **🗣️ COACH'S VERDICT**
      (Give one short paragraph of brutal, honest advice on what they need to do to reach their Potential Rank.)
    `;

    const result = await model.generateContent(prompt);

    return NextResponse.json({ feedback: result.response.text() });

  } catch (error: any) {
    console.error("AI Stat Coach Error:", error);
    // This ensures the error is safely sent to the frontend so you can read it!
    return NextResponse.json({ error: error.message || 'Failed to analyze stats.' }, { status: 500 });
  }
}
