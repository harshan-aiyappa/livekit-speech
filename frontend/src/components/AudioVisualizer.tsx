import { useEffect, useState } from "react";

interface AudioVisualizerProps {
  isActive: boolean;
  audioLevel?: number;
}

export function AudioVisualizer({ isActive, audioLevel = 0 }: AudioVisualizerProps) {
  const [bars, setBars] = useState<number[]>([0.2, 0.3, 0.5, 0.4, 0.3, 0.2, 0.3]);

  useEffect(() => {
    if (!isActive) {
      setBars([0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2]);
      return;
    }

    const interval = setInterval(() => {
      const baseLevel = audioLevel > 0 ? audioLevel : 0.3;
      setBars(
        Array.from({ length: 7 }, () => {
          const variation = Math.random() * 0.4;
          return Math.min(1, Math.max(0.15, baseLevel + variation));
        })
      );
    }, 100);

    return () => clearInterval(interval);
  }, [isActive, audioLevel]);

  return (
    <div
      className="flex items-end justify-center gap-1 h-8"
      data-testid="audio-visualizer"
    >
      {bars.map((height, index) => (
        <div
          key={index}
          className={`w-1.5 rounded-full transition-all duration-100 ${
            isActive
              ? "bg-primary"
              : "bg-muted-foreground/30"
          }`}
          style={{
            height: `${height * 100}%`,
            minHeight: "4px",
          }}
        />
      ))}
    </div>
  );
}
