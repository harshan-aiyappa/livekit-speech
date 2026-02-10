import { useState, useCallback, useRef, useEffect } from "react";
import {
  Room,
  RoomEvent,
  createLocalAudioTrack,
  LocalAudioTrack,
} from "livekit-client";
import type { ConnectionStatus, TranscriptSegment } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

import { useToast } from "@/hooks/use-toast";

interface UseLiveKitReturn {
  status: ConnectionStatus;
  isRecording: boolean;
  segments: TranscriptSegment[];
  audioLevel: number;
  latency: number;
  startRecording: () => void;
  stopRecording: () => void;
  roomName: string | null;
  error: string | null;
  mode: "live" | null;
  isInitializing: boolean;
  language: string;
  setLanguage: (lang: string) => void;
}

export function useLiveKit(): UseLiveKitReturn {
  const { toast } = useToast();
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [isRecording, setIsRecording] = useState(false);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"live" | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [latency, setLatency] = useState<number>(0);
  const [language, _setLanguage] = useState<string>("en");
  const languageRef = useRef("en");

  const roomRef = useRef<Room | null>(null);
  const audioTrackRef = useRef<LocalAudioTrack | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const sessionStartRef = useRef<number>(0);
  const isActiveRef = useRef(true);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Use relative path so it works in production/dev identically
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const WS_URL = `${protocol}//${window.location.host}/ws`;

  const connect = useCallback(async () => {
    if (roomRef.current && roomRef.current.state !== ConnectionState.Disconnected) return;

    try {
      setStatus("connecting");
      setError(null);

      // Fetch Token from Backend
      const uniqueRoomName = `hybrid-room-${Math.floor(Date.now() / 1000).toString(36)}`;
      const response = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_name: uniqueRoomName,
          participant_name: `User-${Math.floor(Math.random() * 1000)}`
        }),
      });
      const tokenResponse = await response.json();
      const { token, livekit_url } = tokenResponse;

      setRoomName(uniqueRoomName);

      // Create and connect to LiveKit room
      const liveKitRoom = new Room({
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      roomRef.current = liveKitRoom;

      let wsUrl = livekit_url || "wss://kimo-zg71lj4i.livekit.cloud";
      wsUrl = wsUrl.replace("https://", "wss://").replace("http://", "ws://");

      console.log("[Hybrid] Connecting to LiveKit at:", wsUrl);
      await liveKitRoom.connect(wsUrl, token, { autoSubscribe: true });
      console.log("✅ [Hybrid] LiveKit room connected");

      // Connect WebSocket for transcription
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("✅ [Hybrid] Transcription WebSocket connected");
        if (isActiveRef.current) {
          setStatus("connected");
          setIsInitializing(false);
        }
      };

      ws.onmessage = (event) => {
        if (!isActiveRef.current) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === "transcript" && data.text) {
            if (data.timestamp) {
              const nowRelative = Date.now() - sessionStartRef.current;
              const currentLatency = nowRelative - data.timestamp;
              setLatency(currentLatency > 0 ? currentLatency : 0);
            }

            const segment: TranscriptSegment = {
              id: data.id || crypto.randomUUID(),
              timestamp: data.timestamp ? (data.timestamp - sessionStartRef.current) : (Date.now() - sessionStartRef.current),
              text: data.text,
              isFinal: data.isFinal ?? true,
              speaker: "User",
              turnaround_ms: data.turnaround_ms
            };

            setSegments((prev) => [...prev.filter(s => s.isFinal), segment]);
          }
        } catch (e) {
          console.error("[Hybrid] WS Parse error:", e);
        }
      };

      ws.onerror = (e) => {
        console.error("[Hybrid] WS error:", e);
        if (isActiveRef.current) setStatus("error");
      };

    } catch (err: any) {
      console.error("[Hybrid] Init failure:", err);
      if (isActiveRef.current) {
        setError(err.message);
        setStatus("error");
        setIsInitializing(false);
      }
    }
  }, [toast]);


  // Start recording (Connect + Init Mic + Start Recorder)
  const startRecording = useCallback(async () => {
    try {
      // 1. Ensure Connected
      if (!roomRef.current || roomRef.current.state !== ConnectionState.Connected) {
        await connect();
        let attempts = 0;
        while ((!roomRef.current || roomRef.current.state !== ConnectionState.Connected) && attempts < 10) {
          await new Promise(r => setTimeout(r, 500));
          attempts++;
        }
        if (roomRef.current?.state !== ConnectionState.Connected) throw new Error("LiveKit connection timeout");
      }

      // 2. Ensure Mic Track
      if (!audioTrackRef.current) {
        console.log("[Hybrid] 🎙️ Initializing hardware...");
        const audioTrack = await createLocalAudioTrack({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        });
        audioTrackRef.current = audioTrack;
        await roomRef.current.localParticipant.publishTrack(audioTrack);

        // Visualizer
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(new MediaStream([audioTrack.mediaStreamTrack]));
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateLevel = () => {
          if (!isActiveRef.current || !audioTrackRef.current) return;
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setAudioLevel(Math.min(1, average / 128));
          requestAnimationFrame(updateLevel);
        };
        updateLevel();
      }

      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        throw new Error("Transcription server unreachable");
      }

      // Notify Backend (Privacy Audit)
      fetch("/api/status/mic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active", mode: "hybrid" })
      }).catch(() => { });

      const mediaStream = new MediaStream([audioTrackRef.current.mediaStreamTrack]);
      const mediaRecorder = new MediaRecorder(mediaStream, { mimeType: "audio/webm;codecs=opus" });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(",")[1];
            wsRef.current?.send(JSON.stringify({
              type: "audio_chunk",
              data: base64,
              timestamp: Date.now() - sessionStartRef.current,
              language: languageRef.current
            }));
          };
          reader.readAsDataURL(event.data);
        }
      };

      mediaRecorder.start(2000);
      sessionStartRef.current = Date.now();
      setSegments([]);
      setIsRecording(true);
      setLatency(0);

    } catch (err: any) {
      console.error("[Hybrid] Start error:", err);
      setError(err.message);
    }
  }, [connect]);

  // Stop recording (Total Destruction Pattern)
  const stopRecording = useCallback(() => {
    console.log("[Hybrid] 🏁 Total shutdown and hardware release...");

    // Notify Backend
    fetch("/api/status/mic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "inactive", mode: "hybrid" })
    }).catch(() => { });

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    if (audioTrackRef.current) {
      audioTrackRef.current.stop();
      audioTrackRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsRecording(false);
    setStatus("idle");
    setAudioLevel(0);
  }, []);

  // Initial mount check
  useEffect(() => {
    isActiveRef.current = true;
    setIsInitializing(false);
    return () => {
      isActiveRef.current = false;
      stopRecording();
    };
  }, [stopRecording]);

  return {
    status,
    isRecording,
    segments,
    audioLevel,
    connect,
    startRecording,
    stopRecording,
    roomName,
    error,
    mode,
    isInitializing,
    latency,
    language,
    setLanguage
  };
}
