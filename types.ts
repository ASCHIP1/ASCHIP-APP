export enum TeachingMode {
  CONVERSATION = 'Conversation Mode',
  CORRECTION = 'Correction Mode',
  EXPLANATION = 'Explanation Mode',
  IDLE = 'Ready to Start'
}

export interface AudioVisualizerProps {
  isPlaying: boolean;
  volume: number; // 0 to 1
}

export interface LiveConfig {
  model: string;
  systemInstruction: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isFinal?: boolean;
}