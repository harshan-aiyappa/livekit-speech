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
  startRecording: () => void;
  stopRecording: () => void;
  roomName: string | null;
  error: string | null;
  mode: "live" | null;
  isInitializing: boolean;
}

export function useLiveKit(): UseLiveKitReturn {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [isRecording, setIsRecording] = useState(false);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"live" | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const roomRef = useRef<Room | null>(null);
  const audioTrackRef = useRef<LocalAudioTrack | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const sessionStartRef = useRef<number>(0);
  const isActiveRef = useRef(true);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize room and connection on mount (persistent connection)
  useEffect(() => {
    let mounted = true;
    isActiveRef.current = true;

    const initializeSession = async () => {
      try {
        setStatus("connecting");
        setError(null);

        // Generate unique identifiers for the session
        const newRoomName = `room-${crypto.randomUUID().substring(0, 8)}`;
        const participantName = `user-${crypto.randomUUID().substring(0, 8)}`;

        // Get LiveKit token
        const response = await apiRequest("POST", "/api/livekit/token", {
          room_name: newRoomName,
          participant_name: participantName,
        });
        const tokenResponse = await response.json();
        const { token } = tokenResponse;

        if (!mounted) return;
        setRoomName(newRoomName);

        // Create and connect to LiveKit room
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
        console.log("✅ LiveKit room connected (persistent)");

        // Get microphone permission and create audio track
        const audioTrack = await createLocalAudioTrack({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        });

        if (!mounted) {
          audioTrack.stop();
          return;
        }

        audioTrackRef.current = audioTrack;
        await liveKitRoom.localParticipant.publishTrack(audioTrack);
        console.log("✅ Audio track published (ready to record)");

        // Set up audio level monitoring
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
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

        // Connect WebSocket for transcription
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("✅ Transcription WebSocket connected");
          if (!mounted) return;
          setStatus("connected");
          setIsInitializing(false);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log("WebSocket message:", data.type);

            if (data.type === "status") {
              console.log("Server status - Whisper ready:", data.whisper_ready, "Mode:", data.mode);
              setMode("live");
            }

            if (data.type === "transcript" && data.text) {
              console.log("Transcript received:", data);
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
        };

      } catch (err) {
        console.error("Failed to initialize session:", err);
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to connect. Please check microphone permissions.");
        setStatus("error");
        setIsInitializing(false);
      }
    };

    initializeSession();

    // Cleanup on unmount
    return () => {
      mounted = false;
      isActiveRef.current = false;

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }

      if (audioTrackRef.current) {
        audioTrackRef.current.stop();
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
      }

      if (roomRef.current) {
        roomRef.current.disconnect();
      }

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }

      console.log("🧹 Session cleaned up");
    };
  }, []);

  // Start recording (just toggle, no reconnection)
  const startRecording = useCallback(() => {
    if (!audioTrackRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError("Not ready. Please wait for connection.");
      return;
    }

    try {
      const mediaStream = new MediaStream([audioTrackRef.current.mediaStreamTrack]);

      const mediaRecorder = new MediaRecorder(mediaStream, {
        mimeType: "audio/webm;codecs=opus",
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const arrayBuffer = await event.data.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          const binary = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
          const base64 = btoa(binary);
          wsRef.current.send(JSON.stringify({
            type: "audio_chunk",
            data: base64,
            timestamp: Date.now() - sessionStartRef.current,
          }));
          console.log(`📤 Sent audio chunk: ${event.data.size} bytes`);
        }
      };

      // Small delay to ensure everything is ready
      setTimeout(() => {
        if (mediaRecorder.state === "inactive" && isActiveRef.current) {
          mediaRecorder.start(3000);
          console.log("🎙️ Recording started (instant toggle)");
        }
      }, 100);

      sessionStartRef.current = Date.now();
      setSegments([]); // Clear previous transcripts
      setIsRecording(true);
      setError(null);

    } catch (err) {
      console.error("Failed to start recording:", err);
      setError(err instanceof Error ? err.message : "Failed to start recording");
    }
  }, []);

  // Stop recording (just pause, keep connection alive)
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      console.log("⏸️ Recording stopped (connection still alive)");
    }

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
    mode,
    isInitializing,
  };
}
