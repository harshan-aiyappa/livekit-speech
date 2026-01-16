
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { AlertCircle, Zap, ArrowLeft, Wifi, Mic, Server, Activity } from "lucide-react";
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

function StatusBadge({ label, status, detail }: { label: string; status: "ok" | "loading" | "error" | "idle"; detail?: string }) {
    const styles = {
        ok: "bg-zinc-900 dark:bg-zinc-100 opacity-100",
        loading: "bg-zinc-400 animate-pulse",
        error: "bg-zinc-500",
        idle: "bg-zinc-200 dark:bg-zinc-800",
    };

    return (
        <div className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
            <span className="relative flex h-2.5 w-2.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${styles[status]} ${status === 'idle' ? 'hidden' : ''}`}></span>
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${styles[status]}`}></span>
            </span>
            <div className="flex flex-col">
                <span className="font-medium text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
                {detail && <span className="text-sm font-semibold">{detail}</span>}
            </div>
        </div>
    );
}

export default function WebSocketMode() {
    const [_, setLocation] = useLocation();
    const { toast } = useToast();
    const {
        status,
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
            label: "Transcription Service",
            description: "Checking Faster-Whisper availability...",
            status: status === "connected" ? "success" : "idle", // Assumes if WS connects, Backend is ready
            icon: <Server className="h-4 w-4" />
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

    const headerActions = (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
            <div className={`h-2 w-2 rounded-full ${status === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs font-medium text-muted-foreground">
                {status === 'connected' ? 'Socket Online' : 'Offline'}
            </span>
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
                                <div className="space-y-3 px-4 py-3 bg-muted/20 rounded-lg border border-border/50">
                                    <AudioVisualizer isActive={isRecording} audioLevel={audioLevel} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="overflow-hidden border-0 shadow-md ring-1 ring-border/50 h-full">
                        <CardHeader className="bg-muted/20 pb-4">
                            <CardTitle className="text-sm font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <Activity className="h-4 w-4" /> Telemetry
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-border/50">
                                <div className="p-4 grid grid-cols-1 gap-4">
                                    <div className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Architecture</span>
                                        <span className="text-xs font-mono font-medium">Direct Stream (P2P)</span>
                                    </div>
                                    <div className="flex items-center justify-between p-2 rounded-md bg-green-500/10 border border-green-500/20">
                                        <span className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider">Real-time TAT</span>
                                        <div className="flex items-center gap-1.5">
                                            <span className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                            </span>
                                            <span className="text-xs font-mono font-bold text-green-700 dark:text-green-300">
                                                {latency > 0
                                                    ? `${(latency / 1000).toFixed(2)}s`
                                                    : "0.00s"}
                                            </span>
                                        </div>
                                    </div>
                                    <StatusBadge label="Socket Status" status={wsStatus} detail={status} />
                                    <StatusBadge label="LiveKit" status="idle" detail="Not Used" />
                                </div>
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
