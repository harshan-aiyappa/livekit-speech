
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
    const [isTrackReady, setIsTrackReady] = useState(false);

    // Cleanup on unmount - Ensure everything is killed
    useEffect(() => {
        isMountedRef.current = true;
        const startTime = Date.now(); // Track Session Start

        return () => {
            isMountedRef.current = false;
            console.log("[Agent] 🧹 Unmounting component - cleanup started");

            // Log Duration
            const duration = (Date.now() - startTime) / 1000;
            fetch("/api/status/mic", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "disconnected", mode: "agent_mode", duration })
            }).catch(() => { });

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
                        // Fix Timestamp: Use relative time from session start
                        timestamp: data.timestamp ? (data.timestamp - sessionStartRef.current) : (Date.now() - sessionStartRef.current),
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
            // Ensure connection is closed on unmount
            room.disconnect();
            if (localTrackRef.current) {
                localTrackRef.current.stop();
                localTrackRef.current = null;
            }
        };
    }, [room]);

    // Audio Level Monitoring (Local)
    // Audio Level Monitoring (Local) - Visualizer
    useEffect(() => {
        if (!localTrackRef.current) return;

        // Setup Audio Context for Visualizer
        const audioContext = new AudioContext();
        const mediaStream = new MediaStream([localTrackRef.current.mediaStreamTrack]);
        const source = audioContext.createMediaStreamSource(mediaStream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let animationFrameId: number;

        const updateLevel = () => {
            if (!isMountedRef.current) return;
            analyser.getByteFrequencyData(dataArray);
            const sum = dataArray.reduce((acc, val) => acc + val, 0);
            const avg = sum / dataArray.length;
            // Normalize: 0-255 -> 0-1. Standard sensitivity boost (avg / 128)
            setAudioLevel(Math.min(1, avg / 128));

            animationFrameId = requestAnimationFrame(updateLevel);
        };

        // Start loop
        updateLevel();

        return () => {
            cancelAnimationFrame(animationFrameId);
            audioContext.close();
        };
    }, [isTrackReady]); // Re-run when track is ready


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

                // Keep Unmuted for Visualizer, but Don't Publish yet (Privacy)
                localTrackRef.current = track;
                setIsTrackReady(true); // Trigger visualizer effect

                console.log("[Agent] ✅ Mic ready (Unpublished / Standby)");
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

                // Analytics: Track Mode Entry
                fetch("/api/status/mic", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "connected", mode: "agent_mode_joined" })
                }).catch(() => { });
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

    // 2. Start Recording = Publish Track
    const startRecording = useCallback(async () => {
        if (!localTrackRef.current) return;
        try {
            console.log("[Agent] 🚀 Starting capture (Publishing)...");

            // Notify Backend (Privacy Audit)
            fetch("/api/status/mic", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "active", mode: "agent" })
            }).catch(() => console.warn("Failed to log mic status"));

            sessionStartRef.current = Date.now();
            await room.localParticipant.publishTrack(localTrackRef.current);

            // Send config again to ensure agent has correct language
            const configPayload = JSON.stringify({ type: "config", language });
            await room.localParticipant.publishData(
                new TextEncoder().encode(configPayload),
                { reliable: true, topic: "config" }
            );

            if (isMountedRef.current) setIsRecording(true);
            console.log("[Agent] 🎤 Capture active (Language:", language, ")");
        } catch (err: any) {
            console.error("[Agent] Failed to publish:", err);
            if (isMountedRef.current) toast({ title: "Mic Error", description: "Could not activate microphone", variant: "destructive" });
        }
    }, [toast, language, room]);

    // 3. Stop Recording = Unpublish Track
    const stopRecording = useCallback(async () => {
        if (!localTrackRef.current) return;
        try {
            console.log("[Agent] ⏸️ Stopping capture (Unpublishing)...");

            // Notify Backend (Privacy Audit)
            fetch("/api/status/mic", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "inactive", mode: "agent" })
            }).catch(() => console.warn("Failed to log mic status"));

            await room.localParticipant.unpublishTrack(localTrackRef.current);

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
