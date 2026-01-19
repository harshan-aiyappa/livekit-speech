
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { AlertCircle, Zap, ArrowLeft, Wifi, Mic, Server, Activity, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RecordButton } from "@/components/RecordButton";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import { SessionTimer } from "@/components/SessionTimer";
import { TranscriptDisplay } from "@/components/TranscriptDisplay";
import { useWebSocketOnly } from "@/hooks/useWebSocketOnly";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useToast } from "@/hooks/use-toast";
import { PageLayout } from "@/components/layout/PageLayout";
import { SystemCheckModal, SystemCheckStep } from "@/components/SystemCheckModal";

// StatusBadge Removed (Dead Code)

export default function WebSocketMode() {
    const [_, setLocation] = useLocation();
    const { toast } = useToast();
    const {
        status,
        isModelReady,
        isRecording,
        segments,
        audioLevel,
        connect,
        startRecording,
        stopRecording,
        latency,
        language,
        setLanguage,
    } = useWebSocketOnly();

    const [sessionStart, setSessionStart] = useState<number | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(true);
    const [micStatus, setMicStatus] = useState<"idle" | "running" | "success" | "error">("idle");

    // Check Mic Permission on Mount
    useEffect(() => {
        if (isModalOpen && micStatus === "idle") {
            setMicStatus("running");
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then((stream) => {
                    setMicStatus("success");
                    // Stop tracks immediately after check
                    stream.getTracks().forEach(t => t.stop());
                })
                .catch((err) => {
                    console.error("Mic check failed", err);
                    setMicStatus("error");
                    toast({ title: "Microphone Access Denied", description: "Please allow microphone access to proceed.", variant: "destructive" });
                });
        }
    }, [isModalOpen, micStatus, toast]);

    // Construct Check Steps
    const checkSteps: SystemCheckStep[] = [
        {
            id: "ws-connect",
            label: "Server Connection",
            description: "Establishing standard WebSocket link...",
            status: status === "connected" ? "success" : status === "error" ? "error" : "running",
            icon: <Wifi className="h-4 w-4" />
        },
        {
            id: "mic-check",
            label: "Microphone Access",
            description: "Verifying input device permissions...",
            status: micStatus,
            icon: <Mic className="h-4 w-4" />
        },
        {
            id: "backend-api",
            label: "Backend Service",
            description: "Handshaking with server...",
            status: status === "connected" ? "success" : "running",
            icon: <Server className="h-4 w-4" />
        },
        {
            id: "ai-model",
            label: "AI Neural Engine",
            description: isModelReady ? "Whisper Model Active" : "Warming up tensors...",
            status: isModelReady ? "success" : "running",
            icon: <Zap className="h-4 w-4" />
        }
    ];

    const handleToggleRecording = () => {
        if (isRecording) {
            stopRecording();
            setSessionStart(null);
        } else {
            setSessionStart(Date.now());
            startRecording();
        }
    };

    const wsStatus = status === "connected" ? "ok" : status === "connecting" ? "loading" : "error";

    // Compact Top Status Bar
    const TopStatusBar = () => (
        <div className="hidden md:flex items-center gap-3 mr-4">
            {/* Architecture */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                <Zap className="h-3.5 w-3.5 text-green-500" />
                <span className="text-xs font-medium text-muted-foreground">Direct WS</span>
            </div>

            {/* TAT / Latency */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                <Activity className="h-3.5 w-3.5 text-orange-500" />
                <span className="text-xs font-mono font-medium">
                    {latency > 0 ? `${(latency / 1000).toFixed(2)}s` : "0.00s"}
                </span>
            </div>

            {/* Connection Status */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${status === 'connected'
                ? "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400"
                : status === 'connecting'
                    ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                    : "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-muted-foreground"
                }`}>
                <div className={`h-1.5 w-1.5 rounded-full ${status === 'connected' ? "bg-green-500" : status === 'connecting' ? "bg-yellow-500" : "bg-zinc-400"
                    }`} />
                <span className="text-xs font-medium capitalize">{status === 'connected' ? 'Online' : status}</span>
            </div>
        </div>
    );

    const headerActions = (
        <div className="flex items-center">
            <TopStatusBar />
        </div>
    );

    return (
        <PageLayout
            title="Direct Mode"
            subtitle="Pure WebSocket (No LiveKit)"
            actions={headerActions}
            backLink="/"
        >
            {/* System Verification Onboarding */}
            <SystemCheckModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onExit={() => setLocation("/")}
                steps={checkSteps}
                title="System Verification"
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* Left Panel: Controls */}
                <div className="lg:col-span-4 flex flex-col gap-6">

                    <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm ring-1 ring-border/50">
                        <CardHeader>
                            <CardTitle>Control Center</CardTitle>
                            <CardDescription>Direct WebSocket Stream</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center gap-6 py-6">
                            <LanguageSelector value={language} onChange={setLanguage} disabled={isRecording} />

                            <div className="relative">
                                <div className={`absolute -inset-4 rounded-full bg-zinc-500/20 opacity-20 blur-xl transition-opacity duration-500 pointer-events-none ${isRecording ? 'opacity-100' : 'opacity-0'}`}></div>
                                <RecordButton
                                    isRecording={isRecording}
                                    isConnecting={status === "connecting"}
                                    onClick={handleToggleRecording}
                                />
                            </div>
                            <div className="w-full space-y-4">
                                <div className="flex justify-between items-center px-4 py-2 bg-muted/30 rounded-lg">
                                    <span className="text-sm font-medium text-muted-foreground">Session Timer</span>
                                    <SessionTimer startTime={sessionStart} isActive={isRecording} />
                                </div>
                                {/* Modern Audio Level Meter */}
                                <div className="space-y-3 px-4 py-3 bg-muted/20 rounded-lg border border-border/50">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-foreground">Audio Level</span>
                                        <span className={`text-sm font-mono font-bold transition-colors duration-200 ${audioLevel > 0.7 ? 'text-green-500' :
                                            audioLevel > 0.4 ? 'text-yellow-500' :
                                                audioLevel > 0.1 ? 'text-blue-500' :
                                                    'text-muted-foreground'
                                            }`}>
                                            {(audioLevel * 100).toFixed(0)}%
                                        </span>
                                    </div>
                                    <AudioVisualizer isActive={isRecording || status === "connected"} audioLevel={audioLevel} />
                                </div>

                                {status === "connected" && (
                                    <div className="flex items-center gap-2 text-sm px-4 py-2 rounded-full bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 animate-in fade-in slide-in-from-bottom-2">
                                        <CheckCircle className="h-4 w-4" />
                                        <span className="font-semibold">Transcription Active</span>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                </div>

                {/* Right Panel: Transcript */}
                <div className="lg:col-span-8 flex flex-col h-full min-h-[500px]">
                    <Card className="flex-1 border-0 shadow-xl bg-card/80 backdrop-blur-sm ring-1 ring-border/50 flex flex-col h-full">
                        <CardHeader className="border-b border-border/50 px-6 py-4 flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-xl">Stream Transcript</CardTitle>
                                <CardDescription>Direct server feed</CardDescription>
                            </div>
                            {isRecording && (
                                <div className="flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-xs font-mono text-muted-foreground uppercase">Streaming</span>
                                </div>
                            )}
                        </CardHeader>
                        <CardContent className="flex-1 p-0 overflow-hidden relative">
                            <div className="absolute inset-0 p-6 overflow-y-auto">
                                <TranscriptDisplay segments={segments} isRecording={isRecording} />
                            </div>
                        </CardContent>
                    </Card>
                </div>

            </div>
        </PageLayout>
    );
}
