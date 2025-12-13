import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import dotenv from 'dotenv';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { 
  Client, 
  GatewayIntentBits, 
  TextChannel, 
  ForumChannel, 
  ThreadChannel,
  ChannelType,
  Message 
} from 'discord.js';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Discord client setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Helper function to find a guild by name or ID
async function findGuild(guildIdentifier?: string) {
  if (!guildIdentifier) {
    // If no guild specified and bot is only in one guild, use that
    if (client.guilds.cache.size === 1) {
      return client.guilds.cache.first()!;
    }
    // List available guilds
    const guildList = Array.from(client.guilds.cache.values())
      .map(g => `"${g.name}"`).join(', ');
    throw new Error(`Bot is in multiple servers. Please specify server name or ID. Available servers: ${guildList}`);
  }

  // Try to fetch by ID first
  try {
    const guild = await client.guilds.fetch(guildIdentifier);
    if (guild) return guild;
  } catch {
    // If ID fetch fails, search by name
    const guilds = client.guilds.cache.filter(
      g => g.name.toLowerCase() === guildIdentifier.toLowerCase()
    );
    
    if (guilds.size === 0) {
      const availableGuilds = Array.from(client.guilds.cache.values())
        .map(g => `"${g.name}"`).join(', ');
      throw new Error(`Server "${guildIdentifier}" not found. Available servers: ${availableGuilds}`);
    }
    if (guilds.size > 1) {
      const guildList = guilds.map(g => `${g.name} (ID: ${g.id})`).join(', ');
      throw new Error(`Multiple servers found with name "${guildIdentifier}": ${guildList}. Please specify the server ID.`);
    }
    return guilds.first()!;
  }
  throw new Error(`Server "${guildIdentifier}" not found`);
}

// Helper function to find a channel by name or ID within a specific guild
async function findChannel(channelIdentifier: string, guildIdentifier?: string): Promise<TextChannel | ThreadChannel | ForumChannel> {
  const guild = await findGuild(guildIdentifier);
  
  // First try to fetch by ID
  try {
    const channel = await client.channels.fetch(channelIdentifier);
    if ((channel instanceof TextChannel || channel instanceof ThreadChannel || channel instanceof ForumChannel) && (channel as any).guild.id === guild.id) {
      return channel;
    }
  } catch {
    // If fetching by ID fails, search by name in the specified guild
    // note: threads are not in guild.channels.cache usually, so name lookup works for top-level channels
    const channels = guild.channels.cache.filter(
      (channel): channel is TextChannel | ForumChannel =>
        (channel instanceof TextChannel || channel instanceof ForumChannel) &&
        (channel.name.toLowerCase() === channelIdentifier.toLowerCase() ||
         channel.name.toLowerCase() === channelIdentifier.toLowerCase().replace('#', ''))
    );

    if (channels.size === 0) {
      const availableChannels = guild.channels.cache
        .filter((c): c is TextChannel | ForumChannel => c instanceof TextChannel || c instanceof ForumChannel)
        .map(c => `"#${c.name}"`).join(', ');
      throw new Error(`Channel "${channelIdentifier}" not found in server "${guild.name}". Available channels: ${availableChannels}`);
    }
    if (channels.size > 1) {
      const channelList = channels.map(c => `#${c.name} (${c.id})`).join(', ');
      throw new Error(`Multiple channels found with name "${channelIdentifier}" in server "${guild.name}": ${channelList}. Please specify the channel ID.`);
    }
    return channels.first()!;
  }
  throw new Error(`Channel "${channelIdentifier}" is not a text/forum/thread channel or not found in server "${guild.name}"`);
}

// Updated validation schemas
const SendMessageSchema = z.object({
  server: z.string().optional().describe('Server name or ID (optional if bot is only in one server)'),
  channel: z.string().describe('Channel name (e.g., "general") or ID'),
  message: z.string(),
});

const ReadMessagesSchema = z.object({
  server: z.string().optional().describe('Server name or ID (optional if bot is only in one server)'),
  channel: z.string().describe('Channel name (e.g., "general") or ID'),
  limit: z.number().min(1).max(100).default(50),
});

const ListChannelsSchema = z.object({
  server: z.string().optional().describe('Server name or ID (optional if bot is only in one server)'),
});

const ListChannelsWithNewMessagesSchema = z.object({
  server: z.string().optional().describe('Server name or ID (optional if bot is only in one server)'),
  since: z.string().describe('ISO 8601 timestamp or relative time (e.g., "2025-01-01T00:00:00Z" or "1h", "24h", "7d")'),
});

// Create server instance
const server = new Server(
  {
    name: "discord",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Helper function to parse relative time strings
function parseRelativeTime(timeStr: string): Date {
  const now = new Date();
  const match = timeStr.match(/^(\d+)(h|d|m)$/);
  
  if (match) {
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 'h':
        return new Date(now.getTime() - value * 60 * 60 * 1000);
      case 'd':
        return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
      case 'm':
        return new Date(now.getTime() - value * 60 * 1000);
    }
  }
  
  // Try to parse as ISO 8601
  const date = new Date(timeStr);
  if (isNaN(date.getTime())) {
    throw new Error('Invalid time format. Use ISO 8601 (e.g., "2024-01-01T00:00:00Z") or relative time (e.g., "1h", "24h", "7d")');
  }
  return date;
}

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
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
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "send-message": {
        const { channel: channelIdentifier, message } = SendMessageSchema.parse(args);
        const channel = await findChannel(channelIdentifier);
        
        if (channel instanceof ForumChannel) {
          // For forum channels, we can create a new post (thread)
          // But usually send-message expects to send to a text channel/thread.
          // Let's create a thread with the message as content
          const thread = await channel.threads.create({
            name: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
            message: { content: message },
          });
          return {
            content: [{
              type: "text",
              text: `Forum post created successfully in #${channel.name} in ${channel.guild.name}. Thread ID: ${thread.id}`,
            }],
          };
        }

        const sent = await channel.send(message);
        return {
          content: [{
            type: "text",
            text: `Message sent successfully to #${channel.name} in ${channel.guild.name}. Message ID: ${sent.id}`,
          }],
        };
      }

      case "read-messages": {
        const { channel: channelIdentifier, limit } = ReadMessagesSchema.parse(args);
        const channel = await findChannel(channelIdentifier);
        
        if (channel instanceof ForumChannel) {
          // If it's a forum channel, list active threads
          const activeThreads = await channel.threads.fetchActive();
          const props = Array.from(activeThreads.threads.values()).slice(0, limit).map(thread => ({
            channel: `#${channel.name}`,
            server: channel.guild.name,
            author: `<Thread Owner ID: ${thread.ownerId}>`,
            content: `[Forum Thread] ${thread.name} (Messages: ${thread.messageCount})`,
            timestamp: thread.createdAt?.toISOString() || new Date().toISOString(),
            threadId: thread.id
          }));
          return {
            content: [{
              type: "text",
              text: JSON.stringify(props, null, 2),
            }],
          };
        }
        
        const messages = await channel.messages.fetch({ limit });
        const formattedMessages = Array.from(messages.values()).map(msg => ({
          channel: `#${(channel as TextChannel | ThreadChannel).name}`,
          server: (channel as TextChannel | ThreadChannel).guild.name,
          author: msg.author.tag,
          content: msg.content,
          timestamp: msg.createdAt.toISOString(),
        }));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(formattedMessages, null, 2),
          }],
        };
      }

      case "list-channels": {
        const { server: guildIdentifier } = ListChannelsSchema.parse(args);
        const guild = await findGuild(guildIdentifier);
        
        const channels = guild.channels.cache
          .filter((channel): channel is TextChannel | ForumChannel => 
            channel instanceof TextChannel || channel instanceof ForumChannel
          )
          .map(channel => ({
            id: channel.id,
            name: channel.name,
            type: channel instanceof ForumChannel ? 'Forum' : 'Text',
            topic: (channel as TextChannel).topic || '',
            nsfw: (channel as any).nsfw, // ForumChannel has nsfw too
          }));

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              server: guild.name,
              serverId: guild.id,
              channels: channels,
              totalChannels: channels.length,
            }, null, 2),
          }],
        };
      }

      case "list-channels-with-new-messages": {
        const { server: guildIdentifier, since } = ListChannelsWithNewMessagesSchema.parse(args);
        const guild = await findGuild(guildIdentifier);
        const sinceDate = parseRelativeTime(since);
        
        const textChannels = guild.channels.cache
          .filter((channel): channel is TextChannel | ForumChannel => 
            channel instanceof TextChannel || channel instanceof ForumChannel
          );

        const channelsWithMessages = [];
        
        for (const [, channel] of textChannels) {
          try {
            if (channel instanceof ForumChannel) {
              const activeThreads = await channel.threads.fetchActive();
              let forumMessageCount = 0;
              let lastMsgAt: Date | null = null;
              let oldestMsgAt: Date | null = null;

              for (const [, thread] of activeThreads.threads) {
                 const messages = await thread.messages.fetch({ limit: 20 }); // Limit check size per thread
                 const newMessages = messages.filter(msg => msg.createdAt >= sinceDate);
                 if (newMessages.size > 0) {
                   forumMessageCount += newMessages.size;
                   const threadLast = newMessages.first()?.createdAt;
                   const threadOldest = newMessages.last()?.createdAt;
                   if (threadLast && (!lastMsgAt || threadLast > lastMsgAt)) lastMsgAt = threadLast;
                   if (threadOldest && (!oldestMsgAt || threadOldest < oldestMsgAt)) oldestMsgAt = threadOldest;
                 }
              }

              if (forumMessageCount > 0) {
                 channelsWithMessages.push({
                  id: channel.id,
                  name: channel.name,
                  messageCount: forumMessageCount,
                  type: 'Forum',
                  lastMessageAt: lastMsgAt?.toISOString(),
                  oldestNewMessageAt: oldestMsgAt?.toISOString(),
                });
              }

            } else {
              // TextChannel
              const messages = await channel.messages.fetch({ limit: 100 });
              const newMessages = messages.filter(msg => msg.createdAt >= sinceDate);
              
              if (newMessages.size > 0) {
                channelsWithMessages.push({
                  id: channel.id,
                  name: channel.name,
                  messageCount: newMessages.size,
                  type: 'Text',
                  lastMessageAt: newMessages.first()?.createdAt.toISOString(),
                  oldestNewMessageAt: newMessages.last()?.createdAt.toISOString(),
                });
              }
            }
          } catch (error) {
            // Skip channels we don't have permission to read
            console.error(`Error fetching messages from #${channel.name}:`, error);
          }
        }

        // Sort by message count (descending)
        channelsWithMessages.sort((a, b) => b.messageCount - a.messageCount);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              server: guild.name,
              serverId: guild.id,
              since: sinceDate.toISOString(),
              channels: channelsWithMessages,
              totalChannelsWithNewMessages: channelsWithMessages.length,
            }, null, 2),
          }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid arguments: ${error.errors
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join(", ")}`
      );
    }
    throw error;
  }
});

// Discord client login and error handling
client.once('ready', () => {
  console.error('Discord bot is ready!');
});

// Start the server
async function main() {
  // Check for Discord token
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    throw new Error('DISCORD_TOKEN environment variable is not set');
  }
  
  try {
    // Login to Discord
    await client.login(token);

    // Start MCP server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Discord MCP Server running on stdio");
  } catch (error) {
    console.error("Fatal error in main():", error);
    process.exit(1);
  }
}

main();