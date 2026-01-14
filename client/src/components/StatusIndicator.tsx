import type { ConnectionStatus } from "@shared/schema";

interface StatusIndicatorProps {
  status: ConnectionStatus;
  roomName?: string;
}

export function StatusIndicator({ status, roomName }: StatusIndicatorProps) {
  const statusConfig = {
    disconnected: {
      color: "bg-gray-400",
      label: "Disconnected",
      pulse: false,
    },
    connecting: {
      color: "bg-yellow-500",
      label: "Connecting...",
      pulse: true,
    },
    connected: {
      color: "bg-green-500",
      label: "Live",
      pulse: true,
    },
    error: {
      color: "bg-red-500",
      label: "Error",
      pulse: false,
    },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2" data-testid="status-indicator">
      <div className="relative flex items-center">
        <span
          className={`h-3 w-3 rounded-full ${config.color} ${
            config.pulse ? "animate-pulse" : ""
          }`}
          data-testid="status-dot"
        />
        {config.pulse && (
          <span
            className={`absolute h-3 w-3 rounded-full ${config.color} animate-ping opacity-75`}
          />
        )}
      </div>
      <span
        className="text-sm font-medium text-foreground"
        data-testid="status-label"
      >
        {config.label}
      </span>
      {roomName && status === "connected" && (
        <span className="text-xs text-muted-foreground">({roomName})</span>
      )}
    </div>
  );
}
