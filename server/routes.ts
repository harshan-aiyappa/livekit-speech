import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { createProxyMiddleware, type Options } from "http-proxy-middleware";
import { log } from "./index";

const PYTHON_API_URL = process.env.PYTHON_API_URL || "http://localhost:8000";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  const apiProxyOptions: Options = {
    target: PYTHON_API_URL,
    changeOrigin: true,
    on: {
      error: (err: Error, _req: unknown, res: unknown) => {
        log(`Proxy error: ${err.message}`, "proxy");
        const response = res as Response;
        if (response && typeof response.status === 'function') {
          response.status(502).json({ message: "Python API unavailable" });
        }
      },
    },
  };

  const wsProxy = createProxyMiddleware({
    target: PYTHON_API_URL,
    changeOrigin: true,
    ws: true,
    on: {
      error: (err: Error) => {
        log(`WebSocket proxy error: ${err.message}`, "proxy");
      },
    },
  });

  app.use("/api", createProxyMiddleware(apiProxyOptions));
  app.use("/ws", wsProxy);

  httpServer.on("upgrade", (req, socket, head) => {
    if (req.url?.startsWith("/ws")) {
      log("WebSocket upgrade request received", "proxy");
      wsProxy.upgrade(req, socket as any, head);
    }
  });

  log(`Proxying /api and /ws to ${PYTHON_API_URL}`, "proxy");

  return httpServer;
}
