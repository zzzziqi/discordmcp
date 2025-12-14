import { z } from 'zod';

// Validation schemas
export const SendMessageSchema = z.object({
  server: z.string().optional().describe('Server name or ID (optional if bot is only in one server)'),
  channel: z.string().describe('Channel name (e.g., "general") or ID'),
  message: z.string(),
});

export const ReadMessagesSchema = z.object({
  server: z.string().optional().describe('Server name or ID (optional if bot is only in one server)'),
  channel: z.string().describe('Channel name (e.g., "general") or ID'),
  limit: z.number().min(1).max(100).default(50),
});

export const ListChannelsSchema = z.object({
  server: z.string().optional().describe('Server name or ID (optional if bot is only in one server)'),
});

export const ListChannelsWithNewMessagesSchema = z.object({
  server: z.string().optional().describe('Server name or ID (optional if bot is only in one server)'),
  since: z.string().describe('ISO 8601 timestamp or relative time (e.g., "2024-01-01T00:00:00Z" or "1h", "24h", "7d")'),
});

export type SendMessageArgs = z.infer<typeof SendMessageSchema>;
export type ReadMessagesArgs = z.infer<typeof ReadMessagesSchema>;
export type ListChannelsArgs = z.infer<typeof ListChannelsSchema>;
export type ListChannelsWithNewMessagesArgs = z.infer<typeof ListChannelsWithNewMessagesSchema>;
