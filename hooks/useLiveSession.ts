import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { TeachingMode, ChatMessage } from '../types';
import { FLUENT_AI_SYSTEM_INSTRUCTION, MODEL_NAME, VOICE_NAME } from '../constants';
import { base64ToBytes, bytesToBase64, decodeAudioData, float32ToInt16 } from '../utils/audioUtils';

interface UseLiveSessionProps {
  onModeChange: (mode: TeachingMode) => void;
}

export const useLiveSession = ({ onModeChange }: UseLiveSessionProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false); // Model is speaking
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Audio Contexts
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  
  // Streaming references
  const sessionRef = useRef<Promise<any> | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Playback queue
  const nextStartTimeRef = useRef<number>(0);
  const scheduledSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Define the tool
  const setTeachingModeTool: FunctionDeclaration = {
    name: 'setTeachingMode',
    description: 'Updates the current teaching mode displayed to the user.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        mode: {
          type: Type.STRING,
          enum: [
            TeachingMode.CONVERSATION,
            TeachingMode.CORRECTION,
            TeachingMode.EXPLANATION
          ],
          description: 'The new teaching mode.'
        }
      },
      required: ['mode']
    }
  };

  const stopAudioProcessing = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (inputSourceRef.current) {
      inputSourceRef.current.disconnect();
      inputSourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (inputContextRef.current) {
      inputContextRef.current.close();
      inputContextRef.current = null;
    }
  }, []);

  const stopPlayback = useCallback(() => {
    scheduledSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    scheduledSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    setIsSpeaking(false);
  }, []);

  const disconnect = useCallback(async () => {
    stopAudioProcessing();
    stopPlayback();

    if (sessionRef.current) {
      sessionRef.current.then((session) => {
        if (session && typeof session.close === 'function') {
          session.close();
        }
      }).catch(e => console.error("Error closing session", e));
    }
    
    if (outputContextRef.current) {
      outputContextRef.current.close();
      outputContextRef.current = null;
    }

    sessionRef.current = null;
    setIsConnected(false);
    onModeChange(TeachingMode.IDLE);
    setVolume(0);
  }, [stopAudioProcessing, stopPlayback, onModeChange]);

  const connect = useCallback(async () => {
    try {
      setError(null);
      setMessages([]); // Clear old messages on new connection

      // Safety check for API Key environment variable
      let apiKey = '';
      try {
        apiKey = process.env.API_KEY || '';
      } catch (e) {
        // process is likely not defined in this environment
        console.error("process.env is not defined");
      }

      if (!apiKey) {
        throw new Error("API Key is missing. Ensure process.env.API_KEY is set.");
      }

      const ai = new GoogleGenAI({ apiKey });
      
      // Initialize Audio Contexts
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      inputContextRef.current = new AudioContext({ sampleRate: 16000 });
      outputContextRef.current = new AudioContext({ sampleRate: 24000 });

      // Get Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Start Session
      const sessionPromise = ai.live.connect({
        model: MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } }
          },
          systemInstruction: FLUENT_AI_SYSTEM_INSTRUCTION,
          tools: [{ functionDeclarations: [setTeachingModeTool] }],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            console.log("Connection opened");
            setIsConnected(true);
            onModeChange(TeachingMode.CONVERSATION);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Tool Calls (Mode Switching)
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                if (fc.name === 'setTeachingMode') {
                  const newMode = (fc.args as any).mode;
                  if (Object.values(TeachingMode).includes(newMode)) {
                    onModeChange(newMode);
                  }
                  
                  // Respond to tool call
                  sessionPromise.then(session => {
                     session.sendToolResponse({
                        functionResponses: {
                           id: fc.id,
                           name: fc.name,
                           response: { result: "Mode updated" }
                        }
                     });
                  });
                }
              }
            }

            // Handle Transcriptions
            const serverContent = message.serverContent;
            if (serverContent) {
               const inputTx = serverContent.inputTranscription?.text;
               const outputTx = serverContent.outputTranscription?.text;

               if (inputTx || outputTx) {
                   setMessages((prev) => {
                       const newMsgs = [...prev];
                       const lastMsg = newMsgs[newMsgs.length - 1];

                       if (inputTx) {
                           if (lastMsg && lastMsg.role === 'user' && !lastMsg.isFinal) {
                               return [
                                   ...newMsgs.slice(0, -1),
                                   { ...lastMsg, text: lastMsg.text + inputTx }
                               ];
                           } else {
                               return [
                                   ...newMsgs,
                                   {
                                       id: Date.now().toString() + '-user',
                                       role: 'user',
                                       text: inputTx,
                                       timestamp: new Date(),
                                       isFinal: false
                                   }
                               ];
                           }
                       }

                       if (outputTx) {
                           if (lastMsg && lastMsg.role === 'model' && !lastMsg.isFinal) {
                               return [
                                   ...newMsgs.slice(0, -1),
                                   { ...lastMsg, text: lastMsg.text + outputTx }
                               ];
                           } else {
                               return [
                                   ...newMsgs,
                                   {
                                       id: Date.now().toString() + '-model',
                                       role: 'model',
                                       text: outputTx,
                                       timestamp: new Date(),
                                       isFinal: false
                                   }
                               ];
                           }
                       }
                       return prev;
                   });
               }

               if (serverContent.turnComplete) {
                   setMessages(prev => {
                       const newMsgs = [...prev];
                       const lastMsg = newMsgs[newMsgs.length - 1];
                       if (lastMsg && !lastMsg.isFinal) {
                           return [
                               ...newMsgs.slice(0, -1),
                               { ...lastMsg, isFinal: true }
                           ];
                       }
                       return prev;
                   });
               }
               
               if (serverContent.interrupted) {
                   setMessages(prev => {
                       const newMsgs = [...prev];
                       const lastMsg = newMsgs[newMsgs.length - 1];
                       if (lastMsg && !lastMsg.isFinal && lastMsg.role === 'model') {
                           return [
                               ...newMsgs.slice(0, -1),
                               { ...lastMsg, isFinal: true, text: lastMsg.text + ' ...' }
                           ];
                       }
                       return prev;
                   });
               }
            }

            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputContextRef.current) {
              setIsSpeaking(true);
              const ctx = outputContextRef.current;
              
              // Ensure we are synced
              const currentTime = ctx.currentTime;
              if (nextStartTimeRef.current < currentTime) {
                nextStartTimeRef.current = currentTime;
              }

              try {
                const audioBuffer = await decodeAudioData(
                  base64ToBytes(base64Audio),
                  ctx,
                  24000
                );

                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                const gainNode = ctx.createGain();
                gainNode.gain.value = 1.0; 
                source.connect(gainNode);
                gainNode.connect(ctx.destination);

                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                
                scheduledSourcesRef.current.add(source);
                source.onended = () => {
                   scheduledSourcesRef.current.delete(source);
                   if (scheduledSourcesRef.current.size === 0) {
                     setIsSpeaking(false);
                   }
                };
              } catch (e) {
                console.error("Audio decoding error", e);
              }
            }

            // Handle Interruption
            if (message.serverContent?.interrupted) {
              stopPlayback();
            }
          },
          onclose: () => {
            console.log("Connection closed");
            disconnect();
          },
          onerror: (err) => {
            console.error("Connection error", err);
            setError("Connection failed. Please try again.");
            disconnect();
          }
        }
      });
      
      sessionRef.current = sessionPromise;

      // Start Input Streaming
      if (inputContextRef.current && streamRef.current) {
        const source = inputContextRef.current.createMediaStreamSource(streamRef.current);
        inputSourceRef.current = source;
        
        // Use ScriptProcessor for capturing raw PCM
        const processor = inputContextRef.current.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          
          // Calculate volume for visualizer
          let sum = 0;
          for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i];
          }
          const rms = Math.sqrt(sum / inputData.length);
          setVolume(Math.min(1, rms * 5)); // Boost multiplier for visibility

          // Convert to PCM 16-bit
          const pcm16 = float32ToInt16(inputData);
          const pcmBlob = new Uint8Array(pcm16.buffer);
          const base64Data = bytesToBase64(pcmBlob);

          sessionPromise.then(session => {
             session.sendRealtimeInput({
                media: {
                  mimeType: 'audio/pcm;rate=16000',
                  data: base64Data
                }
             });
          });
        };

        source.connect(processor);
        processor.connect(inputContextRef.current.destination);
      }

    } catch (e) {
      console.error(e);
      setError("Failed to initialize session. API Key may be missing.");
      disconnect();
    }
  }, [onModeChange, disconnect, stopPlayback]);

  return {
    connect,
    disconnect,
    isConnected,
    isSpeaking,
    volume,
    error,
    messages
  };
};