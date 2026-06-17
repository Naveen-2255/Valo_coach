'use client';
import { useState } from 'react';

export default function Home() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setFeedback(null); // Clear old feedback when uploading a new video
    }
  };

  const handleAnalyze = async () => {
    if (!videoFile) return;
    setIsLoading(true);
    setFeedback(null);

    // Prepare the video file to send to the backend
    const formData = new FormData();
    formData.append('video', videoFile);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (data.feedback) {
        setFeedback(data.feedback);
      } else {
        alert("Oops! Something went wrong: " + data.error);
      }
    } catch (error) {
      alert("Error talking to the AI coach.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-900 text-white flex flex-col items-center py-10 px-6 font-sans">
      <div className="max-w-2xl w-full bg-neutral-800 p-8 rounded-xl shadow-2xl border border-red-500/30">
        <h1 className="text-4xl font-black text-center mb-2 uppercase tracking-wide text-red-500">
          Valorant AI Coach
        </h1>
        <p className="text-gray-400 text-center mb-8">
          Upload a 30-second clip of your death. Get roasted. Get better.
        </p>

        {/* Upload Box */}
        {!previewUrl ? (
          <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer bg-neutral-700/50 hover:bg-neutral-700 transition">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <span className="text-gray-400 mb-2 text-xl">📁 Click to upload a VOD (.mp4)</span>
              <p className="text-xs text-gray-500">Max 30 seconds recommended</p>
            </div>
            <input type="file" accept="video/mp4,video/webm" className="hidden" onChange={handleFileChange} />
          </label>
        ) : (
          <div className="flex flex-col items-center">
            <video 
              src={previewUrl} 
              controls 
              className="w-full rounded-lg mb-4 border border-neutral-700 shadow-lg"
            />
            
            {/* Action Buttons */}
            <div className="flex gap-4 w-full mb-6">
              <button 
                onClick={() => { setPreviewUrl(null); setVideoFile(null); setFeedback(null); }}
                className="flex-1 px-4 py-3 bg-neutral-700 hover:bg-neutral-600 rounded-lg font-bold transition disabled:opacity-50"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button 
                onClick={handleAnalyze}
                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 rounded-lg font-bold transition text-white flex justify-center items-center disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? "Coach is watching..." : "Analyze My Mistake"}
              </button>
            </div>

            {/* AI Feedback Box */}
            {feedback && (
              <div className="w-full p-6 bg-neutral-900 border border-neutral-700 rounded-lg whitespace-pre-wrap">
                <h3 className="text-red-400 font-bold mb-2 text-lg">Coach's Analysis:</h3>
                <p className="text-gray-300 leading-relaxed">{feedback}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
