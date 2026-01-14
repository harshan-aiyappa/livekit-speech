import { useState, useEffect } from "react";

interface SessionTimerProps {
  startTime: number | null;
  isActive: boolean;
}

function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return `${hrs.toString().padStart(2, "0")}:${mins
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function SessionTimer({ startTime, isActive }: SessionTimerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isActive || startTime === null) {
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      setElapsed(Math.floor((now - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, startTime]);

  useEffect(() => {
    if (!isActive) {
      setElapsed(0);
    }
  }, [isActive]);

  return (
    <div
      className="font-mono text-4xl font-bold text-foreground tabular-nums"
      data-testid="text-timer"
    >
      {formatTime(elapsed)}
    </div>
  );
}
