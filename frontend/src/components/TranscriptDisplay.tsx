import { useRef, useEffect } from "react";
import { Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import type { TranscriptSegment } from "@shared/schema";

interface TranscriptDisplayProps {
  segments: TranscriptSegment[];
  isRecording: boolean;
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${hrs.toString().padStart(2, "0")}:${mins
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function TranscriptDisplay({
  segments,
  isRecording,
}: TranscriptDisplayProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [segments]);

  const handleCopy = async () => {
    const text = segments.map((s) => s.text).join("\n");
    await navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Transcript copied to clipboard",
    });
  };

  const handleDownload = () => {
    const text = segments
      .map((s) => `[${formatTimestamp(s.timestamp)}] ${s.text}`)
      .join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Downloaded",
      description: "Transcript saved to file",
    });
  };

  return (
    <Card className="flex flex-col h-full border-card-border" data-testid="card-transcript">
      <div className="flex items-center justify-between gap-4 p-4 border-b border-card-border">
        <h2 className="text-lg font-semibold text-foreground">Transcript</h2>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleCopy}
            disabled={segments.length === 0}
            data-testid="button-copy"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleDownload}
            disabled={segments.length === 0}
            data-testid="button-download"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {segments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-muted-foreground">
            <p className="text-center">
              {isRecording
                ? "Listening... speak into your microphone"
                : "Press the record button to start transcribing"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {segments.map((segment) => (
              <div
                key={segment.id}
                className={`p-3 rounded-lg border transition-opacity duration-300 ${
                  segment.isFinal
                    ? "bg-card border-card-border"
                    : "bg-muted/50 border-muted/30 opacity-70"
                }`}
                data-testid={`segment-${segment.id}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-muted-foreground">
                    {formatTimestamp(segment.timestamp)}
                  </span>
                  {segment.speaker && (
                    <span className="text-xs font-semibold text-primary">
                      {segment.speaker}
                    </span>
                  )}
                  {segment.confidence !== undefined && (
                    <span className="text-xs text-muted-foreground/60">
                      {Math.round(segment.confidence * 100)}%
                    </span>
                  )}
                </div>
                <p className="text-base leading-relaxed text-foreground font-mono">
                  {segment.text}
                </p>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
}
