import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, BookOpen, MessageCircle, AlertCircle, Info, Key, X } from 'lucide-react';
import { useLiveSession } from './hooks/useLiveSession';
import { Visualizer } from './components/Visualizer';
import { TeachingMode } from './types';

// Hardcoded Default Key (as requested)
const DEFAULT_API_KEY = 'AIzaSyDrXVpxzuQr6yoHa4zQ6yAWStyyOxvvI5g';

// Simple API Key Modal Component
const ApiKeyModal = ({ 
    isOpen, 
    onSave, 
    onClose 
}: { 
    isOpen: boolean; 
    onSave: (key: string) => void;
    onClose: () => void;
}) => {
    const [inputKey, setInputKey] = useState('');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl mx-4 relative">
                 {/* Close Button if we want to allow closing without saving (optional, but good UX if user wants to cancel) */}
                 <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                 </button>

                <div className="flex flex-col items-center mb-6">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4 text-blue-600">
                        <Key className="w-6 h-6" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 text-center">Enter Access Key</h2>
                    <p className="text-gray-500 text-center mt-2 text-sm">To use FluentAI, please provide your Google Gemini API Key.</p>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                        <input 
                            type="password" 
                            placeholder="AIzaSy..." 
                            value={inputKey}
                            onChange={(e) => setInputKey(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 focus:bg-white"
                        />
                    </div>
                    <button 
                        onClick={() => onSave(inputKey)}
                        className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/30"
                    >
                        Start Learning
                    </button>
                </div>
                
                <div className="text-xs text-center mt-6 space-y-1 text-gray-400">
                   <p>Don't have a key? <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-medium">Get one here</a>.</p>
                   <p className="text-amber-600">Live API requires a Paid Project (Billing Enabled).</p>
                </div>
            </div>
        </div>
    );
};

export default function App() {
  const [currentMode, setCurrentMode] = useState<TeachingMode>(TeachingMode.IDLE);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Load Key on Mount
  useEffect(() => {
      const stored = localStorage.getItem('fluentai_api_key');
      // If process.env.API_KEY is set (e.g. at build time or Vercel env), use it.
      // Otherwise use localStorage.
      if (typeof process !== 'undefined' && process.env.API_KEY) {
          setApiKey(process.env.API_KEY);
      } else if (stored) {
          setApiKey(stored);
      } else {
          // Fallback to the hardcoded key if no other key is found
          setApiKey(DEFAULT_API_KEY);
      }
  }, []);

  const { 
    connect, 
    disconnect, 
    isConnected, 
    isSpeaking, 
    volume,
    error,
    setError,
    messages
  } = useLiveSession({
    onModeChange: (mode) => setCurrentMode(mode),
    apiKey: apiKey
  });

  const handleToggle = () => {
    if (isConnected) {
      disconnect();
    } else {
      if (!apiKey) {
        setIsKeyModalOpen(true);
      } else {
        connect();
      }
    }
  };

  const saveApiKey = (key: string) => {
      if (key.trim()) {
          localStorage.setItem('fluentai_api_key', key.trim());
          setApiKey(key.trim());
          setIsKeyModalOpen(false);
          // Optional: Auto-connect after saving
          // connect(); 
      }
  };
  
  const clearApiKey = () => {
      localStorage.removeItem('fluentai_api_key');
      setApiKey(null);
      setIsKeyModalOpen(true);
  };

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const getModeIcon = () => {
    switch (currentMode) {
      case TeachingMode.CONVERSATION: return <MessageCircle className="w-5 h-5" />;
      case TeachingMode.CORRECTION: return <AlertCircle className="w-5 h-5" />;
      case TeachingMode.EXPLANATION: return <BookOpen className="w-5 h-5" />;
      default: return <Info className="w-5 h-5" />;
    }
  };

  const getModeColor = () => {
    switch (currentMode) {
      case TeachingMode.CONVERSATION: return 'text-blue-600 bg-blue-100 border-blue-200';
      case TeachingMode.CORRECTION: return 'text-yellow-700 bg-yellow-100 border-yellow-200';
      case TeachingMode.EXPLANATION: return 'text-purple-700 bg-purple-100 border-purple-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900 relative overflow-hidden">
      
      <ApiKeyModal 
        isOpen={isKeyModalOpen} 
        onSave={saveApiKey}
        onClose={() => setIsKeyModalOpen(false)}
      />

      {/* Background Image Overlay */}
      <div 
        className="absolute inset-0 z-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: 'url("https://picsum.photos/1920/1080?grayscale&blur=2")',
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      />

      {/* Header */}
      <header className="relative z-10 w-full max-w-5xl mx-auto p-4 md:p-6 flex justify-between items-center bg-white/80 backdrop-blur-sm rounded-b-2xl shadow-sm mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">F</div>
          <span className="text-2xl font-bold tracking-tight text-gray-800">FluentAI</span>
        </div>
        
        <div className="flex items-center gap-2">
            {/* Mode Badge */}
            <div className={`transition-all duration-300 ${isConnected ? 'opacity-100' : 'opacity-0'}`}>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${getModeColor()} shadow-sm`}>
                {getModeIcon()}
                <span className="font-semibold tracking-wide uppercase text-xs hidden md:inline">
                {currentMode}
                </span>
            </div>
            </div>
            
            {/* Reset Key Button */}
            <button 
                onClick={clearApiKey} 
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                title="Change API Key"
            >
                <Key className="w-5 h-5" />
            </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-between p-4 max-w-3xl w-full mx-auto">
        
        {/* Intro Text (Hidden when connected or messages exist) */}
        <div className={`flex-1 flex flex-col items-center justify-center transition-opacity duration-500 absolute inset-0 z-0 p-6 pointer-events-none ${isConnected || messages.length > 0 ? 'opacity-0' : 'opacity-100'}`}>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4 text-gray-900 text-center">
            Your Personal <span className="text-blue-600">English Tutor</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto text-center">
            Master English through natural conversation. 
            No text typing, just speak. Adaptive, empathetic, and real-time.
          </p>
        </div>

        {/* Chat / Transcription Area */}
        <div 
          ref={chatContainerRef}
          className={`flex-1 w-full overflow-y-auto mb-6 space-y-4 pr-2 scroll-smooth z-10 ${messages.length === 0 ? 'invisible' : 'visible'}`}
          style={{ maxHeight: 'calc(100vh - 300px)' }}
        >
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[80%] rounded-2xl px-5 py-3 shadow-sm text-sm md:text-base leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-br-none' 
                    : 'bg-white border border-gray-100 text-gray-800 rounded-bl-none'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Controls */}
        <div className="flex flex-col items-center w-full z-20 bg-white/90 backdrop-blur-md rounded-3xl p-6 shadow-xl border border-white/20">
            
            {/* Tutor Speaking Indicator */}
            <div className={`h-5 mb-2 flex items-center justify-center transition-all duration-300 ${isConnected && isSpeaking ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
              <span className="text-xs font-bold tracking-widest text-blue-600 uppercase bg-blue-50 px-3 py-1 rounded-full border border-blue-100 shadow-sm">
                FluentAI is speaking
              </span>
            </div>

            {/* Visualizer */}
            <div className="h-16 flex items-center justify-center w-full max-w-md mb-4">
              {isConnected ? (
                <Visualizer 
                    isActive={isConnected} 
                    isSpeaking={isSpeaking}
                    volume={volume} 
                    mode={currentMode} 
                />
              ) : (
                <div className="text-gray-400 italic text-sm">Tap the mic to start speaking...</div>
              )}
            </div>

            {/* Main Mic Button */}
            <div className="relative group">
              {isConnected && <div className="absolute inset-0 bg-blue-400 rounded-full animate-pulse-ring opacity-50"></div>}
              
              <button
                onClick={handleToggle}
                className={`
                  relative z-10 flex items-center justify-center w-20 h-20 rounded-full shadow-2xl transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-offset-2
                  ${isConnected 
                    ? 'bg-red-500 hover:bg-red-600 focus:ring-red-500 rotate-0' 
                    : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-600 hover:scale-105'
                  }
                `}
              >
                {isConnected ? (
                  <MicOff className="w-8 h-8 text-white" />
                ) : (
                  <Mic className="w-8 h-8 text-white" />
                )}
              </button>
            </div>
            
             {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2 max-w-md mx-auto animate-pulse">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="font-medium">{error}</span>
                    <button 
                        onClick={() => { setIsKeyModalOpen(true); setError(null); }}
                        className="ml-auto text-xs bg-white border border-red-300 px-2 py-1 rounded hover:bg-red-50"
                    >
                        Check Key
                    </button>
                </div>
              )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-4 text-center text-gray-400 text-xs">
        <p>© 2025 FluentAI. Powered by Gemini.</p>
      </footer>

    </div>
  );
}