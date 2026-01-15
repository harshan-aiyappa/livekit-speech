import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RecordButtonProps {
  isRecording: boolean;
  isConnecting: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export function RecordButton({
  isRecording,
  isConnecting,
  onClick,
  disabled = false,
}: RecordButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled || isConnecting}
      size="lg"
      className={`h-24 w-24 rounded-full transition-all duration-300 ${isRecording
          ? "bg-zinc-100 text-zinc-900 border-4 border-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-100"
          : "bg-primary text-primary-foreground border-primary-border"
        } ${isRecording ? "animate-pulse" : ""}`}
      data-testid="button-record"
    >
      {isConnecting ? (
        <Loader2 className="h-10 w-10 animate-spin" />
      ) : isRecording ? (
        <MicOff className="h-10 w-10" />
      ) : (
        <Mic className="h-10 w-10" />
      )}
    </Button>
  );
}
