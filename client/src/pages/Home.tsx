import { useState } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { StatusIndicator } from "@/components/StatusIndicator";
import { RecordButton } from "@/components/RecordButton";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import { SessionTimer } from "@/components/SessionTimer";
import { TranscriptDisplay } from "@/components/TranscriptDisplay";
import { useLiveKit } from "@/hooks/useLiveKit";

export default function Home() {
  const {
    status,
    isRecording,
    segments,
    audioLevel,
    startRecording,
    stopRecording,
    roomName,
    error,
  } = useLiveKit();

  const [sessionStart, setSessionStart] = useState<number | null>(null);

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
        <div className="flex items-center gap-2">
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
