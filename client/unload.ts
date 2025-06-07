// client/unload.ts
/**
 * @fileoverview Removes all commands from a bot into a global cache on Discord
 * May take a while to update, due to Discord's caching system
 * @author Potor10
 */

import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { token, clientId } from '../config'; // Import from TS config

// Register the slash commands with Discord
const rest = new REST({ version: '9' }).setToken(token);
rest.get(Routes.applicationCommands(clientId))
  .then(async (data: any[]) => { // Type data as any array as discord-api-types might not have specific types
    for (const command of data) {
      const deleteUrl = `${Routes.applicationCommands(clientId)}/${command.id}`;
      await rest.delete(deleteUrl);
      console.log(`deleted ${command.name} at ${deleteUrl}`);
    }
  }).catch(error => {
    console.error('Error fetching or deleting commands:', error);
  });