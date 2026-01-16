export interface TranscriptSegment {
    id: string;
    timestamp: number;
    text: string;
    confidence?: number;
    speaker?: string;
    isFinal: boolean;
    turnaround_ms?: number; // Processing time (audio received → transcript returned)
}

export interface LiveKitTokenResponse {
    token: string;
    roomName: string;
    identity: string;
}

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error" | "idle";
