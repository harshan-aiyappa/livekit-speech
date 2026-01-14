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
      className={`h-24 w-24 rounded-full transition-all duration-300 ${
        isRecording
          ? "bg-destructive border-destructive-border"
          : "bg-primary border-primary-border"
      } ${isRecording ? "animate-pulse" : ""}`}
      data-testid="button-record"
    >
      {isConnecting ? (
        <Loader2 className="h-10 w-10 text-primary-foreground animate-spin" />
      ) : isRecording ? (
        <MicOff className="h-10 w-10 text-destructive-foreground" />
      ) : (
        <Mic className="h-10 w-10 text-primary-foreground" />
      )}
    </Button>
  );
}
