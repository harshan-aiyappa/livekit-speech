
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { CheckCircle, AlertCircle, Server, Mic, Box, Activity, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RecordButton } from "@/components/RecordButton";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import { SessionTimer } from "@/components/SessionTimer";
import { TranscriptDisplay } from "@/components/TranscriptDisplay";
import { useLiveKit } from "@/hooks/useLiveKit";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { PageLayout } from "@/components/layout/PageLayout";
import { SystemCheckModal, SystemCheckStep } from "@/components/SystemCheckModal";

// StatusBadge Removed (Dead Code)

export default function TestMode() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const {
    status,
    isRecording,
    segments,
    audioLevel,
    startRecording,
    stopRecording,
    roomName,
    error,
    mode,
    latency,
    language,
    setLanguage,
  } = useLiveKit();

  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [prevStatus, setPrevStatus] = useState(status);
  const [wsConnected, setWsConnected] = useState(false);

  // System Check State
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [micStatus, setMicStatus] = useState<"idle" | "running" | "success" | "error">("idle");

  const { data: healthData, isError: healthError, isLoading: healthLoading } = useQuery<{ status: string; timestamp: string; whisper_loaded: boolean }>({
    queryKey: ["/api/health"],
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (status === "connected") {
      setWsConnected(true);
    } else if (status === "disconnected") {
      setWsConnected(false);
    }
  }, [status]);

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

  useEffect(() => {
    if (healthData?.status === "ok" && prevStatus !== status) {
      toast({
        title: "System Ready",
        description: healthData.whisper_loaded
          ? "AI Transcription Engine is online."
          : "Backend ready, models loading...",
        duration: 3000,
      });
    }
  }, [healthData?.status]);

  useEffect(() => {
    if (healthError) {
      toast({
        title: "System Offline",
        description: "Could not connect to the backend server.",
        variant: "destructive",
        duration: 5000,
      });
    }
  }, [healthError]);

  useEffect(() => {
    if (status !== prevStatus) {
      setPrevStatus(status);

      if (status === "connected") {
        toast({
          title: "Session Active",
          description: `Connected to room: ${roomName}`,
          duration: 3000,
        });
      } else if (status === "disconnected" && prevStatus === "connected") {
        toast({
          title: "Session Ended",
          description: "Disconnected from session.",
          duration: 3000,
        });
      } else if (status === "error") {
        toast({
          title: "Connection Failed",
          description: error || "An unexpected error occurred.",
          variant: "destructive",
          duration: 5000,
        });
      }
    }
  }, [status, prevStatus, roomName, error, toast]);

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
      setSessionStart(null);
    } else {
      setSessionStart(Date.now());
      startRecording();
    }
  };

  const frontendStatus = "ok";
  const backendStatus = healthError ? "error" : healthLoading ? "loading" : healthData?.status === "ok" ? "ok" : "idle";
  const whisperStatus = healthData?.whisper_loaded ? "ok" : healthData?.status === "ok" ? "loading" : "idle";
  const livekitStatus = status === "connected" ? "ok" : status === "connecting" ? "loading" : status === "error" ? "error" : "idle";
  const websocketStatus = wsConnected ? "ok" : isRecording ? "loading" : "idle";

  // Compact Top Status Bar
  const TopStatusBar = () => (
    <div className="hidden md:flex items-center gap-3 mr-4">
      {/* Architecture */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
        <Server className="h-3.5 w-3.5 text-blue-500" />
        <span className="text-xs font-medium text-muted-foreground">Hybrid</span>
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
        <span className="text-xs font-medium capitalize">{status}</span>
      </div>
    </div>
  );

  const headerActions = (
    <div className="flex items-center">
      <TopStatusBar />
    </div>
  );

  // Construct Check Steps
  const checkSteps: SystemCheckStep[] = [
    {
      id: "hybrid-connect",
      label: "Room Connection",
      description: "Joining LiveKit session...",
      status: status === "connected" ? "success" : status === "error" ? "error" : "running",
      icon: <Box className="h-4 w-4" />
    },
    {
      id: "mic-check",
      label: "Microphone Access",
      description: "Verifying input device permissions...",
      status: micStatus,
      icon: <Mic className="h-4 w-4" />
    },
    {
      id: "health-check",
      label: "Backend Service",
      description: "Checking API health...",
      status: backendStatus === "ok" ? "success" : backendStatus === "error" ? "error" : "running",
      icon: <Server className="h-4 w-4" />
    },
    {
      id: "ai-model",
      label: "AI Neural Engine",
      description: whisperStatus === "ok" ? "Faster-Whisper Ready" : "Loading Model...",
      status: whisperStatus === "ok" ? "success" : "running",
      icon: <Zap className="h-4 w-4" />
    }
  ];

  return (
    <PageLayout
      title="Hybrid Test Mode"
      subtitle="LiveKit Room + Custom WebSocket"
      actions={headerActions}
    >
      {/* System Verification Onboarding */}
      <SystemCheckModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onExit={() => setLocation("/")}
        steps={checkSteps}
        title="Hybrid System Check"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Left Panel: Controls */}
        <div className="lg:col-span-4 flex flex-col gap-6">

          {/* Control Center */}
          <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm ring-1 ring-border/50">
            <CardHeader>
              <CardTitle>Control Center</CardTitle>
              <CardDescription>Manage your recording session</CardDescription>
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

                  {/* Animated Bar Visualizer */}
                  <AudioVisualizer isActive={isRecording || status === "connected"} audioLevel={audioLevel} />
                </div>
              </div>

              {mode && (
                <div
                  className="flex items-center gap-2 text-sm px-4 py-2 rounded-full bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 animate-in fade-in slide-in-from-bottom-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-semibold">Transcription Active</span>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-sm text-foreground bg-muted px-4 py-2 rounded-md border border-border">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Panel: Transcript */}
        <div className="lg:col-span-8 flex flex-col h-full min-h-[500px]">
          <Card className="flex-1 border-0 shadow-xl bg-card/80 backdrop-blur-sm ring-1 ring-border/50 flex flex-col h-full">
            <CardHeader className="border-b border-border/50 px-6 py-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl">Live Transcript</CardTitle>
                <CardDescription>Real-time speech-to-text conversion</CardDescription>
              </div>
              {isRecording && (
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-foreground animate-pulse" />
                  <span className="text-xs font-mono text-muted-foreground uppercase">Recording</span>
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
