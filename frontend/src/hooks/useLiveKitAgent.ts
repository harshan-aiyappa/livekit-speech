import { useState, useEffect, useRef, useCallback } from "react";
import {
    Room,
    RoomEvent,
    RemoteParticipant,
    LocalAudioTrack,
    createLocalAudioTrack,
    DataPacket_Kind,
    ConnectionState
} from "livekit-client";
import { useToast } from "@/hooks/use-toast";
import { TranscriptSegment } from "@/shared/schema";

// LiveKit Agent Hook
export function useLiveKitAgent() {
    const { toast } = useToast();

    // Stable Room Instance
    const [room] = useState(() => new Room({
        adaptiveStream: true,
        dynacast: true,
    }));

    const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "disconnected" | "error">("idle");
    const [isRecording, setIsRecording] = useState(false);
    const [audioLevel, setAudioLevel] = useState(0);
    const [segments, setSegments] = useState<TranscriptSegment[]>([]);
    const [roomName, setRoomName] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [latency, setLatency] = useState<number>(0);
    const [language, setLanguage] = useState<string>("en");

    const localTrackRef = useRef<LocalAudioTrack | null>(null);
    const isConnectingRef = useRef(false);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            console.log("[Agent] 🧹 Disconnecting room");
            isConnectingRef.current = false;
            room.disconnect();
            if (localTrackRef.current) {
                localTrackRef.current.stop();
            }
        };
    }, [room]);

    // Room Event Listeners
    useEffect(() => {
        if (!room) return;

        const handleData = (payload: Uint8Array, participant: RemoteParticipant | undefined, kind: DataPacket_Kind, topic?: string) => {
            const strData = new TextDecoder().decode(payload);
            try {
                const data = JSON.parse(strData);
                if (data.type === "transcript") {
                    console.log("[Agent] 📥 Received transcript:", data.text);
                    // Calculate Latency (Note: This is Server->Client latency + Clock Skew if remote)
                    if (data.timestamp) {
                        const now = Date.now();
                        const diff = now - data.timestamp;
                        setLatency(diff > 0 ? diff : 0);
                    }

                    const segment: TranscriptSegment = {
                        id: data.id || crypto.randomUUID(),
                        timestamp: data.timestamp || Date.now(),
                        text: data.text,
                        isFinal: true,
                        speaker: "Agent"
                    };

                    setSegments(prev => [...prev, segment]);
                }
            } catch (e) {
                console.error("Failed to parse data packet:", e);
            }
        };

        const handleDisconnect = () => {
            console.log("[Agent] 🔌 Disconnected");
            setStatus("disconnected");
            setIsRecording(false);
            setLatency(0);

            // Auto-reconnect logic could go here
        };

        room.on(RoomEvent.DataReceived, handleData);
        room.on(RoomEvent.Disconnected, handleDisconnect);

        return () => {
            room.off(RoomEvent.DataReceived, handleData);
            room.off(RoomEvent.Disconnected, handleDisconnect);
        };
    }, [room]);

    // Audio Level Monitoring (Local)
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isRecording && localTrackRef.current) {
            // Simple internal monitoring or setup AudioContext
            // For simplicity, we can mock or use a separate analyser
            // LiveKit tracks have .mediaStreamTrack

            // Let's attach an analyser to the local track
            // Fix: Create MediaStream from the track
            const mediaStream = new MediaStream([localTrackRef.current.mediaStreamTrack]);

            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(mediaStream);

            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            interval = setInterval(() => {
                analyser.getByteFrequencyData(dataArray);
                const sum = dataArray.reduce((acc, val) => acc + val, 0);
                const avg = sum / dataArray.length;
                setAudioLevel(Math.min(1, avg / 128)); // Normalize roughly
            }, 50);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isRecording]);


    // 1. Get Token & Connect & Publish (Ready state)
    const connect = useCallback(async () => {
        if (isConnectingRef.current || room.state !== ConnectionState.Disconnected) {
            console.log("[Agent] Skip connect: Already connecting or connected");
            return;
        }

        try {
            isConnectingRef.current = true;
            setStatus("connecting");
            const participantName = "user-" + Math.floor(Math.random() * 1000);
            const uniqueRoomName = `agent-room-${Math.floor(Date.now() / 1000).toString(36)}`;
            setRoomName(uniqueRoomName);

            // Fetch Token
            const response = await fetch("/api/livekit/token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ room_name: uniqueRoomName, participant_name: participantName }),
            });
            const data = await response.json();

            if (!data.token) throw new Error("No token received");

            console.log("[Agent] Signal URL:", data.livekit_url);
            // Connect to Room
            await room.connect(data.livekit_url, data.token);
            console.log("[Agent] ✅ Room connected:", uniqueRoomName);

            // Pre-publish track (muted) for instant start/stop
            if (!localTrackRef.current) {
                console.log("[Agent] 🎙️ Creating mic track...");
                const track = await createLocalAudioTrack({
                    noiseSuppression: true,
                    echoCancellation: true,
                    autoGainControl: true,
                });
                // Start muted
                await track.mute();
                localTrackRef.current = track;

                console.log("[Agent] 📤 Publishing track (muted)...");
                await room.localParticipant.publishTrack(track);
                console.log("[Agent] ✅ Mic ready (waiting for toggle)");
            }

            // Send initial config
            const configPayload = JSON.stringify({ type: "config", language: "en" });
            await room.localParticipant.publishData(
                new TextEncoder().encode(configPayload),
                { reliable: true, topic: "config" }
            );

            setStatus("connected");
            setError(null);

        } catch (err: any) {
            console.error("[Agent] Connection error:", err);
            setError(err.message);
            setStatus("error");
            toast({ title: "Connection Failed", description: err.message, variant: "destructive" });
        } finally {
            isConnectingRef.current = false;
        }
    }, [room, toast]);

    // 2. Start Recording = Unmute Track
    const startRecording = useCallback(async () => {
        if (!localTrackRef.current) return;
        try {
            console.log("[Agent] 🚀 Starting capture (unmuting)...");
            await localTrackRef.current.unmute();

            // Send config again to ensure agent has correct language
            const configPayload = JSON.stringify({ type: "config", language });
            await room.localParticipant.publishData(
                new TextEncoder().encode(configPayload),
                { reliable: true, topic: "config" }
            );

            setIsRecording(true);
            console.log("[Agent] 🎤 Capture active (Language:", language, ")");
        } catch (err: any) {
            console.error("[Agent] Failed to unmute:", err);
            toast({ title: "Mic Error", description: "Could not activate microphone", variant: "destructive" });
        }
    }, [toast]);

    // 3. Stop Recording = Mute Track
    const stopRecording = useCallback(async () => {
        if (!localTrackRef.current) return;
        try {
            console.log("[Agent] ⏸️ Stopping capture (muting)...");
            await localTrackRef.current.mute();
            setIsRecording(false);
            setAudioLevel(0);
        } catch (err) {
            console.error("[Agent] Failed to mute:", err);
        }
    }, []);


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
        latency,
        language,
        setLanguage
    };
}
