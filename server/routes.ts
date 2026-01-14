import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { AccessToken } from "livekit-server-sdk";
import { storage } from "./storage";
import { log } from "./index";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.post("/api/livekit/token", async (req, res) => {
    try {
      const apiKey = process.env.LIVEKIT_API_KEY;
      const apiSecret = process.env.LIVEKIT_API_SECRET;

      if (!apiKey || !apiSecret) {
        log("LiveKit API key or secret not configured", "livekit");
        return res.status(500).json({ message: "LiveKit not configured" });
      }

      const roomName = `transcription-${Date.now()}`;
      const identity = `user-${Date.now()}`;

      const at = new AccessToken(apiKey, apiSecret, {
        identity,
        ttl: 3600,
      });

      at.addGrant({
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      });

      const token = await at.toJwt();

      log(`Generated token for room: ${roomName}, identity: ${identity}`, "livekit");

      res.json({
        token,
        roomName,
        identity,
      });
    } catch (error) {
      log(`Token generation error: ${error}`, "livekit");
      res.status(500).json({ message: "Failed to generate token" });
    }
  });

  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws: WebSocket) => {
    log("WebSocket client connected", "websocket");

    let segmentCounter = 0;
    let simulationInterval: NodeJS.Timeout | null = null;

    const samplePhrases = [
      "Hello, this is a test of the voice transcription system.",
      "The quick brown fox jumps over the lazy dog.",
      "Real-time speech recognition is an exciting technology.",
      "LiveKit provides excellent WebRTC infrastructure for audio streaming.",
      "This is a demonstration of the transcription capabilities.",
    ];

    simulationInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        segmentCounter++;
        const phrase = samplePhrases[segmentCounter % samplePhrases.length];
        
        ws.send(JSON.stringify({
          type: "transcript",
          id: `segment-${segmentCounter}`,
          timestamp: Date.now(),
          text: phrase,
          confidence: 0.85 + Math.random() * 0.15,
          speaker: "Speaker 1",
          isFinal: true,
        }));
      }
    }, 3000);

    ws.on("message", (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        log(`Received message: ${JSON.stringify(data)}`, "websocket");
        
        if (data.type === "audio") {
          segmentCounter++;
          ws.send(JSON.stringify({
            type: "transcript",
            id: `segment-${segmentCounter}`,
            timestamp: Date.now(),
            text: "Processing audio...",
            isFinal: false,
          }));
        }
      } catch (error) {
        log(`Failed to parse WebSocket message: ${error}`, "websocket");
      }
    });

    ws.on("close", () => {
      log("WebSocket client disconnected", "websocket");
      if (simulationInterval) {
        clearInterval(simulationInterval);
      }
    });

    ws.on("error", (error) => {
      log(`WebSocket error: ${error}`, "websocket");
      if (simulationInterval) {
        clearInterval(simulationInterval);
      }
    });
  });

  log("WebSocket server initialized on /ws", "websocket");

  return httpServer;
}
