'use client';
import { useState, useMemo } from 'react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'stats' | 'vod'>('stats');

  // --- STAT TRACKER STATE ---
  const [riotId, setRiotId] = useState('');
  const [filterMode, setFilterMode] = useState('competitive'); // NEW: Default to Competitive
  const [isSearching, setIsSearching] = useState(false);
  const [playerData, setPlayerData] = useState<any>(null);
  const [statError, setStatError] = useState<string | null>(null);
  const [isCoachingStats, setIsCoachingStats] = useState(false);
  const [aiStatFeedback, setAiStatFeedback] = useState<string | null>(null);

  // --- VOD REVIEW STATE ---
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyzingStep, setAnalyzingStep] = useState<string | null>(null);
  const [aiVodFeedback, setAiVodFeedback] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatError(null); setPlayerData(null); setAiStatFeedback(null);
    if (!riotId.includes('#')) { setStatError("Please include hashtag (e.g., RiotId#Tag)"); return; }
    
    const [name, tag] = riotId.split('#');
    setIsSearching(true);
    try {
      // NEW: We are passing 'mode' to the backend!
      const res = await fetch('/api/matches', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ name, tag, mode: filterMode }) 
      });
      const data = await res.json();
      if (data.error) setStatError(data.error);
      else setPlayerData(data);
    } catch (err) { setStatError("Server connection failed."); } 
    finally { setIsSearching(false); }
  };

  const aggregatedStats = useMemo(() => {
    if (!playerData || !playerData.matches) return null;
    let kills = 0, deaths = 0, assists = 0, wins = 0, headshots = 0, bodyshots = 0, legshots = 0, totalScore = 0, totalRounds = 0, validMatchesCount = 0;

    playerData.matches.forEach((match: any) => {
      const myStats = match.players.all_players.find((p: any) => p.name.toLowerCase() === playerData.account.name.toLowerCase());
      if (!myStats) return;
      validMatchesCount++;
      const myTeam = myStats.team ? myStats.team.toLowerCase() : null;
      if (myTeam && match.teams && match.teams[myTeam]) { if (match.teams[myTeam].has_won) wins++; }
      kills += myStats.stats.kills; deaths += myStats.stats.deaths; assists += myStats.stats.assists;
      headshots += myStats.stats.headshots; bodyshots += myStats.stats.bodyshots; legshots += myStats.stats.legshots; totalScore += myStats.stats.score;
      const redRounds = match.teams?.red?.rounds_won || 0; const blueRounds = match.teams?.blue?.rounds_won || 0;
      totalRounds += (redRounds + blueRounds);
    });

    const totalHits = headshots + bodyshots + legshots;
    return {
      winRate: validMatchesCount > 0 ? Math.round((wins / validMatchesCount) * 100) : 0,
      kd: deaths > 0 ? (kills / deaths).toFixed(2) : kills,
      kills, deaths, assists,
      acs: totalRounds > 0 ? Math.round(totalScore / totalRounds) : 0,
      hsPercent: totalHits > 0 ? Math.round((headshots / totalHits) * 100) : 0,
      bodyPercent: totalHits > 0 ? Math.round((bodyshots / totalHits) * 100) : 0,
      legPercent: totalHits > 0 ? Math.round((legshots / totalHits) * 100) : 0,
      wins, losses: validMatchesCount - wins
    };
  }, [playerData]);

  const handleAnalyzeStats = async () => {
    if (!playerData || !aggregatedStats) { alert("Data is loading, please try again!"); return; }
    setIsCoachingStats(true); setAiStatFeedback(null);
    const simplifiedMatches = playerData.matches.map((match: any) => {
      const myStats = match.players.all_players.find((p: any) => p.name.toLowerCase() === playerData.account.name.toLowerCase());
      if (!myStats) return null;
      return { agent: myStats.character, kills: myStats.stats.kills, deaths: myStats.stats.deaths, assists: myStats.stats.assists };
    }).filter(Boolean);

    try {
      const res = await fetch('/api/coach-stats', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerName: playerData.account.name, matchData: { averages: aggregatedStats, recentGames: simplifiedMatches } }) });
      const data = await res.json();
      if (data.feedback) setAiStatFeedback(data.feedback); else alert("AI Error: " + data.error);
    } catch (err) { alert("Failed to connect to the AI."); } 
    finally { setIsCoachingStats(false); }
  };

  const handleSelectMatchForVod = (matchInfo: any) => {
    setSelectedMatch(matchInfo); setVideoFile(null); setPreviewUrl(null); setAiVodFeedback(null); setActiveTab('vod');
  };

  const handleAnalyzeVideo = async () => {
    if (!videoFile) return;
    setAiVodFeedback(null);
    const formData = new FormData();
    formData.append('video', videoFile);
    if (selectedMatch) {
      const contextString = `Mode: ${selectedMatch.mode}, Map: ${selectedMatch.map}, Result: ${selectedMatch.won ? 'Victory' : 'Defeat'}, Stats: ${selectedMatch.kills}K/${selectedMatch.deaths}D/${selectedMatch.assists}A on ${selectedMatch.agent}`;
      formData.append('agent', selectedMatch.agent); formData.append('matchContext', contextString);
    } else {
      formData.append('agent', 'the player'); formData.append('matchContext', 'No match context provided.');
    }
    
    try {
      setAnalyzingStep("UPLOADING SECURELY TO CLOUD...");
      setTimeout(() => setAnalyzingStep("AI IS WATCHING FOOTAGE..."), 4000);
      setTimeout(() => setAnalyzingStep("GENERATING COACHING REPORT..."), 12000);

      const response = await fetch('/api/analyze', { method: 'POST', body: formData });
      const data = await response.json();
      if (data.feedback) setAiVodFeedback(data.feedback); else alert("Oops! " + data.error);
    } catch (error) { alert("Error talking to the AI coach."); } 
    finally { setAnalyzingStep(null); }
  };

  return (
    <main className="min-h-screen bg-[#0f1923] text-gray-200 font-sans p-6 flex flex-col items-center relative z-0">
      <div className="fixed inset-0 pointer-events-none z-[-1] opacity-20 bg-[linear-gradient(to_right,#ffffff20_1px,transparent_1px),linear-gradient(to_bottom,#ffffff20_1px,transparent_1px)] bg-[size:3rem_3rem]"></div>
      
      {/* HEADER WITH NEW DROPDOWN */}
      <div className="w-full max-w-6xl flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-3xl font-black uppercase text-white tracking-tighter flex items-center gap-2">
          <span className="text-[#ff4655]">//</span> Valorant AI Tracker
        </h1>
        
        <form onSubmit={handleSearch} className="flex w-full md:w-[36rem] shadow-lg">
          {/* NEW: MODE SELECTOR */}
          <select 
            value={filterMode} 
            onChange={(e) => setFilterMode(e.target.value)} 
            className="px-3 py-3 bg-[#1f2326] border border-gray-700/50 border-r-0 focus:outline-none focus:border-[#ff4655] font-bold text-xs uppercase text-gray-400 cursor-pointer outline-none"
          >
            <option value="competitive">Competitive</option>
            <option value="unrated">Unrated</option>
            <option value="swiftplay">Swiftplay</option>
            <option value="deathmatch">Deathmatch</option>
            <option value="all">All Modes</option>
          </select>

          <input type="text" placeholder="RiotId#Tag" value={riotId} onChange={(e) => setRiotId(e.target.value)} className="flex-1 px-4 py-3 bg-[#181a1e] border border-gray-700/50 border-x-0 rounded-none focus:outline-none focus:border-[#ff4655] font-mono text-sm transition" required />
          
          <button type="submit" disabled={isSearching} className="px-6 py-3 bg-[#ff4655] hover:bg-[#ff5866] text-white font-bold uppercase tracking-wider rounded-r-sm transition disabled:opacity-50 text-sm">
            {isSearching ? "SCANNING" : "SEARCH"}
          </button>
        </form>
      </div>

      <div className="w-full max-w-6xl">
        <div className="flex w-full border-b border-gray-800 mb-8">
          <button onClick={() => setActiveTab('stats')} className={`px-8 py-4 font-bold text-sm uppercase tracking-widest transition relative ${activeTab === 'stats' ? 'text-[#ff4655]' : 'text-gray-500 hover:text-gray-300'}`}>
            Overview Dashboard
            {activeTab === 'stats' && <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[#ff4655]"></span>}
          </button>
          <button onClick={() => setActiveTab('vod')} className={`px-8 py-4 font-bold text-sm uppercase tracking-widest transition relative ${activeTab === 'vod' ? 'text-[#ff4655]' : 'text-gray-500 hover:text-gray-300'}`}>
            VOD Coach
            {activeTab === 'vod' && <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[#ff4655]"></span>}
          </button>
        </div>

        {statError && <div className="p-4 mb-6 bg-[#ff4655]/10 border-l-4 border-[#ff4655] text-[#ff4655] font-mono text-sm uppercase">{statError}</div>}

        {/* TAB 1: TRACKER DASHBOARD */}
        {activeTab === 'stats' && playerData && aggregatedStats && (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="w-full lg:w-1/3 flex flex-col gap-6">
              <div className="bg-[#181a1e] border border-white/5 p-6 relative shadow-xl rounded-sm">
                <div className="absolute inset-0 opacity-10 bg-cover bg-center" style={{ backgroundImage: `url(${playerData.account.card.wide})` }}></div>
                <div className="relative z-10 flex gap-5 items-center">
                  <img src={playerData.account.card.small} alt="Card" className="w-20 h-20 border-2 border-white/10 shadow-lg" />
                  <div>
                    <h2 className="text-2xl font-black uppercase tracking-tight">{playerData.account.name} <span className="text-gray-500 text-base">#{playerData.account.tag}</span></h2>
                    {playerData.mmr ? (
                      <p className="text-[#ff4655] font-bold text-lg uppercase">{playerData.mmr.current_data.currenttierpatched} <span className="text-gray-400 text-xs ml-1 font-mono">({playerData.mmr.current_data.ranking_in_tier} RR)</span></p>
                    ) : <p className="text-gray-400 uppercase text-sm font-bold">UNRANKED</p>}
                    <p className="text-[10px] text-gray-500 mt-1 uppercase font-bold tracking-widest">LVL {playerData.account.account_level} • PEAK {playerData.mmr?.highest_rank?.patched_tier}</p>
                  </div>
                </div>
                <button onClick={handleAnalyzeStats} disabled={isCoachingStats} className="relative z-10 w-full mt-6 py-3 bg-gradient-to-r from-indigo-900 to-violet-900 hover:from-indigo-800 hover:to-violet-800 border border-indigo-500/30 text-indigo-100 uppercase font-bold tracking-widest rounded-sm text-xs transition-all shadow-[0_0_20px_rgba(79,70,229,0.15)] disabled:opacity-50 cursor-pointer">
                  {isCoachingStats ? "SYSTEM ANALYZING..." : "INITIATE AI COACHING"}
                </button>
              </div>

              <div className="bg-[#181a1e] border border-white/5 p-6 rounded-sm shadow-xl">
                <h3 className="text-gray-500 font-bold text-[10px] uppercase tracking-widest mb-4 flex items-center gap-2"><span className="w-2 h-2 bg-[#ff4655] inline-block"></span> HIT DISTRIBUTION (LAST {playerData.matches.length})</h3>
                <div className="flex justify-between items-end mb-4">
                  <div className="text-center"><p className="text-gray-500 text-[10px] uppercase font-bold mb-1">HEAD</p><p className="text-white font-mono text-xl">{aggregatedStats.hsPercent}%</p></div>
                  <div className="text-center"><p className="text-gray-500 text-[10px] uppercase font-bold mb-1">BODY</p><p className="text-gray-300 font-mono text-xl">{aggregatedStats.bodyPercent}%</p></div>
                  <div className="text-center"><p className="text-gray-500 text-[10px] uppercase font-bold mb-1">LEGS</p><p className="text-gray-400 font-mono text-xl">{aggregatedStats.legPercent}%</p></div>
                </div>
                <div className="w-full h-1.5 flex bg-gray-800">
                  <div style={{ width: `${aggregatedStats.hsPercent}%` }} className="bg-[#ff4655]"></div>
                  <div style={{ width: `${aggregatedStats.bodyPercent}%` }} className="bg-gray-400"></div>
                  <div style={{ width: `${aggregatedStats.legPercent}%` }} className="bg-gray-600"></div>
                </div>
              </div>
            </div>

            <div className="w-full lg:w-2/3 flex flex-col gap-6">
              {aiStatFeedback && (
                <div className="bg-[#181a1e] border-l-4 border-l-indigo-500 border-y border-r border-white/5 p-6 shadow-2xl relative">
                  <div className="absolute top-0 right-0 bg-indigo-500/10 text-indigo-400 text-[10px] uppercase font-bold px-3 py-1">AI GENERATED REPORT</div>
                  <h3 className="font-black text-white mb-4 text-xl tracking-tight uppercase flex items-center gap-2">
                    <span className="text-indigo-500">❖</span> Macro Analysis
                  </h3>
                  <div className="whitespace-pre-wrap leading-relaxed text-sm text-gray-300">{aiStatFeedback}</div>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[#181a1e] border border-white/5 p-5 flex flex-col justify-center rounded-sm">
                  <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-2">WIN RATE</p>
                  <p className={`text-2xl font-mono ${aggregatedStats.winRate >= 50 ? 'text-[#00e5ff]' : 'text-[#ff4655]'}`}>{aggregatedStats.winRate}%</p>
                </div>
                <div className="bg-[#181a1e] border border-white/5 p-5 flex flex-col justify-center rounded-sm">
                  <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-2">K/D RATIO</p>
                  <p className="text-2xl font-mono text-white">{aggregatedStats.kd}</p>
                </div>
                <div className="bg-[#181a1e] border border-white/5 p-5 flex flex-col justify-center rounded-sm">
                  <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-2">AVG SCORE</p>
                  <p className="text-2xl font-mono text-white">{aggregatedStats.acs}</p>
                </div>
                <div className="bg-[#181a1e] border border-white/5 p-5 flex flex-col justify-center rounded-sm">
                  <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-2">ASSISTS</p>
                  <p className="text-2xl font-mono text-white">{aggregatedStats.assists}</p>
                </div>
              </div>

              <div className="bg-[#181a1e] border border-white/5 rounded-sm shadow-xl">
                <div className="px-6 py-4 border-b border-white/5 flex items-center gap-2">
                   <span className="w-2 h-2 bg-gray-500 inline-block"></span>
                   <h3 className="font-bold text-gray-400 text-[10px] uppercase tracking-widest">LAST {playerData.matches.length} MATCH LOGS ({filterMode})</h3>
                </div>
                <div className="flex flex-col">
                  {playerData.matches.map((match: any, index: number) => {
                    const myStats = match.players.all_players.find((p: any) => p.name.toLowerCase() === playerData.account.name.toLowerCase());
                    if (!myStats) return null;
                    const myTeam = myStats.team ? myStats.team.toLowerCase() : null;
                    const teamData = myTeam && match.teams ? match.teams[myTeam] : null;
                    const won = teamData ? teamData.has_won : false;
                    const myScore = teamData ? teamData.rounds_won : 0;
                    const enemyTeam = myTeam === 'red' ? 'blue' : 'red';
                    const enemyScore = match.teams && match.teams[enemyTeam] ? match.teams[enemyTeam].rounds_won : 0;
                    const matchKd = (myStats.stats.kills / (myStats.stats.deaths || 1)).toFixed(2);
                    
                    return (
                      <div key={index} className={`flex items-center justify-between px-6 py-4 border-b border-white/5 hover:bg-white/[0.02] transition ${won ? 'border-l-[3px] border-l-[#00e5ff]' : 'border-l-[3px] border-l-[#ff4655]'}`}>
                        <div className="flex items-center gap-4 w-1/4">
                          <img src={myStats.assets.agent.small} alt="agent" className="w-10 h-10 bg-[#0f1923] p-1 border border-white/10" />
                          <div>
                            <p className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-0.5">{match.metadata.mode}</p>
                            <p className="font-black text-white text-base uppercase leading-none">{match.metadata.map}</p>
                          </div>
                        </div>
                        <div className="w-1/6 text-center">
                          <p className={`font-mono text-xl ${won ? 'text-[#00e5ff]' : 'text-[#ff4655]'}`}>{myScore} - {enemyScore}</p>
                        </div>
                        <div className="w-1/5 text-center">
                          <p className="font-mono text-white text-sm">{myStats.stats.kills} / {myStats.stats.deaths} / {myStats.stats.assists}</p>
                          <p className="text-[10px] text-gray-500 mt-1 uppercase font-bold tracking-widest">KD: <span className={Number(matchKd) >= 1 ? 'text-[#00e5ff]' : 'text-[#ff4655]'}>{matchKd}</span></p>
                        </div>
                        <div className="w-auto text-right">
                          <button onClick={() => handleSelectMatchForVod({ mode: match.metadata.mode, agent: myStats.character, map: match.metadata.map, won, kills: myStats.stats.kills, deaths: myStats.stats.deaths, assists: myStats.stats.assists, teamRounds: myScore, enemyRounds: enemyScore })} className="px-4 py-2 bg-transparent hover:bg-white/5 border border-white/10 text-[10px] text-gray-300 uppercase font-bold tracking-widest transition rounded-sm">
                            Upload VOD
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

        {/* TAB 2: VOD ANALYZER */}
        {activeTab === 'vod' && (
          <div className="bg-[#181a1e] p-8 rounded-sm shadow-2xl border border-white/5 w-full max-w-4xl mx-auto relative">
            <h2 className="text-2xl font-black mb-6 uppercase tracking-tight flex items-center gap-2">
              <span className="text-[#ff4655]">❖</span> Micro Analysis Protocol
            </h2>
            {selectedMatch ? (
              <div className="mb-8 p-4 bg-[#ff4655]/5 border border-[#ff4655]/20 rounded-sm">
                <p className="text-[10px] text-[#ff4655] font-bold uppercase tracking-widest mb-1">LINKED CONTEXT</p>
                <p className="text-sm font-mono text-white uppercase">{selectedMatch.agent} // {selectedMatch.map} // {selectedMatch.kills}K - {selectedMatch.deaths}D</p>
              </div>
            ) : (
               <div className="mb-8 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-sm">
                 <p className="text-[10px] text-yellow-500 font-bold uppercase tracking-widest">⚠️ NO CONTEXT DETECTED. SELECT A MATCH FROM DASHBOARD FOR BEST RESULTS.</p>
               </div>
            )}
            {!previewUrl ? (
              <label className="flex flex-col items-center justify-center w-full h-48 border border-dashed border-white/20 bg-white/5 hover:bg-white/10 transition cursor-pointer rounded-sm">
                <span className="text-gray-300 font-bold uppercase tracking-widest text-sm mb-2">SELECT FOOTAGE (.MP4)</span>
                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">MAX SIZE: 4.5 MB</span>
                <input type="file" accept="video/mp4,video/webm" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if(f){ setVideoFile(f); setPreviewUrl(URL.createObjectURL(f)); } }} />
              </label>
            ) : (
              <div className="flex flex-col">
                <video src={previewUrl} controls className="w-full max-h-[400px] object-contain mb-6 border border-white/10 bg-black rounded-sm" />
                <div className="flex gap-4 w-full mb-2">
                  <button onClick={() => { setPreviewUrl(null); setVideoFile(null); setAiVodFeedback(null); }} className="px-8 py-3 bg-transparent border border-white/10 hover:bg-white/5 text-[10px] font-bold uppercase tracking-widest text-white transition rounded-sm disabled:opacity-50" disabled={analyzingStep !== null}>CANCEL</button>
                  <button onClick={handleAnalyzeVideo} className="flex-1 py-3 bg-[#ff4655] hover:bg-[#ff5866] text-white text-[10px] font-bold uppercase tracking-widest transition rounded-sm disabled:opacity-50" disabled={analyzingStep !== null}>
                    {analyzingStep ? analyzingStep : "INITIATE SCAN"}
                  </button>
                </div>
              </div>
            )}
            {aiVodFeedback && (
              <div className="mt-8 p-6 bg-indigo-500/10 border border-indigo-500/20 rounded-sm">
                <h3 className="font-bold text-indigo-400 mb-4 text-sm uppercase tracking-widest border-b border-indigo-500/20 pb-2">SCAN RESULTS</h3>
                <div className="leading-relaxed text-sm text-gray-300 whitespace-pre-wrap">{aiVodFeedback}</div>
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="w-full max-w-6xl mt-16 pt-8 border-t border-white/10 text-center text-gray-600 text-[10px] uppercase font-bold tracking-widest pb-8 flex flex-col items-center gap-2 relative z-10">
        <p>&copy; {new Date().getFullYear()} NAVEEN JOSEPH.</p>
        <p>BUILT BY <a href="https://www.naveenjoseph.me/" target="_blank" rel="noopener noreferrer" className="text-[#ff4655] hover:text-white transition-colors duration-300 relative group">NAVEEN JOSEPH<span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-[#ff4655] transition-all duration-300 group-hover:w-full"></span></a></p>
      </footer>
    </main>
  );
}
