
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
        try {
            if (isMountedRef.current) setStatus("connecting");
            const ws = new WebSocket(WS_URL);

            ws.onopen = async () => {
                if (isMountedRef.current) {
                    setStatus("connected");
                    toast({ title: "Connected", description: "Direct WebSocket connection established." });

                    // -------------------------------------------------------
                    // MICROPHONE SETUP: Init & Mute (Standby)
                    // -------------------------------------------------------
                    if (!streamRef.current) {
                        try {
                            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

                            if (!isMountedRef.current) {
                                stream.getTracks().forEach(t => t.stop());
                                return;
                            }

                            // 1. Mic Active for Visualizer (Data Gated via MediaRecorder)
                            streamRef.current = stream;
                            console.log("[Direct] Mic initialized (Active / Standby)");

                            // 2. Setup Visualizer (Input is silent when disabled)
                            const audioContext = new AudioContext();
                            const source = audioContext.createMediaStreamSource(stream);
                            const analyzer = audioContext.createAnalyser();
                            analyzer.fftSize = 256;
                            source.connect(analyzer);
                            analyzerRef.current = analyzer;

                            const updateLevel = () => {
                                if (!isMountedRef.current) return;
                                const dataArray = new Uint8Array(analyzer.frequencyBinCount);
                                analyzer.getByteFrequencyData(dataArray);
                                const avg = dataArray.reduce((p, c) => p + c, 0) / dataArray.length;
                                setAudioLevel(Math.min(1, avg / 128));
                                animationFrameRef.current = requestAnimationFrame(updateLevel);
                            };
                            updateLevel();

                        } catch (e) {
                            console.error("[Direct] Failed to get mic:", e);
                            toast({ title: "Mic Error", description: "Could not access microphone.", variant: "destructive" });
                        }
                    }
                } else {
                    ws.close();
                }
            };

            ws.onmessage = (event) => {
                if (!isMountedRef.current) return;
                try {
                    const data = JSON.parse(event.data);

                    if (data.type === "status") {
                        if (data.whisper_ready) {
                            setIsModelReady(true);
                        }
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
                    console.error("Parse error", e);
                }
            };

            ws.onclose = () => {
                if (isMountedRef.current) setStatus("disconnected");
            };

            ws.onerror = (e) => {
                console.error("WS Error", e);
                if (isMountedRef.current) setStatus("error");
            };

            socketRef.current = ws;

        } catch (e) {
            if (isMountedRef.current) setStatus("error");
        }
    }, [toast, WS_URL]);

    const startRecording = useCallback(async () => {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
            toast({ title: "Not Connected", description: "Waiting for server connection...", variant: "destructive" });
            return;
        }

        if (!streamRef.current) {
            toast({ title: "Not Ready", description: "Microphone initializing...", variant: "destructive" });
            return;
        }

        try {
            console.log("[Direct] 🚀 Starting capture...");
            sessionStartRef.current = Date.now();

            // Notify Backend
            fetch("/api/status/mic", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "active", mode: "websocket" })
            }).catch(() => { });

            // 1. Start Recorder
            // Note: MediaRecorder might need to be re-created if stopped
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
                        console.log(`[Direct] 📤 Sent audio chunk: ${event.data.size} bytes`);
                    };
                    reader.readAsDataURL(event.data);
                }
            };

            recorder.start(500); // 500ms chunks
            setIsRecording(true);
            setLatency(0);

        } catch (e) {
            console.error("Mic Error", e);
            toast({ title: "Error", description: "Failed to start recording.", variant: "destructive" });
        }
    }, [toast]);

    const stopRecording = useCallback(() => {
        console.log("[Direct] ⏸️ Stopping capture...");

        // Notify Backend
        fetch("/api/status/mic", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "inactive", mode: "websocket" })
        }).catch(() => { });

        // Stop Recorder (Stop sending chunks)
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
        }

        if (isMountedRef.current) {
            setIsRecording(false);
            setAudioLevel(0);
        }
    }, []);

    // Cleanup
    useEffect(() => {
        isMountedRef.current = true;
        const startTime = Date.now();
        connect();
        return () => {
            isMountedRef.current = false;
            console.log("[Direct] 🧹 Cleaning up...");

            // Log Duration
            const duration = (Date.now() - startTime) / 1000;
            fetch("/api/status/mic", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "disconnected", mode: "websocket_mode", duration })
            }).catch(() => { });

            // Close Socket
            socketRef.current?.close();

            // Stop Recorder
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
                mediaRecorderRef.current.stop();
            }

            // FULL STOP Microphone (Release Hardware)
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
                streamRef.current = null;
                console.log("[Direct] 🛑 Microphone hardware released");
            }

            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [connect]);

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
