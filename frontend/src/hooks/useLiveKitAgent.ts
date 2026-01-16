
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
    const isMountedRef = useRef(true);

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
    const sessionStartRef = useRef<number>(0);

    // Cleanup on unmount - Ensure everything is killed
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            console.log("[Agent] 🧹 Unmounting component - cleanup started");

            // 1. Mark connecting as false to abort pending operations
            isConnectingRef.current = false;

            // 2. Stop Local Track (Microphone) DIRECTLY
            if (localTrackRef.current) {
                console.log("[Agent] 🛑 Stopping local microphone track");
                localTrackRef.current.stop();
                localTrackRef.current = null;
            }

            // 3. Disconnect Room
            if (room && room.state !== ConnectionState.Disconnected) {
                console.log("[Agent] 🔌 Disconnecting LiveKit room");
                room.disconnect();
            }
        };
    }, [room]);

    // Room Event Listeners
    useEffect(() => {
        if (!room) return;

        const handleData = (payload: Uint8Array, participant?: RemoteParticipant, kind?: DataPacket_Kind, topic?: string) => {
            if (!isMountedRef.current) return;
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
                        timestamp: data.timestamp || (Date.now() - sessionStartRef.current),
                        text: data.text,
                        isFinal: true,
                        speaker: "Agent",
                        turnaround_ms: data.turnaround_ms
                    };

                    setSegments(prev => [...prev, segment]);
                }
            } catch (e) {
                console.error("Failed to parse data packet:", e);
            }
        };

        const handleDisconnect = () => {
            if (!isMountedRef.current) return;
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
            // Fix: Create MediaStream from the track
            const mediaStream = new MediaStream([localTrackRef.current.mediaStreamTrack]);

            const audioContext = new AudioContext(); // Note: Should probably be managed globally to avoid limit
            const source = audioContext.createMediaStreamSource(mediaStream);

            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            interval = setInterval(() => {
                if (!isMountedRef.current) return;
                analyser.getByteFrequencyData(dataArray);
                const sum = dataArray.reduce((acc, val) => acc + val, 0);
                const avg = sum / dataArray.length;
                setAudioLevel(Math.min(1, avg / 128)); // Normalize roughly
            }, 50);

            // Clean up AudioContext on unmount/stop
            return () => {
                clearInterval(interval);
                audioContext.close();
            }
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
            if (isMountedRef.current) setStatus("connecting");

            const participantName = "user-" + Math.floor(Math.random() * 1000);
            const uniqueRoomName = `agent-room-${Math.floor(Date.now() / 1000).toString(36)}`;
            if (isMountedRef.current) setRoomName(uniqueRoomName);

            // Fetch Token
            const response = await fetch("/api/livekit/token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ room_name: uniqueRoomName, participant_name: participantName }),
            });
            const data = await response.json();

            if (!data.token) throw new Error("No token received");
            if (!isMountedRef.current) return; // EXIT if unmounted

            console.log("[Agent] Signal URL:", data.livekit_url);
            // Connect to Room
            await room.connect(data.livekit_url, data.token);
            console.log("[Agent] ✅ Room connected:", uniqueRoomName);

            if (!isMountedRef.current) { room.disconnect(); return; }

            // Pre-publish track (muted) for instant start/stop
            if (!localTrackRef.current) {
                console.log("[Agent] 🎙️ Creating mic track...");
                const track = await createLocalAudioTrack({
                    noiseSuppression: true,
                    echoCancellation: true,
                    autoGainControl: true,
                });

                // CRITICAL CHECK: If component unmounted while creating track
                if (!isMountedRef.current) {
                    console.log("[Agent] 🛑 Component unmounted, stopping newly created track");
                    track.stop();
                    return;
                }

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

            if (isMountedRef.current) {
                setStatus("connected");
                setError(null);
            }

        } catch (err: any) {
            console.error("[Agent] Connection error:", err);
            if (isMountedRef.current) {
                setError(err.message);
                setStatus("error");
                toast({ title: "Connection Failed", description: err.message, variant: "destructive" });
            }
        } finally {
            isConnectingRef.current = false;
        }
    }, [room, toast]);

    // 2. Start Recording = Unmute Track
    const startRecording = useCallback(async () => {
        if (!localTrackRef.current) return;
        try {
            console.log("[Agent] 🚀 Starting capture (unmuting)...");
            sessionStartRef.current = Date.now();
            await localTrackRef.current.unmute();

            // Send config again to ensure agent has correct language
            const configPayload = JSON.stringify({ type: "config", language });
            await room.localParticipant.publishData(
                new TextEncoder().encode(configPayload),
                { reliable: true, topic: "config" }
            );

            if (isMountedRef.current) setIsRecording(true);
            console.log("[Agent] 🎤 Capture active (Language:", language, ")");
        } catch (err: any) {
            console.error("[Agent] Failed to unmute:", err);
            if (isMountedRef.current) toast({ title: "Mic Error", description: "Could not activate microphone", variant: "destructive" });
        }
    }, [toast, language]);

    // 3. Stop Recording = Mute Track
    const stopRecording = useCallback(async () => {
        if (!localTrackRef.current) return;
        try {
            console.log("[Agent] ⏸️ Stopping capture (muting)...");
            await localTrackRef.current.mute();
            if (isMountedRef.current) {
                setIsRecording(false);
                setAudioLevel(0);
            }
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
