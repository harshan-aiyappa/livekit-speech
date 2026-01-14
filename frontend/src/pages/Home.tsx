import { useState, useEffect } from "react";
import { Settings, CheckCircle, AlertCircle, Wifi, Circle, Server, Mic, Radio, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { StatusIndicator } from "@/components/StatusIndicator";
import { RecordButton } from "@/components/RecordButton";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import { SessionTimer } from "@/components/SessionTimer";
import { TranscriptDisplay } from "@/components/TranscriptDisplay";
import { useLiveKit } from "@/hooks/useLiveKit";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

function StatusBadge({ label, status, detail }: { label: string; status: "ok" | "loading" | "error" | "idle"; detail?: string }) {
  const colors = {
    ok: "bg-green-500",
    loading: "bg-yellow-500 animate-pulse",
    error: "bg-red-500",
    idle: "bg-gray-400",
  };
  
  return (
    <div className="flex items-center gap-2 text-sm" data-testid={`status-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <Circle className={`h-2.5 w-2.5 ${colors[status]} rounded-full`} fill="currentColor" />
      <span className="font-medium">{label}</span>
      {detail && <span className="text-muted-foreground text-xs">({detail})</span>}
    </div>
  );
}

export default function Home() {
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
        title: "Backend Connected",
        description: healthData.whisper_loaded 
          ? "FastAPI + Whisper ready" 
          : "FastAPI ready (Whisper loading...)",
        duration: 3000,
      });
    }
  }, [healthData?.status]);

  useEffect(() => {
    if (healthError) {
      toast({
        title: "Backend Offline",
        description: "Cannot connect to FastAPI",
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
          title: "LiveKit Connected",
          description: `Room: ${roomName}`,
          duration: 3000,
        });
      } else if (status === "disconnected" && prevStatus === "connected") {
        toast({
          title: "Disconnected",
          description: "Session ended",
          duration: 3000,
        });
      } else if (status === "error") {
        toast({
          title: "Connection Error",
          description: error || "Failed to connect",
          variant: "destructive",
          duration: 5000,
        });
      }
    }
  }, [status, prevStatus, roomName, error, toast]);

  const handleToggleRecording = async () => {
    if (isRecording) {
      stopRecording();
      setSessionStart(null);
    } else {
      setSessionStart(Date.now());
      await startRecording();
    }
  };

  const frontendStatus = "ok";
  const backendStatus = healthError ? "error" : healthLoading ? "loading" : healthData?.status === "ok" ? "ok" : "idle";
  const whisperStatus = healthData?.whisper_loaded ? "ok" : healthData?.status === "ok" ? "loading" : "idle";
  const livekitStatus = status === "connected" ? "ok" : status === "connecting" ? "loading" : status === "error" ? "error" : "idle";
  const websocketStatus = wsConnected ? "ok" : isRecording ? "loading" : "idle";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between gap-4 p-4 border-b border-border">
        <StatusIndicator status={status} roomName={roomName ?? undefined} />
        <div className="flex items-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            data-testid="button-settings"
          >
            <Settings className="h-5 w-5" />
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-6xl mx-auto w-full p-6 gap-6">
        <Card data-testid="card-system-status">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Server className="h-5 w-5" />
              System Status - Flow Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Radio className="h-3.5 w-3.5" />
                  FRONTEND
                </div>
                <StatusBadge label="React" status={frontendStatus} detail="Vite" />
              </div>
              
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Server className="h-3.5 w-3.5" />
                  BACKEND
                </div>
                <StatusBadge label="FastAPI" status={backendStatus} detail="Python" />
              </div>
              
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Mic className="h-3.5 w-3.5" />
                  LIVEKIT
                </div>
                <StatusBadge label="WebRTC" status={livekitStatus} detail={roomName ? "Room active" : "Idle"} />
              </div>
              
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Brain className="h-3.5 w-3.5" />
                  ASR
                </div>
                <StatusBadge label="Whisper" status={whisperStatus} detail="faster-whisper" />
              </div>
              
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Wifi className="h-3.5 w-3.5" />
                  REALTIME
                </div>
                <StatusBadge label="WebSocket" status={websocketStatus} detail={wsConnected ? "Connected" : "Idle"} />
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-border">
              <div className="text-xs text-muted-foreground text-center">
                Flow: <span className="font-mono">Microphone → LiveKit (WebRTC) → FastAPI → Whisper → WebSocket → UI</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <section className="flex flex-col items-center gap-6 py-6">
          <RecordButton
            isRecording={isRecording}
            isConnecting={status === "connecting"}
            onClick={handleToggleRecording}
          />
          <AudioVisualizer isActive={isRecording} audioLevel={audioLevel} />
          <SessionTimer startTime={sessionStart} isActive={isRecording} />
          
          {mode && (
            <div 
              className="flex items-center gap-2 text-sm px-4 py-2 rounded-full bg-green-500/10 text-green-600 border border-green-500/20"
              data-testid="status-mode"
            >
              <CheckCircle className="h-4 w-4" />
              Live Transcription Active
            </div>
          )}
          
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-md" data-testid="text-error">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </section>

        <section className="flex-1 min-h-[300px]">
          <TranscriptDisplay segments={segments} isRecording={isRecording} />
        </section>
      </main>
    </div>
  );
}
