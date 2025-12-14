export const toolDefinitions = [
  {
    name: "send-message",
    description: "Send a message to a Discord channel",
    inputSchema: {
      type: "object",
      properties: {
        server: {
          type: "string",
          description: 'Server name or ID (optional if bot is only in one server)',
        },
        channel: {
          type: "string",
          description: 'Channel name (e.g., "general") or ID',
        },
        message: {
          type: "string",
          description: "Message content to send",
        },
      },
      required: ["channel", "message"],
    },
  },
  {
    name: "read-messages",
    description: "Read recent messages from a Discord channel",
    inputSchema: {
      type: "object",
      properties: {
        server: {
          type: "string",
          description: 'Server name or ID (optional if bot is only in one server)',
        },
        channel: {
          type: "string",
          description: 'Channel name (e.g., "general") or ID',
        },
        limit: {
          type: "number",
          description: "Number of messages to fetch (max 100)",
          default: 50,
        },
      },
      required: ["channel"],
    },
  },
  {
    name: "list-channels",
    description: "List all channels in a Discord server",
    inputSchema: {
      type: "object",
      properties: {
        server: {
          type: "string",
          description: 'Server name or ID (optional if bot is only in one server)',
        },
      },
      required: [],
    },
  },
  {
    name: "list-channels-with-new-messages",
    description: "List all channels that have new messages since a specific time, including message count",
    inputSchema: {
      type: "object",
      properties: {
        server: {
          type: "string",
          description: 'Server name or ID (optional if bot is only in one server)',
        },
        since: {
          type: "string",
          description: 'ISO 8601 timestamp (e.g., "2024-01-01T00:00:00Z") or relative time (e.g., "1h" for 1 hour, "24h" for 24 hours, "7d" for 7 days)',
        },
      },
      required: ["since"],
    },
  },
];
