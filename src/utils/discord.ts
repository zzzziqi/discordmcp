import { Client, GuildTextBasedChannel } from 'discord.js';

// Helper function to find a guild by name or ID
export async function findGuild(client: Client, guildIdentifier?: string) {
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
export async function findChannel(client: Client, channelIdentifier: string, guildIdentifier?: string): Promise<GuildTextBasedChannel> {
  const guild = await findGuild(client, guildIdentifier);
  
  // First try to fetch by ID
  try {
    const channel = await client.channels.fetch(channelIdentifier);
    // Check if it's a valid text-based channel (Text, News, Thread, Voice with text)
    if (channel && 'guild' in channel && channel.guild.id === guild.id && channel.isTextBased()) {
      return channel as GuildTextBasedChannel;
    }
  } catch {
    // If fetching by ID fails, search by name in the specified guild
    // We search across all cached channels including threads if possible, but 
    // guild.channels.cache usually contains guild channels. Threads are in guild.channels.cache (active ones) or can be fetched.
    // For simplicity, we filter the cache for now.
    
    const channels = guild.channels.cache.filter(
      (channel): channel is GuildTextBasedChannel => 
        channel.isTextBased() &&
        (channel.name.toLowerCase() === channelIdentifier.toLowerCase() ||
         channel.name.toLowerCase() === channelIdentifier.toLowerCase().replace('#', ''))
    );

    if (channels.size === 0) {
      const availableChannels = guild.channels.cache
        .filter((c): c is GuildTextBasedChannel => c.isTextBased())
        .map(c => `"#${c.name}"`).join(', ');
      throw new Error(`Channel "${channelIdentifier}" not found in server "${guild.name}". Available channels: ${availableChannels}`);
    }
    if (channels.size > 1) {
      const channelList = channels.map(c => `#${c.name} (${c.id})`).join(', ');
      throw new Error(`Multiple channels found with name "${channelIdentifier}" in server "${guild.name}": ${channelList}. Please specify the channel ID.`);
    }
    return channels.first()!;
  }
  throw new Error(`Channel "${channelIdentifier}" is not a text-based channel or not found in server "${guild.name}"`);
}

// Helper function to parse relative time strings
export function parseRelativeTime(timeStr: string): Date {
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

// Helper function to convert a Date object to a Discord Snowflake
export function dateToSnowflake(date: Date): string {
  const DISCORD_EPOCH = 1420070400000;
  const timestamp = date.getTime();
  
  // Discord Snowflakes are 64-bit integers.
  // The first 42 bits are the timestamp (milliseconds since Discord Epoch).
  // We shift the timestamp left by 22 bits to create the snowflake.
  // Since JS bitwise operators work on 32-bit integers, we use BigInt.
  const snowflake = (BigInt(timestamp) - BigInt(DISCORD_EPOCH)) << 22n;
  
  return snowflake.toString();
}
