import { NextRequest, NextResponse } from 'next/server';

const HENRIK_API_KEY = process.env.HENRIK_API_KEY;

export async function POST(req: NextRequest) {
  try {
    const { name, tag } = await req.json();
    if (!name || !tag) return NextResponse.json({ error: 'Name and tag required' }, { status: 400 });
    if (!HENRIK_API_KEY) return NextResponse.json({ error: 'Server missing API Key' }, { status: 500 });

    const headers = { 'Authorization': HENRIK_API_KEY };

    // 1. Get Account & Region
    const accountRes = await fetch(`https://api.henrikdev.xyz/valorant/v1/account/${name}/${tag}`, { headers });
    const accountData = await accountRes.json();
    if (accountData.status !== 200) return NextResponse.json({ error: 'Player not found.' }, { status: 404 });
    const region = accountData.data.region;

    // 2. Get Matches
    const matchesRes = await fetch(`https://api.henrikdev.xyz/valorant/v3/matches/${region}/${name}/${tag}?size=20`, { headers });
    const matchesData = await matchesRes.json();

    // 3. Get Rank & Peak Rank (MMR)
    const mmrRes = await fetch(`https://api.henrikdev.xyz/valorant/v2/mmr/${region}/${name}/${tag}`, { headers });
    const mmrData = await mmrRes.json();

    return NextResponse.json({ 
      account: accountData.data,
      matches: matchesData.data,
      mmr: mmrData.status === 200 ? mmrData.data : null // Send rank data if it exists
    });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
