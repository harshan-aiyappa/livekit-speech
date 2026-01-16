
import { useState, useRef, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { TranscriptSegment } from "@/shared/schema";

export function useWebSocketOnly() {
    const { toast } = useToast();
    const isMountedRef = useRef(true);

    const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "disconnected" | "error">("idle");
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

    // Use the same backend WS endpoint, but without Livekit room coordination
    // Use relative path so it works in production/dev identically
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const WS_URL = `${protocol}//${window.location.host}/ws`;

    const connect = useCallback(() => {
        try {
            if (isMountedRef.current) setStatus("connecting");
            const ws = new WebSocket(WS_URL);

            ws.onopen = () => {
                if (isMountedRef.current) {
                    setStatus("connected");
                    toast({ title: "Connected", description: "Direct WebSocket connection established." });
                } else {
                    ws.close();
                }
            };

            ws.onmessage = (event) => {
                if (!isMountedRef.current) return;
                try {
                    const data = JSON.parse(event.data);

                    if (data.type === "transcript" && data.text) {
                        // Calculate Latency
                        if (data.timestamp) {
                            const now = Date.now();
                            const diff = now - data.timestamp;
                            setLatency(diff > 0 ? diff : 0);
                        }

                        const segment: TranscriptSegment = {
                            id: data.id || crypto.randomUUID(),
                            timestamp: Date.now(),
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
                if (isMountedRef.current) {
                    setStatus("error");
                    toast({ title: "Connection Error", description: "Is the backend running?", variant: "destructive" });
                }
            };

            socketRef.current = ws;

        } catch (e) {
            if (isMountedRef.current) setStatus("error");
        }
    }, [toast]);

    const startRecording = useCallback(async () => {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
            toast({ title: "Not Connected", description: "Waiting for server connection...", variant: "destructive" });
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // CRITICAL CHECK: If component unmounted while waiting for permission/device
            if (!isMountedRef.current) {
                console.log("[Direct] Component unmounted, stopping new stream immediately.");
                stream.getTracks().forEach(t => t.stop());
                return;
            }

            streamRef.current = stream;

            // Audio Level Logic
            const audioContext = new AudioContext(); // Should be cleaned up but context per connection is okayish
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
                setAudioLevel(avg / 128);
                animationFrameRef.current = requestAnimationFrame(updateLevel);
            };
            updateLevel();

            // Recorder Logic
            const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
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
            if (isMountedRef.current) {
                toast({ title: "Microphone Error", description: "Access denied or not found.", variant: "destructive" });
            }
        }
    }, [toast]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        if (isMountedRef.current) {
            setIsRecording(false);
            setAudioLevel(0);
        }
    }, []);

    // Disconnect on unmount
    useEffect(() => {
        isMountedRef.current = true;
        // Connect on mount
        connect();

        return () => {
            isMountedRef.current = false;
            console.log("[Direct] 🧹 Unmounting - Cleanup");

            // Cleanup Socket
            socketRef.current?.close();

            // Cleanup Recorder & Stream
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
                mediaRecorderRef.current.stop();
            }
            if (streamRef.current) {
                console.log("[Direct] 🛑 Stopping Microphone Tracks");
                streamRef.current.getTracks().forEach(track => {
                    track.stop();
                    console.log(`[Direct] Track ${track.label} stopped`);
                });
                streamRef.current = null;
            }
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
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
        language,
        setLanguage
    };
}
