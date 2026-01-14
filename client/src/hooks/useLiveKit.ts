import { useState, useCallback, useRef, useEffect } from "react";
import {
  Room,
  RoomEvent,
  Track,
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
}

export function useLiveKit(): UseLiveKitReturn {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [isRecording, setIsRecording] = useState(false);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const roomRef = useRef<Room | null>(null);
  const audioTrackRef = useRef<LocalAudioTrack | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionStartRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const connectWebSocket = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
      console.log("WebSocket connected for transcription");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "transcript") {
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

    ws.onclose = () => {
      console.log("WebSocket closed");
    };

    wsRef.current = ws;
    return ws;
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setStatus("connecting");
      setSegments([]);

      const response = await apiRequest("POST", "/api/livekit/token");
      const tokenResponse = await response.json();
      const { token, roomName: room } = tokenResponse;
      setRoomName(room);

      let microphoneAvailable = true;
      
      try {
        const liveKitRoom = new Room({
          audioCaptureDefaults: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        roomRef.current = liveKitRoom;

        liveKitRoom.on(RoomEvent.Disconnected, () => {
          setStatus("disconnected");
          setIsRecording(false);
        });

        liveKitRoom.on(RoomEvent.ConnectionStateChanged, (state) => {
          console.log("Connection state:", state);
        });

        const wsUrl = import.meta.env.VITE_LIVEKIT_URL || "wss://kimo-zg71lj4i.livekit.cloud";
        await liveKitRoom.connect(wsUrl, token);

        const audioTrack = await createLocalAudioTrack({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        });

        audioTrackRef.current = audioTrack;
        
        await liveKitRoom.localParticipant.publishTrack(audioTrack);

        const audioContext = new AudioContext();
        const mediaStream = new MediaStream([audioTrack.mediaStreamTrack]);
        const source = audioContext.createMediaStreamSource(mediaStream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        const updateLevel = () => {
          if (roomRef.current === null) return;
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setAudioLevel(average / 255);
          requestAnimationFrame(updateLevel);
        };

        requestAnimationFrame(updateLevel);
      } catch (micError) {
        console.warn("Microphone not available, running in demo mode:", micError);
        microphoneAvailable = false;
      }

      connectWebSocket();
      sessionStartRef.current = Date.now();
      setStatus("connected");
      setIsRecording(true);

    } catch (err) {
      console.error("Failed to start recording:", err);
      setError(err instanceof Error ? err.message : "Failed to start recording");
      setStatus("error");
      setIsRecording(false);
    }
  }, [connectWebSocket]);

  const stopRecording = useCallback(() => {
    if (audioTrackRef.current) {
      audioTrackRef.current.stop();
      audioTrackRef.current = null;
    }

    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setStatus("disconnected");
    setIsRecording(false);
    setAudioLevel(0);
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
  };
}
