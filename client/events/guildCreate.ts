// client/events/guildCreate.ts
/**
 * @fileoverview Event handler that is run whenever the bot joins a guild
 * Updates the bot's status to reflect that it has joined a new server
 * @author Potor10
 */

import { Guild, Client, ActivityType } from 'discord.js'; // Import Guild and ActivityType
import { BOT_ACTIVITY } from '../../constants';
import DiscordClient from '../client'; // Assuming default export

export default {
  name: 'guildCreate',
  execute(guild: Guild, discordClient: DiscordClient) { // Explicitly type guild as Guild
    discordClient.logger?.log({ // Optional chaining for logger
      level: 'info',
      guild_id: guild.id,
      guild_name: guild.name,
      timestamp: Date.now(),
      message: `Added to ${guild.name} (id: ${guild.id})`
    });

    const client: Client = discordClient.client; // Explicitly type client as Client
    client.user?.setActivity(BOT_ACTIVITY() + // Optional chaining for user
      `${client.guilds.cache.size} ${(client.guilds.cache.size > 1) ? 'servers' : 'server'}`, { type: ActivityType.Playing }); // Specify activity type
  }
};