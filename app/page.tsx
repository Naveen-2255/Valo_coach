'use client';
import { useState, useMemo } from 'react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'stats' | 'vod'>('stats');

  const [riotId, setRiotId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [playerData, setPlayerData] = useState<any>(null);
  const [statError, setStatError] = useState<string | null>(null);

  // VOD State
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzingVideo, setIsAnalyzingVideo] = useState(false);
  const [aiVodFeedback, setAiVodFeedback] = useState<string | null>(null);
  const [aiStatFeedback, setAiStatFeedback] = useState<string | null>(null);
  const [isCoachingStats, setIsCoachingStats] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatError(null); setPlayerData(null); setAiStatFeedback(null);
    if (!riotId.includes('#')) { setStatError("Please include hashtag (e.g., DawgOP#2255)"); return; }
    
    const [name, tag] = riotId.split('#');
    setIsSearching(true);
    try {
      const res = await fetch('/api/matches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, tag }) });
      const data = await res.json();
      if (data.error) setStatError(data.error);
      else setPlayerData(data);
    } catch (err) { setStatError("Server connection failed."); } 
    finally { setIsSearching(false); }
  };

  // --- 🧠 AGGREGATE 20-MATCH DATA FOR THE DASHBOARD ---
  const aggregatedStats = useMemo(() => {
    if (!playerData || !playerData.matches) return null;
    
    let kills = 0, deaths = 0, assists = 0, wins = 0;
    let headshots = 0, bodyshots = 0, legshots = 0;
    let totalScore = 0, totalRounds = 0;

    playerData.matches.forEach((match: any) => {
      const myStats = match.players.all_players.find((p: any) => p.name.toLowerCase() === playerData.account.name.toLowerCase());
      if (!myStats) return;

      const myTeam = myStats.team.toLowerCase();
      if (match.teams[myTeam].has_won) wins++;

      kills += myStats.stats.kills;
      deaths += myStats.stats.deaths;
      assists += myStats.stats.assists;
      headshots += myStats.stats.headshots;
      bodyshots += myStats.stats.bodyshots;
      legshots += myStats.stats.legshots;
      totalScore += myStats.stats.score;
      totalRounds += (match.teams.red.rounds_won + match.teams.blue.rounds_won);
    });

    const totalMatches = playerData.matches.length;
    const totalHits = headshots + bodyshots + legshots;

    return {
      winRate: Math.round((wins / totalMatches) * 100),
      kd: deaths > 0 ? (kills / deaths).toFixed(2) : kills,
      kills, deaths, assists,
      acs: totalRounds > 0 ? Math.round(totalScore / totalRounds) : 0,
      hsPercent: totalHits > 0 ? Math.round((headshots / totalHits) * 100) : 0,
      bodyPercent: totalHits > 0 ? Math.round((bodyshots / totalHits) * 100) : 0,
      legPercent: totalHits > 0 ? Math.round((legshots / totalHits) * 100) : 0,
      wins, losses: totalMatches - wins
    };
  }, [playerData]);

  const handleAnalyzeStats = async () => {
    if (!playerData || !aggregatedStats) return;
    setIsCoachingStats(true); setAiStatFeedback(null);
    try {
      const res = await fetch('/api/coach-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: playerData.account.name, matchData: aggregatedStats }),
      });
      const data = await res.json();
      if (data.feedback) setAiStatFeedback(data.feedback);
    } catch (err) { alert("Failed to get AI coaching."); } 
    finally { setIsCoachingStats(false); }
  };

  const handleSelectMatchForVod = (matchInfo: any) => {
    setSelectedMatch(matchInfo);
    setVideoFile(null); setPreviewUrl(null); setAiVodFeedback(null);
    setActiveTab('vod');
  };

  return (
    <main className="min-h-screen bg-[#0f1923] text-gray-200 font-sans p-6 flex flex-col items-center">
      
      {/* HEADER */}
      <div className="w-full max-w-6xl flex justify-between items-center mb-8">
        <h1 className="text-3xl font-black uppercase text-[#ff4655] tracking-tighter">Valorant <span className="text-white">AI Tracker</span></h1>
        
        <form onSubmit={handleSearch} className="flex w-96">
          <input type="text" placeholder="DawgOP#2255" value={riotId} onChange={(e) => setRiotId(e.target.value)} className="flex-1 px-4 py-2 bg-[#1f2326] border border-gray-700 rounded-l-md focus:outline-none focus:border-[#ff4655]" required />
          <button type="submit" disabled={isSearching} className="px-6 py-2 bg-[#ff4655] hover:bg-[#ff5866] text-white font-bold rounded-r-md transition disabled:opacity-50">{isSearching ? "..." : "Search"}</button>
        </form>
      </div>

      <div className="w-full max-w-6xl">
        {/* TABS */}
        <div className="flex bg-[#1f2326] rounded-md p-1 mb-6 border border-gray-800 w-80">
          <button onClick={() => setActiveTab('stats')} className={`flex-1 py-2 rounded font-bold text-sm transition ${activeTab === 'stats' ? 'bg-[#ff4655] text-white' : 'text-gray-400 hover:text-white'}`}>📊 Tracker Dashboard</button>
          <button onClick={() => setActiveTab('vod')} className={`flex-1 py-2 rounded font-bold text-sm transition ${activeTab === 'vod' ? 'bg-[#ff4655] text-white' : 'text-gray-400 hover:text-white'}`}>🎬 VOD Coach</button>
        </div>

        {statError && <div className="p-4 mb-6 bg-red-900/50 border border-red-500 rounded text-red-200">{statError}</div>}

        {/* TAB 1: TRACKER DASHBOARD */}
        {activeTab === 'stats' && playerData && aggregatedStats && (
          <div className="flex flex-col lg:flex-row gap-6">
            
            {/* LEFT COLUMN: PROFILE & ACCURACY */}
            <div className="w-full lg:w-1/3 flex flex-col gap-6">
              
              {/* Profile Card */}
              <div className="bg-[#1f2326] rounded-lg border border-gray-800 p-6 relative overflow-hidden shadow-lg">
                <div className="absolute inset-0 opacity-10 bg-cover bg-center" style={{ backgroundImage: `url(${playerData.account.card.wide})` }}></div>
                <div className="relative z-10 flex gap-4 items-center">
                  <img src={playerData.account.card.small} alt="Card" className="w-20 h-20 rounded border border-gray-600 shadow-md" />
                  <div>
                    <h2 className="text-2xl font-black">{playerData.account.name} <span className="text-gray-500 text-lg">#{playerData.account.tag}</span></h2>
                    {playerData.mmr ? (
                      <p className="text-[#ff4655] font-bold text-lg">{playerData.mmr.current_data.currenttierpatched} <span className="text-gray-400 text-sm ml-1 font-normal">({playerData.mmr.current_data.ranking_in_tier} RR)</span></p>
                    ) : <p className="text-gray-400">Unranked</p>}
                    <p className="text-xs text-gray-500 mt-1">Lvl {playerData.account.account_level} • Peak {playerData.mmr?.highest_rank?.patched_tier}</p>
                  </div>
                </div>
                <button onClick={handleAnalyzeStats} disabled={isCoachingStats} className="w-full mt-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded text-sm transition shadow-[0_0_15px_rgba(79,70,229,0.3)]">
                  {isCoachingStats ? "AI is analyzing..." : "✨ AI: Analyze My Stats"}
                </button>
              </div>

              {/* Accuracy Card */}
              <div className="bg-[#1f2326] rounded-lg border border-gray-800 p-6 shadow-lg">
                <h3 className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-4">Accuracy (Last 20)</h3>
                <div className="flex justify-between items-end mb-6">
                  <div className="text-center"><p className="text-gray-400 text-xs">Head</p><p className="text-[#ff4655] font-bold text-xl">{aggregatedStats.hsPercent}%</p></div>
                  <div className="text-center"><p className="text-gray-400 text-xs">Body</p><p className="text-[#00e5ff] font-bold text-xl">{aggregatedStats.bodyPercent}%</p></div>
                  <div className="text-center"><p className="text-gray-400 text-xs">Legs</p><p className="text-yellow-400 font-bold text-xl">{aggregatedStats.legPercent}%</p></div>
                </div>
                {/* Progress Bar Visual */}
                <div className="w-full h-2 rounded-full flex overflow-hidden bg-gray-800">
                  <div style={{ width: `${aggregatedStats.hsPercent}%` }} className="bg-[#ff4655]"></div>
                  <div style={{ width: `${aggregatedStats.bodyPercent}%` }} className="bg-[#00e5ff]"></div>
                  <div style={{ width: `${aggregatedStats.legPercent}%` }} className="bg-yellow-400"></div>
                </div>
              </div>

              {/* AI Feedback Box (If generated) */}
              {aiStatFeedback && (
                <div className="bg-indigo-900/30 border border-indigo-500/50 rounded-lg p-6 text-sm text-indigo-100 shadow-lg">
                  <h3 className="font-bold text-indigo-400 mb-2">🤖 AI Coach Analysis</h3>
                  <div className="whitespace-pre-wrap">{aiStatFeedback}</div>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: MAIN STATS & MATCH HISTORY */}
            <div className="w-full lg:w-2/3 flex flex-col gap-6">
              
              {/* Stat Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[#1f2326] border border-gray-800 p-4 rounded-lg flex flex-col justify-center items-center">
                  <p className="text-gray-400 text-xs uppercase font-bold mb-1">Win Rate</p>
                  <p className={`text-3xl font-black ${aggregatedStats.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>{aggregatedStats.winRate}%</p>
                  <p className="text-xs text-gray-500 mt-1">{aggregatedStats.wins}W - {aggregatedStats.losses}L</p>
                </div>
                <div className="bg-[#1f2326] border border-gray-800 p-4 rounded-lg flex flex-col justify-center items-center">
                  <p className="text-gray-400 text-xs uppercase font-bold mb-1">K/D Ratio</p>
                  <p className="text-3xl font-black text-white">{aggregatedStats.kd}</p>
                  <p className="text-xs text-gray-500 mt-1">{aggregatedStats.kills}K / {aggregatedStats.deaths}D</p>
                </div>
                <div className="bg-[#1f2326] border border-gray-800 p-4 rounded-lg flex flex-col justify-center items-center">
                  <p className="text-gray-400 text-xs uppercase font-bold mb-1">Avg Score (ACS)</p>
                  <p className="text-3xl font-black text-white">{aggregatedStats.acs}</p>
                </div>
                <div className="bg-[#1f2326] border border-gray-800 p-4 rounded-lg flex flex-col justify-center items-center">
                  <p className="text-gray-400 text-xs uppercase font-bold mb-1">Assists</p>
                  <p className="text-3xl font-black text-white">{aggregatedStats.assists}</p>
                </div>
              </div>

              {/* Match History List */}
              <div className="bg-[#1f2326] border border-gray-800 rounded-lg overflow-hidden shadow-lg">
                <div className="px-6 py-4 border-b border-gray-800 bg-[#181a1e]">
                  <h3 className="font-bold text-gray-300">Last {playerData.matches.length} Matches</h3>
                </div>
                
                <div className="flex flex-col">
                  {playerData.matches.map((match: any, index: number) => {
                    const myStats = match.players.all_players.find((p: any) => p.name.toLowerCase() === playerData.account.name.toLowerCase());
                    if (!myStats) return null;
                    const myTeam = myStats.team.toLowerCase();
                    const won = match.teams[myTeam].has_won;
                    const myScore = match.teams[myTeam].rounds_won;
                    const enemyScore = match.teams[myTeam === 'red' ? 'blue' : 'red'].rounds_won;
                    const matchAcs = Math.round(myStats.stats.score / (myScore + enemyScore));
                    const matchHs = Math.round((myStats.stats.headshots / (myStats.stats.headshots + myStats.stats.bodyshots + myStats.stats.legshots)) * 100);
                    const matchKd = (myStats.stats.kills / (myStats.stats.deaths || 1)).toFixed(2);
                    
                    return (
                      <div key={index} className={`flex items-center justify-between p-4 border-b border-gray-800/50 hover:bg-gray-800/20 transition ${won ? 'border-l-4 border-l-[#00e5ff] bg-gradient-to-r from-[#00e5ff]/5 to-transparent' : 'border-l-4 border-l-[#ff4655] bg-gradient-to-r from-[#ff4655]/5 to-transparent'}`}>
                        
                        {/* Agent & Map */}
                        <div className="flex items-center gap-4 w-1/4">
                          <img src={myStats.assets.agent.small} alt="agent" className="w-12 h-12 rounded-full border border-gray-700 bg-[#0f1923]" />
                          <div>
                            <p className="font-bold text-white text-lg leading-tight">{match.metadata.map}</p>
                            <p className="text-xs text-gray-400">{myStats.character}</p>
                          </div>
                        </div>

                        {/* Score & Result */}
                        <div className="w-1/6 text-center">
                          <p className={`font-black text-lg ${won ? 'text-[#00e5ff]' : 'text-[#ff4655]'}`}>{myScore} : {enemyScore}</p>
                          <p className="text-[10px] uppercase font-bold text-gray-500">{won ? 'Victory' : 'Defeat'}</p>
                        </div>

                        {/* KDA */}
                        <div className="w-1/5 text-center">
                          <p className="font-mono text-gray-200 font-bold">{myStats.stats.kills} / {myStats.stats.deaths} / {myStats.stats.assists}</p>
                          <p className="text-xs text-gray-500 mt-1">KD: <span className={Number(matchKd) >= 1 ? 'text-green-400' : 'text-red-400'}>{matchKd}</span></p>
                        </div>

                        {/* Advanced Stats */}
                        <div className="hidden sm:flex w-1/6 justify-center gap-4 text-center">
                          <div><p className="text-[10px] text-gray-500 uppercase font-bold">HS%</p><p className="font-mono text-sm">{matchHs || 0}%</p></div>
                          <div><p className="text-[10px] text-gray-500 uppercase font-bold">ACS</p><p className="font-mono text-sm">{matchAcs || 0}</p></div>
                        </div>

                        {/* VOD Action */}
                        <div className="w-auto text-right">
                          <button 
                            onClick={() => handleSelectMatchForVod({ agent: myStats.character, map: match.metadata.map, won, kills: myStats.stats.kills, deaths: myStats.stats.deaths, assists: myStats.stats.assists, teamRounds: myScore, enemyRounds: enemyScore })} 
                            className="p-2 bg-gray-800 hover:bg-[#ff4655] rounded text-xs font-bold transition border border-gray-700 hover:border-[#ff4655] text-gray-300 hover:text-white"
                          >
                            🎬 Analyze
                          </button>
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 2: VOD (Kept simple to save space) */}
        {activeTab === 'vod' && (
           <div className="bg-[#1f2326] p-8 rounded-lg shadow-lg border border-gray-800 max-w-2xl mx-auto">
             <h2 className="text-2xl font-bold mb-4">VOD Analyzer</h2>
             {selectedMatch && (
               <div className="mb-6 p-4 bg-gray-800 rounded border-l-4 border-[#ff4655]">
                 <p className="text-sm text-gray-400">Context Linked:</p>
                 <p className="font-bold">{selectedMatch.agent} on {selectedMatch.map} • {selectedMatch.kills}K / {selectedMatch.deaths}D</p>
               </div>
             )}
             <input type="file" className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-[#ff4655] file:text-white hover:file:bg-[#ff5866] mb-6" onChange={(e) => { const f = e.target.files?.[0]; if(f){ setVideoFile(f); setPreviewUrl(URL.createObjectURL(f)); } }} />
             {previewUrl && <video src={previewUrl} controls className="w-full rounded mb-4" />}
             {previewUrl && <button onClick={async () => { /* Call your /api/analyze here */ }} className="w-full py-3 bg-[#ff4655] text-white font-bold rounded">Analyze VOD</button>}
           </div>
        )}
      </div>
    </main>
  );
}
