
import { useState, useEffect } from "react";
import { CheckCircle, AlertCircle, Server } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusIndicator } from "@/components/StatusIndicator";
import { RecordButton } from "@/components/RecordButton";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import { SessionTimer } from "@/components/SessionTimer";
import { TranscriptDisplay } from "@/components/TranscriptDisplay";
import { useLiveKit } from "@/hooks/useLiveKit";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { PageLayout } from "@/components/layout/PageLayout";

function StatusBadge({ label, status, detail }: { label: string; status: "ok" | "loading" | "error" | "idle"; detail?: string }) {
  const styles = {
    ok: "bg-zinc-900 dark:bg-zinc-100 opacity-100",
    loading: "bg-zinc-400 animate-pulse",
    error: "bg-zinc-500",
    idle: "bg-zinc-200 dark:bg-zinc-800",
  };

  return (
    <div className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors" data-testid={`status-${label.toLowerCase().replace(/\s/g, '-')}`}>
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

export default function TestMode() {
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

  const headerActions = (
    <div className="flex items-center gap-2">
      <StatusIndicator status={status} roomName={roomName ?? undefined} />
    </div>
  );

  return (
    <PageLayout
      title="Hybrid Test Mode"
      subtitle="LiveKit Room + Custom WebSocket"
      actions={headerActions}
    >
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
                  <AudioVisualizer isActive={isRecording} audioLevel={audioLevel} />
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

          {/* System Status */}
          <Card className="overflow-hidden border-0 shadow-md ring-1 ring-border/50 h-full">
            <CardHeader className="bg-muted/20 pb-4">
              <CardTitle className="text-sm font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Server className="h-4 w-4" /> System Health
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                <div className="p-4 grid grid-cols-1 gap-4">
                  <div className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Architecture</span>
                    <span className="text-xs font-mono font-medium">Hybrid (WS+Room)</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-md bg-orange-500/10 border border-orange-500/20">
                    <span className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider">Real-time TAT</span>
                    <div className="flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                      </span>
                      <span className="text-xs font-mono font-bold text-orange-700 dark:text-orange-300">
                        {latency > 0
                          ? (latency > 1000 ? `${(latency / 1000).toFixed(2)}s` : `${latency}ms`)
                          : "~800ms"}
                      </span>
                    </div>
                  </div>
                  <StatusBadge label="Frontend" status={frontendStatus} detail="Vite + React" />
                  <StatusBadge label="Backend API" status={backendStatus} detail="FastAPI" />
                  <StatusBadge label="LiveKit" status={livekitStatus} detail={roomName ? "Connected" : "Ready"} />
                  <StatusBadge label="Speech Engine" status={whisperStatus} detail="Whisper" />
                  <StatusBadge label="Realtime" status={websocketStatus} detail={wsConnected ? "Active" : "Standard"} />
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
