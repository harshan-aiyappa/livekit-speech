import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const transcriptSegmentSchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  text: z.string(),
  confidence: z.number().optional(),
  speaker: z.string().optional(),
  isFinal: z.boolean(),
});

export type TranscriptSegment = z.infer<typeof transcriptSegmentSchema>;

export const sessionSchema = z.object({
  id: z.string(),
  roomName: z.string(),
  startTime: z.number(),
  endTime: z.number().optional(),
  segments: z.array(transcriptSegmentSchema),
});

export type TranscriptSession = z.infer<typeof sessionSchema>;

export const connectionStatusSchema = z.enum([
  "disconnected",
  "connecting", 
  "connected",
  "error"
]);

export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;

export const livekitTokenResponseSchema = z.object({
  token: z.string(),
  roomName: z.string(),
  identity: z.string(),
});

export type LiveKitTokenResponse = z.infer<typeof livekitTokenResponseSchema>;
