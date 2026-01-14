import { useState, useCallback, useRef, useEffect } from "react";
import {
  Room,
  RoomEvent,
  createLocalAudioTrack,
  LocalAudioTrack,
} from "livekit-client";
import type { ConnectionStatus, TranscriptSegment } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface UseLiveKitReturn {
  status: ConnectionStatus;
  isRecording: boolean;
  segments: TranscriptSegment[];
  audioLevel: number;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  roomName: string | null;
  error: string | null;
  mode: "live" | "demo" | null;
}

export function useLiveKit(): UseLiveKitReturn {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [isRecording, setIsRecording] = useState(false);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"live" | "demo" | null>(null);
  
  const roomRef = useRef<Room | null>(null);
  const audioTrackRef = useRef<LocalAudioTrack | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionStartRef = useRef<number>(0);
  const isActiveRef = useRef(false);

  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      isActiveRef.current = true;
      setError(null);
      setStatus("connecting");
      setSegments([]);
      setMode(null);

      const response = await apiRequest("POST", "/api/livekit/token");
      const tokenResponse = await response.json();
      const { token, roomName: room } = tokenResponse;
      setRoomName(room);

      let useLiveMode = false;
      
      try {
        const liveKitRoom = new Room({
          audioCaptureDefaults: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        roomRef.current = liveKitRoom;

        liveKitRoom.on(RoomEvent.ConnectionStateChanged, (state) => {
          console.log("LiveKit connection state:", state);
        });

        const wsUrl = import.meta.env.VITE_LIVEKIT_URL || "wss://kimo-zg71lj4i.livekit.cloud";
        await liveKitRoom.connect(wsUrl, token);
        console.log("LiveKit room connected");

        const audioTrack = await createLocalAudioTrack({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        });

        audioTrackRef.current = audioTrack;
        await liveKitRoom.localParticipant.publishTrack(audioTrack);
        console.log("Audio track published");

        const audioContext = new AudioContext();
        const mediaStream = new MediaStream([audioTrack.mediaStreamTrack]);
        const source = audioContext.createMediaStreamSource(mediaStream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        const updateLevel = () => {
          if (!isActiveRef.current) return;
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setAudioLevel(average / 255);
          requestAnimationFrame(updateLevel);
        };

        requestAnimationFrame(updateLevel);
        useLiveMode = true;
      } catch (micError) {
        console.warn("Microphone/LiveKit not available, using demo mode:", micError);
        if (roomRef.current) {
          roomRef.current.disconnect();
          roomRef.current = null;
        }
      }

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("Transcription WebSocket connected");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("WebSocket message:", data.type);
          
          if (data.type === "status") {
            console.log("Server mode:", data.mode, "Whisper ready:", data.whisper_ready);
            setMode(data.mode === "demo" ? "demo" : useLiveMode ? "live" : "demo");
          }
          
          if (data.type === "transcript" && data.text) {
            const segment: TranscriptSegment = {
              id: data.id || crypto.randomUUID(),
              timestamp: data.timestamp || Date.now() - sessionStartRef.current,
              text: data.text,
              confidence: data.confidence,
              speaker: data.speaker,
              isFinal: data.isFinal ?? true,
            };
            
            setSegments((prev) => {
              if (!segment.isFinal) {
                const existingIndex = prev.findIndex((s) => !s.isFinal);
                if (existingIndex >= 0) {
                  const updated = [...prev];
                  updated[existingIndex] = segment;
                  return updated;
                }
                return [...prev, segment];
              }
              const filtered = prev.filter((s) => s.isFinal);
              return [...filtered, segment];
            });
          }
        } catch (e) {
          console.error("Failed to parse WebSocket message:", e);
        }
      };

      ws.onerror = (e) => {
        console.error("WebSocket error:", e);
      };

      ws.onclose = (e) => {
        console.log("WebSocket closed, code:", e.code, "reason:", e.reason);
        if (isActiveRef.current) {
          setStatus("disconnected");
          setIsRecording(false);
          isActiveRef.current = false;
        }
      };

      sessionStartRef.current = Date.now();
      setMode(useLiveMode ? "live" : "demo");
      setStatus("connected");
      setIsRecording(true);

    } catch (err) {
      console.error("Failed to start recording:", err);
      setError(err instanceof Error ? err.message : "Failed to start recording");
      setStatus("error");
      setIsRecording(false);
      isActiveRef.current = false;
    }
  }, []);

  const stopRecording = useCallback(() => {
    isActiveRef.current = false;
    
    if (audioTrackRef.current) {
      audioTrackRef.current.stop();
      audioTrackRef.current = null;
    }

    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close(1000, "User stopped recording");
      wsRef.current = null;
    }

    setStatus("disconnected");
    setIsRecording(false);
    setAudioLevel(0);
    setMode(null);
  }, []);

  return {
    status,
    isRecording,
    segments,
    audioLevel,
    startRecording,
    stopRecording,
    roomName,
    error,
    mode,
  };
}
