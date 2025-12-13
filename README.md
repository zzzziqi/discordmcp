# Discord MCP Server

A Model Context Protocol (MCP) server that enables LLMs to interact with Discord channels, allowing them to send and read messages through Discord's API. Using this server, LLMs like Claude can directly interact with Discord channels while maintaining user control and security.

## Features

- Send messages to Discord channels
- Read recent messages from channels
- Automatic server and channel discovery
- Support for both channel names and IDs
- Proper error handling and validation

## Prerequisites

- Node.js 16.x or higher
- A Discord bot token
- The bot must be invited to your server with proper permissions:
  - Read Messages/View Channels
  - Send Messages
  - Read Message History

## Setup

1. Clone this repository:
```bash
git clone https://github.com/yourusername/discordmcp.git
cd discordmcp
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with your Discord bot token:
```
DISCORD_TOKEN=your_discord_bot_token_here
```

4. Build the server:
```bash
npm run build
```

## Usage with Claude for Desktop

1. Open your Claude for Desktop configuration file:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

2. Add the Discord MCP server configuration:
```json
{
  "mcpServers": {
    "discord": {
      "command": "node",
      "args": ["path/to/discordmcp/build/index.js"],
      "env": {
        "DISCORD_TOKEN": "your_discord_bot_token_here"
      }
    }
  }
}
```

3. Restart Claude for Desktop

## Available Tools

### send-message
Sends a message to a specified Discord channel.

Parameters:
- `server` (optional): Server name or ID (required if bot is in multiple servers)
- `channel`: Channel name (e.g., "general") or ID
- `message`: Message content to send

Example:
```json
{
  "channel": "general",
  "message": "Hello from MCP!"
}
```

### read-messages
Reads recent messages from a specified Discord channel.

Parameters:
- `server` (optional): Server name or ID (required if bot is in multiple servers)
- `channel`: Channel name (e.g., "general") or ID
- `limit` (optional): Number of messages to fetch (default: 50, max: 100)

Example:
```json
{
  "channel": "general",
  "limit": 10
}
```

### list-channels
Lists all text channels in a Discord server.

Parameters:
- `server` (optional): Server name or ID (required if bot is in multiple servers)

Example:
```json
{
  "server": "My Server"
}
```

Returns:
- Server name and ID
- List of all text channels with their ID, name, topic, and NSFW status
- Total channel count

### list-channels-with-new-messages
Lists all channels that have received new messages since a specified time, including the message count for each channel.

Parameters:
- `server` (optional): Server name or ID (required if bot is in multiple servers)
- `since`: Time threshold in ISO 8601 format (e.g., "2024-01-01T00:00:00Z") or relative time (e.g., "1h" for 1 hour ago, "24h" for 24 hours ago, "7d" for 7 days ago)

Example:
```json
{
  "since": "24h"
}
```

Or with absolute time:
```json
{
  "since": "2024-12-14T00:00:00Z"
}
```

Returns:
- Server name and ID
- Time threshold used
- List of channels with new messages, sorted by message count (descending)
- For each channel: ID, name, message count, timestamp of newest and oldest new message
- Total count of channels with new messages

## Development

1. Install development dependencies:
```bash
npm install --save-dev typescript @types/node
```

2. Start the server in development mode:
```bash
npm run dev
```

## Testing

You can test the server using the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node build/index.js
```

## Examples

Here are some example interactions you can try with Claude after setting up the Discord MCP server:

1. "Can you read the last 5 messages from the general channel?"
2. "Please send a message to the announcements channel saying 'Meeting starts in 10 minutes'"
3. "What were the most recent messages in the development channel about the latest release?"
4. "Show me all channels in the server"
5. "Which channels have had new messages in the last 24 hours?"
6. "List all channels with activity in the past week"

Claude will use the appropriate tools to interact with Discord while asking for your approval before sending any messages.

## Security Considerations

- The bot requires proper Discord permissions to function
- All message sending operations require explicit user approval
- Environment variables should be properly secured
- Token should never be committed to version control
- Channel access is limited to channels the bot has been given access to

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues or have questions:
1. Check the GitHub Issues section
2. Consult the MCP documentation at https://modelcontextprotocol.io
3. Open a new issue with detailed reproduction steps