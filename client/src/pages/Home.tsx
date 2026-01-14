import { useState, useEffect } from "react";
import { Settings, CheckCircle, AlertCircle, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { StatusIndicator } from "@/components/StatusIndicator";
import { RecordButton } from "@/components/RecordButton";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import { SessionTimer } from "@/components/SessionTimer";
import { TranscriptDisplay } from "@/components/TranscriptDisplay";
import { useLiveKit } from "@/hooks/useLiveKit";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

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

  const { data: healthData, isError: healthError } = useQuery<{ status: string; timestamp: string; whisper_loaded: boolean }>({
    queryKey: ["/api/health"],
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (healthData?.status === "ok") {
      toast({
        title: "Backend Connected",
        description: healthData.whisper_loaded 
          ? "Python API + Whisper ready for transcription" 
          : "Python API ready (Whisper loading...)",
        duration: 3000,
      });
    }
  }, [healthData?.status, healthData?.whisper_loaded]);

  useEffect(() => {
    if (healthError) {
      toast({
        title: "Backend Offline",
        description: "Cannot connect to Python API",
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
          title: "Connected",
          description: `Connected to LiveKit room${roomName ? `: ${roomName}` : ""}`,
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between gap-4 p-4 border-b border-border">
        <StatusIndicator status={status} roomName={roomName ?? undefined} />
        <div className="flex items-center gap-3">
          <div 
            className="flex items-center gap-1.5 text-xs"
            data-testid="status-api-health"
            title={healthData ? `Last check: ${new Date(healthData.timestamp).toLocaleTimeString()}` : "Checking..."}
          >
            {healthData?.status === "ok" ? (
              <>
                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                <span className="text-muted-foreground">
                  API OK {healthData.whisper_loaded ? "| Whisper Ready" : "| Loading Whisper..."}
                </span>
              </>
            ) : healthError ? (
              <>
                <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                <span className="text-destructive">API Offline</span>
              </>
            ) : (
              <>
                <Wifi className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />
                <span className="text-muted-foreground">Checking...</span>
              </>
            )}
          </div>
          {mode && (
            <div 
              className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded ${
                mode === "live" ? "bg-green-500/10 text-green-600" : "bg-yellow-500/10 text-yellow-600"
              }`}
              data-testid="status-mode"
            >
              {mode === "live" ? "Live Transcription" : "Demo Mode"}
            </div>
          )}
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

      <main className="flex-1 flex flex-col max-w-6xl mx-auto w-full p-6 gap-8">
        <section className="flex flex-col items-center gap-6 py-8">
          <RecordButton
            isRecording={isRecording}
            isConnecting={status === "connecting"}
            onClick={handleToggleRecording}
          />
          <AudioVisualizer isActive={isRecording} audioLevel={audioLevel} />
          <SessionTimer startTime={sessionStart} isActive={isRecording} />
          
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-md" data-testid="text-error">
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
