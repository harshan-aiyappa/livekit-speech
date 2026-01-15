import { useEffect, useRef } from "react";

interface AudioVisualizerProps {
  isActive: boolean;
  audioLevel: number;
}

export function AudioVisualizer({ isActive, audioLevel }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const barsRef = useRef<number[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const numBars = 40; // More bars for smoother visualization

    // Initialize bar heights if needed
    if (barsRef.current.length === 0) {
      barsRef.current = new Array(numBars).fill(0);
    }

    const draw = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const barWidth = width / numBars;
      const barGap = 2;
      const actualBarWidth = barWidth - barGap;

      for (let i = 0; i < numBars; i++) {
        // Target height based on audio level with some randomness for natural feel
        const targetHeight = isActive
          ? (audioLevel * height * 0.9) + (Math.random() * audioLevel * height * 0.1)
          : 0;

        // Smooth transition
        barsRef.current[i] += (targetHeight - barsRef.current[i]) * 0.25;

        const barHeight = Math.max(2, barsRef.current[i]); // Minimum 2px height
        const x = i * barWidth;
        const y = (height - barHeight) / 2; // Center vertically

        // Color based on height/intensity
        const intensity = barHeight / height;
        let color;
        if (intensity > 0.7) {
          color = '#22c55e'; // Green for high
        } else if (intensity > 0.4) {
          color = '#eab308'; // Yellow for medium
        } else if (intensity > 0.1) {
          color = '#3b82f6'; // Blue for low
        } else {
          color = '#71717a'; // Gray for minimal
        }

        // Draw bar with gradient
        const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, color + '80'); // Add transparency at bottom

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, actualBarWidth, barHeight);
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, audioLevel]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={60}
      className="w-full h-16 rounded"
      style={{ imageRendering: 'auto' }}
    />
  );
}
