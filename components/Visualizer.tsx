import React, { useEffect, useState } from 'react';

interface VisualizerProps {
  isActive: boolean;
  isSpeaking: boolean;
  volume: number; // 0 to 1
  mode: string;
}

export const Visualizer: React.FC<VisualizerProps> = ({ isActive, isSpeaking, volume, mode }) => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let animationFrameId: number;
    
    const animate = () => {
      if (isActive && isSpeaking) {
        setTick((prev) => prev + 0.2);
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    if (isActive && isSpeaking) {
      animate();
    } else {
      setTick(0);
      if (animationFrameId!) cancelAnimationFrame(animationFrameId);
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isActive, isSpeaking]);

  const getBarHeight = (index: number) => {
    if (!isActive) return 4; // Flat line when inactive

    if (isSpeaking) {
      // Smooth wave animation when model is speaking
      // Mix sine waves for a more organic "voice" look
      const base = Math.sin(tick + index * 0.8);
      const secondary = Math.cos(tick * 0.5 + index * 0.5);
      const combined = (base + secondary) / 2; // -1 to 1
      
      const normalized = (combined + 1) / 2; // 0 to 1
      
      // Scale to height range 12px - 48px
      return 12 + normalized * 36;
    } else {
      // Microphone volume reaction
      // Boost volume for visibility
      const v = Math.min(Math.max(volume, 0.05), 1); 
      
      // Apply a curve so center bars are taller
      const distribution = [0.4, 0.7, 1.0, 0.7, 0.4];
      const scale = distribution[index];
      
      // Add a tiny bit of noise/jitter for "aliveness" even when silent
      const noise = Math.random() * 4;
      
      return 8 + (v * 50 * scale) + noise;
    }
  };

  const getBarColor = () => {
      switch (mode) {
          case 'Conversation Mode': return 'bg-blue-500';
          case 'Correction Mode': return 'bg-yellow-500';
          case 'Explanation Mode': return 'bg-purple-500';
          default: return 'bg-gray-400';
      }
  };

  return (
    <div className="flex items-center justify-center gap-1.5 h-16">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={`w-2.5 rounded-full transition-all duration-75 ${getBarColor()}`}
          style={{ height: `${getBarHeight(i)}px` }}
        />
      ))}
    </div>
  );
};