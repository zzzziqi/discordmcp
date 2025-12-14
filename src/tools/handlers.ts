import { Client, TextChannel, ForumChannel, NewsChannel, ThreadChannel } from 'discord.js';
import {
  SendMessageSchema,
  ReadMessagesSchema,
  ListChannelsSchema,
  ListChannelsWithNewMessagesSchema,
  SendMessageArgs,
  ReadMessagesArgs,
  ListChannelsArgs,
  ListChannelsWithNewMessagesArgs,
} from './types.js';
import { findChannel, findGuild, parseRelativeTime, dateToSnowflake } from '../utils/discord.js';

export class ToolHandlers {
  constructor(private client: Client) {}

  async sendMessage(args: unknown) {
    const { channel: channelIdentifier, message } = SendMessageSchema.parse(args) as SendMessageArgs;
    const channel = await findChannel(this.client, channelIdentifier);
    
    const sent = await channel.send(message);
    return {
      content: [{
        type: "text" as const,
        text: `Message sent successfully to #${channel.name} in ${channel.guild.name}. Message ID: ${sent.id}`,
      }],
    };
  }

  async readMessages(args: unknown) {
    const { channel: channelIdentifier, limit } = ReadMessagesSchema.parse(args) as ReadMessagesArgs;
    const channel = await findChannel(this.client, channelIdentifier);
    
    const messages = await channel.messages.fetch({ limit });
    const formattedMessages = Array.from(messages.values()).map((msg: any) => ({
      channel: `#${channel.name}`,
      server: channel.guild.name,
      author: msg.author.tag,
      content: msg.content,
      timestamp: msg.createdAt.toISOString(),
    }));

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify(formattedMessages, null, 2),
      }],
    };
  }

  async listChannels(args: unknown) {
    const { server: guildIdentifier } = ListChannelsSchema.parse(args) as ListChannelsArgs;
    const guild = await findGuild(this.client, guildIdentifier);
    
    const channels = await Promise.all(guild.channels.cache
      .filter((channel) => 
        channel instanceof TextChannel || 
        channel instanceof NewsChannel || 
        channel instanceof ForumChannel
      )
      .map(async (channel) => {
        const base = {
          id: channel.id,
          name: channel.name,
          type: channel.type,
          parent: channel.parent?.name,
          position: channel.position,
          topic: (channel as TextChannel | ForumChannel | NewsChannel).topic || '',
          nsfw: (channel as TextChannel | ForumChannel | NewsChannel).nsfw,
        };

        if (channel instanceof ForumChannel) {
          const threads = await Promise.all(channel.threads.cache.map(async (thread) => {
            let lastMessage = thread.lastMessage;
            if (!lastMessage && thread.lastMessageId) {
              try {
                lastMessage = await thread.messages.fetch(thread.lastMessageId);
              } catch (e) {
                console.error(`Failed to fetch last message for thread #${thread.name}:`, e);
              }
            }

            return {
              id: thread.id,
              name: thread.name,
              messageCount: thread.messageCount,
              lastMessageId: thread.lastMessageId,
              lastMessage: lastMessage ? {
                content: lastMessage.content,
                author: lastMessage.author?.tag,
                timestamp: lastMessage.createdAt ? lastMessage.createdAt.toISOString() : new Date().toISOString(),
              } : null,
            };
          }));

          return {
            ...base,
            type: 'forum',
            threadCount: channel.threads.cache.size,
            threads,
          };
        }

        const textChannel = channel as TextChannel | NewsChannel;
        let lastMessage = textChannel.lastMessage;

        if (!lastMessage && textChannel.lastMessageId) {
          try {
            lastMessage = await textChannel.messages.fetch(textChannel.lastMessageId);
          } catch (e) {
            // Ignore fetch errors (e.g. message deleted or no permission)
            console.error(`Failed to fetch last message for #${channel.name}:`, e);
          }
        }

        return {
          ...base,
          type: channel instanceof NewsChannel ? 'news' : 'text',
          lastMessage: lastMessage ? {
            content: lastMessage.content,
            author: lastMessage.author?.tag,
            timestamp: lastMessage.createdAt ? lastMessage.createdAt.toISOString() : new Date().toISOString(), // Fallback or handle null safely
          } : null,
        };
      }));

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          server: guild.name,
          serverId: guild.id,
          channels: channels,
          totalChannels: channels.length,
        }, null, 2),
      }],
    };
  }

  async listChannelsWithNewMessages(args: unknown) {
    const { server: guildIdentifier, since } = ListChannelsWithNewMessagesSchema.parse(args) as ListChannelsWithNewMessagesArgs;
    const guild = await findGuild(this.client, guildIdentifier);
    const sinceDate = parseRelativeTime(since);
    // Generate a snowflake for the since date. 
    // We subtract 1ms to ensure we include messages exactly at the sinceDate if any.
    // 'after' in Discord API fetches messages strictly after the ID.
    const afterSnowflake = dateToSnowflake(new Date(sinceDate.getTime() - 1));
    
    const textChannels = guild.channels.cache
      .filter((channel) => 
        channel instanceof TextChannel || 
        channel instanceof NewsChannel || 
        channel instanceof ForumChannel
      );

    const channelsWithMessages = [];
    
    for (const [, channel] of textChannels) {
      try {
        if (channel instanceof ForumChannel) {
          // For Forum Channels, we need to check active threads
          const threads = channel.threads.cache.values();
          for (const thread of threads) {
            try {
              // Fetch messages after the calculated snowflake
              const messages = await thread.messages.fetch({ limit: 100, after: afterSnowflake });
              // Double check timestamps (API should be correct but good verify) and filter is cheap now
              const newMessages = messages.filter((msg: any) => msg.createdAt >= sinceDate);
              
              if (newMessages.size > 0) {
                channelsWithMessages.push({
                  id: thread.id,
                  name: `[Forum: ${channel.name}] ${thread.name}`,
                  messageCount: newMessages.size,
                  lastMessageAt: newMessages.first()?.createdAt.toISOString(),
                  oldestNewMessageAt: newMessages.last()?.createdAt.toISOString(),
                });
              }
            } catch (error) {
              console.error(`Error fetching messages from thread #${thread.name}:`, error);
            }
          }
        } else {
          // Regular Text/News Channels
          // Fetch messages since the specified time using 'after'
          const messages = await (channel as TextChannel | NewsChannel).messages.fetch({ limit: 100, after: afterSnowflake });
          const newMessages = messages.filter((msg: any) => msg.createdAt >= sinceDate);
          
          if (newMessages.size > 0) {
            channelsWithMessages.push({
              id: channel.id,
              name: channel.name,
              messageCount: newMessages.size,
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
        type: "text" as const,
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
}
