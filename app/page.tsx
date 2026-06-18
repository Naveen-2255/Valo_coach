'use client';
import { useState, useMemo } from 'react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'stats' | 'vod'>('stats');

  // --- STAT TRACKER STATE ---
  const [riotId, setRiotId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [playerData, setPlayerData] = useState<any>(null);
  const [statError, setStatError] = useState<string | null>(null);
  const [isCoachingStats, setIsCoachingStats] = useState(false);
  const [aiStatFeedback, setAiStatFeedback] = useState<string | null>(null);

  // --- VOD REVIEW STATE ---
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzingVideo, setIsAnalyzingVideo] = useState(false);
  const [aiVodFeedback, setAiVodFeedback] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatError(null); setPlayerData(null); setAiStatFeedback(null);
    if (!riotId.includes('#')) { setStatError("Please include hashtag (e.g., RiotId#Tag)"); return; }
    
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

  // --- AGGREGATE STATS ---
  const aggregatedStats = useMemo(() => {
    if (!playerData || !playerData.matches) return null;
    
    let kills = 0, deaths = 0, assists = 0, wins = 0;
    let headshots = 0, bodyshots = 0, legshots = 0;
    let totalScore = 0, totalRounds = 0;
    let validMatchesCount = 0;

    playerData.matches.forEach((match: any) => {
      const myStats = match.players.all_players.find((p: any) => p.name.toLowerCase() === playerData.account.name.toLowerCase());
      if (!myStats) return;

      validMatchesCount++;
      const myTeam = myStats.team ? myStats.team.toLowerCase() : null;

      if (myTeam && match.teams && match.teams[myTeam]) {
        if (match.teams[myTeam].has_won) wins++;
      }

      kills += myStats.stats.kills;
      deaths += myStats.stats.deaths;
      assists += myStats.stats.assists;
      headshots += myStats.stats.headshots;
      bodyshots += myStats.stats.bodyshots;
      legshots += myStats.stats.legshots;
      totalScore += myStats.stats.score;

      const redRounds = match.teams?.red?.rounds_won || 0;
      const blueRounds = match.teams?.blue?.rounds_won || 0;
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

  // --- AI ACTIONS ---
  const handleAnalyzeStats = async () => {
    if (!playerData || !aggregatedStats) {
      alert("Data is still loading, please wait a second and try again!");
      return;
    }
    
    setIsCoachingStats(true); 
    setAiStatFeedback(null);

    // Grab a quick summary of the recent matches so the AI knows what agents they play
    const simplifiedMatches = playerData.matches.map((match: any) => {
      const myStats = match.players.all_players.find((p: any) => p.name.toLowerCase() === playerData.account.name.toLowerCase());
      if (!myStats) return null;
      return { agent: myStats.character, kills: myStats.stats.kills, deaths: myStats.stats.deaths, assists: myStats.stats.assists };
    }).filter(Boolean);

    try {
      const res = await fetch('/api/coach-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send BOTH the aggregated totals and the match breakdown
        body: JSON.stringify({ 
          playerName: playerData.account.name, 
          matchData: { averages: aggregatedStats, recentGames: simplifiedMatches } 
        }),
      });
      const data = await res.json();
      
      // THIS WAS MISSING: It will now accurately tell you if the AI crashes!
      if (data.feedback) {
        setAiStatFeedback(data.feedback);
      } else {
        alert("AI Error: " + data.error); 
      }
    } catch (err) { 
      alert("Failed to connect to the AI Stat Coach."); 
    } 
    finally { 
      setIsCoachingStats(false); 
    }
  };

  const handleSelectMatchForVod = (matchInfo: any) => {
    setSelectedMatch(matchInfo);
    setVideoFile(null); setPreviewUrl(null); setAiVodFeedback(null);
    setActiveTab('vod');
  };

  const handleAnalyzeVideo = async () => {
    if (!videoFile) return;
    setIsAnalyzingVideo(true); 
    setAiVodFeedback(null);

    const formData = new FormData();
    formData.append('video', videoFile);
    
    if (selectedMatch) {
      // NEW: Included selectedMatch.mode in the text we send to Gemini!
      const contextString = `Mode: ${selectedMatch.mode}, Map: ${selectedMatch.map}, Result: ${selectedMatch.won ? 'Victory' : 'Defeat'}, Stats: ${selectedMatch.kills}K/${selectedMatch.deaths}D/${selectedMatch.assists}A on ${selectedMatch.agent}`;
      formData.append('agent', selectedMatch.agent);
      formData.append('matchContext', contextString);
    } else {
      formData.append('agent', 'the player');
      formData.append('matchContext', 'No match context provided.');
    }

    try {
      const response = await fetch('/api/analyze', { method: 'POST', body: formData });
      const data = await response.json();
      if (data.feedback) setAiVodFeedback(data.feedback);
      else alert("Oops! " + data.error);
    } catch (error) { 
      alert("Error talking to the AI coach."); 
    } finally { 
      setIsAnalyzingVideo(false); 
    }
  };

  return (
    <main className="min-h-screen bg-[#0f1923] text-gray-200 font-sans p-6 flex flex-col items-center">
      <div className="w-full max-w-6xl flex justify-between items-center mb-8">
        <h1 className="text-3xl font-black uppercase text-[#ff4655] tracking-tighter">Valorant <span className="text-white">AI Tracker</span></h1>
        <form onSubmit={handleSearch} className="flex w-96">
          <input type="text" placeholder="RiotId#Tag" value={riotId} onChange={(e) => setRiotId(e.target.value)} className="flex-1 px-4 py-2 bg-[#1f2326] border border-gray-700 rounded-l-md focus:outline-none focus:border-[#ff4655]" required />
          <button type="submit" disabled={isSearching} className="px-6 py-2 bg-[#ff4655] hover:bg-[#ff5866] text-white font-bold rounded-r-md transition disabled:opacity-50">{isSearching ? "..." : "Search"}</button>
        </form>
      </div>

      <div className="w-full max-w-6xl">
        <div className="flex bg-[#1f2326] rounded-md p-1 mb-6 border border-gray-800 w-80 shadow-lg">
          <button onClick={() => setActiveTab('stats')} className={`flex-1 py-2 rounded font-bold text-sm transition ${activeTab === 'stats' ? 'bg-[#ff4655] text-white' : 'text-gray-400 hover:text-white'}`}>📊 Tracker Dashboard</button>
          <button onClick={() => setActiveTab('vod')} className={`flex-1 py-2 rounded font-bold text-sm transition ${activeTab === 'vod' ? 'bg-[#ff4655] text-white' : 'text-gray-400 hover:text-white'}`}>🎬 VOD Coach</button>
        </div>

        {statError && <div className="p-4 mb-6 bg-red-900/50 border border-red-500 rounded text-red-200">{statError}</div>}

        {/* TAB 1: TRACKER DASHBOARD */}
        {activeTab === 'stats' && playerData && aggregatedStats && (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="w-full lg:w-1/3 flex flex-col gap-6">
              <div className="bg-[#1f2326] rounded-lg border border-gray-800 p-6 relative overflow-hidden shadow-lg">
                <div className="absolute inset-0 opacity-10 bg-cover bg-center" style={{ backgroundImage: `url(${playerData.account.card.wide})` }}></div>
                <div className="relative z-10 flex gap-4 items-center">
                  <img src={playerData.account.card.small} alt="Card" className="w-20 h-20 rounded border border-gray-600 shadow-md" />
                  <div>
                    <h2 className="text-2xl font-black">{playerData.account.name} <span className="text-gray-500 text-lg">#{playerData.account.tag}</span></h2>
                    {playerData.mmr ? (
                      <p className="text-[#ff4655] font-bold text-lg">{playerData.mmr.current_data.currenttierpatched} <span className="text-gray-400 text-sm ml-1 font-normal">({playerData.mmr.current_data.ranking_in_tier} RR)</span></p>
                    ) : <p className="text-gray-400">Unranked</p>}
                  </div>
                </div>
                <button 
                  onClick={handleAnalyzeStats} 
                  disabled={isCoachingStats} 
                  className="relative z-10 w-full mt-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded text-sm transition shadow-[0_0_15px_rgba(79,70,229,0.3)] disabled:opacity-50 cursor-pointer"
                >
                  {isCoachingStats ? "AI is analyzing..." : "✨ Analysis my Stats"}
                </button>
              </div>

              <div className="bg-[#1f2326] rounded-lg border border-gray-800 p-6 shadow-lg">
                <h3 className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-4">Accuracy (Last 20)</h3>
                <div className="flex justify-between items-end mb-6">
                  <div className="text-center"><p className="text-gray-400 text-xs">Head</p><p className="text-[#ff4655] font-bold text-xl">{aggregatedStats.hsPercent}%</p></div>
                  <div className="text-center"><p className="text-gray-400 text-xs">Body</p><p className="text-[#00e5ff] font-bold text-xl">{aggregatedStats.bodyPercent}%</p></div>
                  <div className="text-center"><p className="text-gray-400 text-xs">Legs</p><p className="text-yellow-400 font-bold text-xl">{aggregatedStats.legPercent}%</p></div>
                </div>
                <div className="w-full h-2 rounded-full flex overflow-hidden bg-gray-800">
                  <div style={{ width: `${aggregatedStats.hsPercent}%` }} className="bg-[#ff4655]"></div>
                  <div style={{ width: `${aggregatedStats.bodyPercent}%` }} className="bg-[#00e5ff]"></div>
                  <div style={{ width: `${aggregatedStats.legPercent}%` }} className="bg-yellow-400"></div>
                </div>
              </div>


            </div>

            {/* RIGHT COLUMN: MAIN STATS & MATCH HISTORY */}
            <div className="w-full lg:w-2/3 flex flex-col gap-6">

              {/* ✨ MOVED HERE: AI Feedback Box */}
              {aiStatFeedback && (
                <div className="bg-indigo-900/30 border border-indigo-500/50 rounded-lg p-6 text-base text-indigo-100 shadow-lg">
                  <h3 className="font-bold text-indigo-400 mb-3 text-xl tracking-wide">🤖 AI Coach Analysis</h3>
                  <div className="whitespace-pre-wrap leading-relaxed">{aiStatFeedback}</div>
                </div>
              )}

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

              <div className="bg-[#1f2326] border border-gray-800 rounded-lg overflow-hidden shadow-lg">
                <div className="px-6 py-4 border-b border-gray-800 bg-[#181a1e]">
                  <h3 className="font-bold text-gray-300">Last {playerData.matches.length} Matches</h3>
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
                    
                    // Add 'mode' to the match info we save for the VOD!
                    const matchInfoForVod = {
                      mode: match.metadata.mode, 
                      agent: myStats.character, 
                      map: match.metadata.map, 
                      won, 
                      kills: myStats.stats.kills, 
                      deaths: myStats.stats.deaths, 
                      assists: myStats.stats.assists, 
                      teamRounds: myScore, 
                      enemyRounds: enemyScore 
                    };
                    
                    return (
                      <div key={index} className={`flex items-center justify-between p-4 border-b border-gray-800/50 hover:bg-gray-800/20 transition ${won ? 'border-l-4 border-l-[#00e5ff] bg-gradient-to-r from-[#00e5ff]/5 to-transparent' : 'border-l-4 border-l-[#ff4655] bg-gradient-to-r from-[#ff4655]/5 to-transparent'}`}>
                        {/* Agent, Mode & Map */}
                        <div className="flex items-center gap-4 w-1/4">
                          <img src={myStats.assets.agent.small} alt="agent" className="w-12 h-12 rounded-full border border-gray-700 bg-[#0f1923]" />
                          <div>
                            {/* NEW: Displays the Game Mode (Competitive, Swiftplay, etc.) */}
                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-0.5">
                              {match.metadata.mode}
                            </p>
                            <p className="font-bold text-white text-lg leading-tight">{match.metadata.map}</p>
                            <p className="text-xs text-gray-500">{myStats.character}</p>
                          </div>
                        </div>
                        <div className="w-1/6 text-center">
                          <p className={`font-black text-lg ${won ? 'text-[#00e5ff]' : 'text-[#ff4655]'}`}>{myScore} : {enemyScore}</p>
                          <p className="text-[10px] uppercase font-bold text-gray-500">{won ? 'Victory' : 'Defeat'}</p>
                        </div>
                        <div className="w-1/5 text-center">
                          <p className="font-mono text-gray-200 font-bold">{myStats.stats.kills} / {myStats.stats.deaths} / {myStats.stats.assists}</p>
                          <p className="text-xs text-gray-500 mt-1">KD: <span className={Number(matchKd) >= 1 ? 'text-green-400' : 'text-red-400'}>{matchKd}</span></p>
                        </div>
                        <div className="w-auto text-right">
                          <button 
                            onClick={() => handleSelectMatchForVod(matchInfoForVod)} 
                            className="p-2 bg-gray-800 hover:bg-[#ff4655] rounded text-xs font-bold transition border border-gray-700 hover:border-[#ff4655] text-gray-300 hover:text-white"
                          >
                            🎬 Analyze VOD
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
          <div className="bg-[#1f2326] p-8 rounded-lg shadow-lg border border-gray-800 w-full max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 border-b border-gray-800 pb-4">🎬 VOD Analyzer</h2>
            
            {selectedMatch ? (
              <div className="mb-6 p-4 bg-[#ff4655]/10 rounded border-l-4 border-[#ff4655]">
                <p className="text-xs text-[#ff4655] font-bold uppercase mb-1">Context Linked</p>
                <p className="font-bold text-white">{selectedMatch.agent} on {selectedMatch.map} • {selectedMatch.kills}K / {selectedMatch.deaths}D</p>
              </div>
            ) : (
               <div className="mb-6 p-4 bg-yellow-900/20 rounded border-l-4 border-yellow-500 text-yellow-300 text-sm">
                 ⚠️ No match context linked. For the smartest coaching, select a match from the Tracker Dashboard first.
               </div>
            )}

            {!previewUrl ? (
              <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:bg-gray-800/50 transition">
                <span className="text-gray-400 mb-2 text-xl">📁 Select Video (.mp4)</span>
                
                {/* NEW: The 4.5MB Warning Message */}
                <span className="text-[#ff4655] text-sm font-bold bg-[#ff4655]/10 px-3 py-1 rounded mt-2">
                  ⚠️ Max file size: 4.5 MB
                </span>
                
                <input 
                  type="file" 
                  accept="video/mp4,video/webm" 
                  className="hidden" 
                  onChange={(e) => { 
                    const f = e.target.files?.[0]; 
                    if(f){ 
                      // NEW: JavaScript check to block files larger than 4.5 MB
                      const maxSizeInBytes = 4.5 * 1024 * 1024;
                      if (f.size > maxSizeInBytes) {
                        alert("File is too large! Because this is a free portfolio demo, please compress your video to under 4.5 MB.");
                        return;
                      }
                      setVideoFile(f); 
                      setPreviewUrl(URL.createObjectURL(f)); 
                    } 
                  }} 
                />
              </label>
            ) : (
              <div className="flex flex-col">
                <video src={previewUrl} controls className="w-full max-h-[500px] object-contain rounded mb-4 shadow-lg border border-gray-700 bg-black" />
                <div className="flex gap-4 w-full mb-6">
                  <button onClick={() => { setPreviewUrl(null); setVideoFile(null); setAiVodFeedback(null); }} className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded font-bold transition disabled:opacity-50" disabled={isAnalyzingVideo}>Cancel</button>
                  <button onClick={handleAnalyzeVideo} className="flex-1 px-4 py-3 bg-[#ff4655] hover:bg-[#ff5866] text-white rounded font-bold transition disabled:opacity-50 shadow-[0_0_15px_rgba(255,70,85,0.4)]">
                    {isAnalyzingVideo ? "Watching VOD..." : "Analyze Contextual VOD"}
                  </button>
                </div>
              </div>
            )}

            {aiVodFeedback && (
              <div className="mt-2 p-6 bg-indigo-900/30 border border-indigo-500/50 rounded-lg whitespace-pre-wrap text-indigo-100 shadow-lg">
                <h3 className="font-bold text-indigo-400 mb-2 text-lg">🤖 AI Micro Analysis</h3>
                <div className="leading-relaxed">{aiVodFeedback}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- NEW FOOTER --- */}
      <footer className="w-full max-w-6xl mt-16 pt-8 border-t border-gray-800/50 text-center text-gray-500 text-sm pb-8 flex flex-col items-center gap-2">
        <p>&copy; {new Date().getFullYear()} Copyright reserved to Naveen Joseph.</p>
        <p>
          Creatively built by{' '}
          <a 
            href="https://www.naveenjoseph.me/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-[#ff4655] font-bold hover:text-white transition-colors duration-300 relative group"
          >
            Naveen Joseph
            {/* Cool animated underline effect on hover */}
            <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-[#ff4655] transition-all duration-300 group-hover:w-full"></span>
          </a>
        </p>
      </footer>

    </main>
  );
}
