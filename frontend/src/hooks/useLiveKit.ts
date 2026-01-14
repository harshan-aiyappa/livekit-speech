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
  mode: "live" | null;
}

export function useLiveKit(): UseLiveKitReturn {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [isRecording, setIsRecording] = useState(false);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"live" | null>(null);

  const roomRef = useRef<Room | null>(null);
  const audioTrackRef = useRef<LocalAudioTrack | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const sessionStartRef = useRef<number>(0);
  const isActiveRef = useRef(false);

  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
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

      // Generate unique identifiers for the session
      const roomName = `room-${crypto.randomUUID().substring(0, 8)}`;
      const participantName = `user-${crypto.randomUUID().substring(0, 8)}`;

      const response = await apiRequest("POST", "/api/livekit/token", {
        room_name: roomName,
        participant_name: participantName,
      });
      const tokenResponse = await response.json();
      const { token } = tokenResponse;
      setRoomName(roomName);

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

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("Transcription WebSocket connected");

        const mediaRecorder = new MediaRecorder(mediaStream, {
          mimeType: "audio/webm;codecs=opus",
        });
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = async (event) => {
          if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            const arrayBuffer = await event.data.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            const binary = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
            const base64 = btoa(binary);
            ws.send(JSON.stringify({
              type: "audio_chunk",
              data: base64,
              timestamp: Date.now() - sessionStartRef.current,
            }));
            console.log(`Sent audio chunk: ${event.data.size} bytes`);
          }
        };

        mediaRecorder.start(3000);
        console.log("MediaRecorder started - sending audio every 3 seconds");
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
            console.log("Transcript received:", data); // Debug log
            const segment: TranscriptSegment = {
              id: data.id || crypto.randomUUID(),
              timestamp: data.timestamp || Date.now() - sessionStartRef.current,
              text: data.text,
              confidence: data.confidence,
              speaker: data.speaker,
              isFinal: data.isFinal ?? true,
            };

            console.log("Segment created:", segment); // Debug log

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
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
      };

      sessionStartRef.current = Date.now();
      setMode("live");
      setStatus("connected");
      setIsRecording(true);

    } catch (err) {
      console.error("Failed to start recording:", err);
      setError(err instanceof Error ? err.message : "Failed to start recording. Please allow microphone access.");
      setStatus("error");
      setIsRecording(false);
      isActiveRef.current = false;
    }
  }, []);

  const stopRecording = useCallback(() => {
    isActiveRef.current = false;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    if (audioTrackRef.current) {
      audioTrackRef.current.stop();
      audioTrackRef.current = null;
    }

    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }

    // Give the socket a moment to receive final messages
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Don't close immediately - let pending messages arrive
      setTimeout(() => {
        if (wsRef.current) {
          wsRef.current.close(1000, "User stopped recording");
          wsRef.current = null;
        }
      }, 1000); // Wait 1 second
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
