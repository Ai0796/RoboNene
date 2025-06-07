// client/events/ready.ts
/**
 * @fileoverview Event handler that is run whenever the bot starts
 * Updates the bot's status to reflect how many servers it has joined
 * @author Potor10
 */

import { Client, ActivityType } from 'discord.js'; // Import ActivityType
import { BOT_ACTIVITY } from '../../constants';

export default {
  name: 'ready',
  once: true,
  execute(client: Client) { // Explicitly type client as Client
    console.log(`Ready on ${client.guilds.cache.size} servers, for a total of ${client.users.cache.size} users`);
    // for (const guild of client.guilds.cache.values()) {
    //   console.log(` - ${guild.name} Member Count: ${guild.memberCount} (${guild.id})`);
    // }
    client.user?.setActivity(BOT_ACTIVITY() + // Optional chaining for user
      `${client.guilds.cache.size} ${(client.guilds.cache.size > 1) ? 'servers' : 'server'}`, { type: ActivityType.Playing }); // Specify activity type
  }
};