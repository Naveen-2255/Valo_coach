import { NextRequest, NextResponse } from 'next/server';

const HENRIK_API_KEY = process.env.HENRIK_API_KEY;

export async function POST(req: NextRequest) {
  try {
    // 1. We now accept a "mode" parameter from the frontend!
    const { name, tag, mode } = await req.json();
    if (!name || !tag) return NextResponse.json({ error: 'Name and tag required' }, { status: 400 });
    if (!HENRIK_API_KEY) return NextResponse.json({ error: 'Server missing API Key' }, { status: 500 });

    const headers = { 'Authorization': HENRIK_API_KEY };

    const accountRes = await fetch(`https://api.henrikdev.xyz/valorant/v1/account/${name}/${tag}`, { headers });
    const accountData = await accountRes.json();
    if (accountData.status !== 200) return NextResponse.json({ error: 'Player not found.' }, { status: 404 });
    const region = accountData.data.region;

    // 2. Build the Match URL dynamically (Default size is 10 as requested)
    let matchUrl = `https://api.henrikdev.xyz/valorant/v3/matches/${region}/${name}/${tag}?size=10`;
    
    // If the user selected a specific mode (and not "all"), append it to the URL
    if (mode && mode !== 'all') {
      matchUrl += `&mode=${mode}`;
    }

    const matchesRes = await fetch(matchUrl, { headers });
    const matchesData = await matchesRes.json();

    const mmrRes = await fetch(`https://api.henrikdev.xyz/valorant/v2/mmr/${region}/${name}/${tag}`, { headers });
    const mmrData = await mmrRes.json();

    return NextResponse.json({ 
      account: accountData.data,
      matches: matchesData.data || [],
      mmr: mmrData.status === 200 ? mmrData.data : null 
    });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
