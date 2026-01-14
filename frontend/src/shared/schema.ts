export interface TranscriptSegment {
    id: string;
    timestamp: number;
    text: string;
    confidence?: number;
    speaker?: string;
    isFinal: boolean;
}

export interface LiveKitTokenResponse {
    token: string;
    roomName: string;
    identity: string;
}

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";
