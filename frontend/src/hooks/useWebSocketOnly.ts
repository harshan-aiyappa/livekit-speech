
import { useState, useRef, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { TranscriptSegment } from "@/shared/schema";

export function useWebSocketOnly() {
    const { toast } = useToast();
    const isMountedRef = useRef(true);

    const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "disconnected" | "error">("idle");
    const [isModelReady, setIsModelReady] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [segments, setSegments] = useState<TranscriptSegment[]>([]);
    const [audioLevel, setAudioLevel] = useState(0);
    const [latency, setLatency] = useState<number>(0);
    const [language, _setLanguage] = useState<string>("en");
    const languageRef = useRef("en");

    const setLanguage = useCallback((lang: string) => {
        _setLanguage(lang);
        languageRef.current = lang;
    }, []);

    const socketRef = useRef<WebSocket | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const analyzerRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number>();
    const sessionStartRef = useRef<number>(0);

    // Use the same backend WS endpoint, but without Livekit room coordination
    // Use relative path so it works in production/dev identically
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const WS_URL = `${protocol}//${window.location.host}/ws`;

    const connect = useCallback(async () => {
        if (socketRef.current && socketRef.current.readyState !== WebSocket.CLOSED) return;

        try {
            if (isMountedRef.current) setStatus("connecting");
            const ws = new WebSocket(WS_URL);
            socketRef.current = ws;

            ws.onopen = async () => {
                if (isMountedRef.current) {
                    setStatus("connected");
                    toast({ title: "Connected", description: "Direct WebSocket connection established." });
                }
            };

            ws.onmessage = (event) => {
                if (!isMountedRef.current) return;
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === "status" && data.whisper_ready) {
                        setIsModelReady(true);
                    }

                    if (data.type === "transcript" && data.text) {
                        if (data.timestamp) {
                            const diff = Date.now() - data.timestamp;
                            setLatency(diff > 0 ? diff : 0);
                        }

                        const segment: TranscriptSegment = {
                            id: data.id || crypto.randomUUID(),
                            timestamp: data.timestamp ? (data.timestamp - sessionStartRef.current) : (Date.now() - sessionStartRef.current),
                            text: data.text,
                            isFinal: true,
                            speaker: "User",
                            turnaround_ms: data.turnaround_ms
                        };
                        setSegments(prev => [...prev, segment]);
                    }
                } catch (e) {
                    console.error("[Direct] Parse error", e);
                }
            };

            ws.onclose = () => {
                if (isMountedRef.current) setStatus("disconnected");
            };

            ws.onerror = (e) => {
                console.error("[Direct] WS Error", e);
                if (isMountedRef.current) setStatus("error");
            };

        } catch (e) {
            console.error("[Direct] Connection failed", e);
            if (isMountedRef.current) setStatus("error");
        }
    }, [WS_URL, toast]);

    const startRecording = useCallback(async () => {
        try {
            // 1. Ensure WS Connected
            if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
                await connect();
                let attempts = 0;
                while ((!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) && attempts < 10) {
                    await new Promise(r => setTimeout(r, 500));
                    attempts++;
                }
                if (socketRef.current?.readyState !== WebSocket.OPEN) throw new Error("Server connection timed out");
            }

            // 2. Init Mic On-Demand (Privacy)
            if (!streamRef.current) {
                console.log("[Direct] 🎙️ Initializing hardware...");
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                streamRef.current = stream;

                // Setup Visualizer
                const audioContext = new AudioContext();
                const source = audioContext.createMediaStreamSource(stream);
                const analyzer = audioContext.createAnalyser();
                analyzer.fftSize = 256;
                source.connect(analyzer);
                analyzerRef.current = analyzer;

                const updateLevel = () => {
                    if (!isMountedRef.current || !streamRef.current) return;
                    const dataArray = new Uint8Array(analyzer.frequencyBinCount);
                    analyzer.getByteFrequencyData(dataArray);
                    const avg = dataArray.reduce((p, c) => p + c, 0) / dataArray.length;
                    setAudioLevel(Math.min(1, avg / 128));
                    animationFrameRef.current = requestAnimationFrame(updateLevel);
                };
                updateLevel();
                console.log("[Direct] ✅ Mic hardware active");
            }

            console.log("[Direct] 🚀 Starting capture...");
            sessionStartRef.current = Date.now();

            // Notify Backend
            fetch("/api/status/mic", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "active", mode: "websocket" })
            }).catch(() => { });

            const recorder = new MediaRecorder(streamRef.current, { mimeType: "audio/webm;codecs=opus" });
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0 && socketRef.current?.readyState === WebSocket.OPEN) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64 = (reader.result as string).split(",")[1];
                        socketRef.current?.send(JSON.stringify({
                            type: "audio_chunk",
                            data: base64,
                            timestamp: Date.now(),
                            language: languageRef.current
                        }));
                    };
                    reader.readAsDataURL(event.data);
                }
            };

            recorder.start(500);
            setIsRecording(true);
            setLatency(0);

        } catch (err: any) {
            console.error("[Direct] Start error:", err);
            toast({ title: "Error", description: err.message || "Failed to start recording.", variant: "destructive" });
        }
    }, [connect, toast]);

    const stopRecording = useCallback(() => {
        console.log("[Direct] 🛑 Total shutdown and hardware release...");

        // Notify Backend
        fetch("/api/status/mic", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "inactive", mode: "websocket" })
        }).catch(() => { });

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current = null;
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }

        if (socketRef.current) {
            socketRef.current.close();
            socketRef.current = null;
        }

        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = undefined;
        }

        setIsRecording(false);
        setStatus("idle");
        setAudioLevel(0);
    }, []);

    // Cleanup
    useEffect(() => {
        isMountedRef.current = true;
        // Don't auto-connect here anymore to favor explicit connection
        return () => {
            isMountedRef.current = false;
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
        latency, // Export new state
        isModelReady,
        language,
        setLanguage
    };
}
