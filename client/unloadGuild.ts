// client/unloadGuild.ts
/**
 * @fileoverview Removes all commands from a bot on a specific server on discord
 * @author Potor10
 */

import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { token, clientId } from '../config'; // Import from TS config

// Place your guild ids here
const guildId = '811492424626208798'; // Replace with your actual guild ID

// Register the slash commands with Discord
const rest = new REST({ version: '9' }).setToken(token);
rest.get(Routes.applicationGuildCommands(clientId, guildId))
  .then(async (data: any[]) => { // Type data as any array as discord-api-types might not have specific types
    for (const command of data) {
      const deleteUrl = `${Routes.applicationGuildCommands(clientId, guildId)}/${command.id}`;
      await rest.delete(deleteUrl);
      console.log(`deleted ${command.name} at ${deleteUrl}`);
    }
  }).catch(error => {
    console.error('Error fetching or deleting guild commands:', error);
  });