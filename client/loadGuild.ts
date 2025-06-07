// client/loadGuild.ts
/**
 * @fileoverview Load all commands from a bot on a specific server on discord
 * @author Potor10
 */

import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { token, clientId } from '../config'; // Import from TS config
import * as fs from 'fs';
import * as path from 'path';
import { CommandInfo } from './methods/generateSlashCommand'; // Import CommandInfo interface

// Place your guild ids here
const guildId = '811492424626208798'; // Replace with your actual guild ID

const commands: { data: CommandInfo }[] = []; // Specify type for commands array
const commandFiles = fs.readdirSync(path.join(__dirname, '/commands')).filter(file => file.endsWith('.ts') || file.endsWith('.js')); // Look for .ts and .js files

// Parse commands
for (const file of commandFiles) {
  // Dynamic import
  const commandPath = `./commands/${file}`;
  import(commandPath).then(module => {
    const command = module.default || module; // Handle both default and named exports
    if (command.data === null || command.data === undefined) {
      console.log(`Command ${file} does not have a data object, Skipping Load.`);
      return;
    }
    console.log(`Loaded command ${command.data.name} from ${file}`);
    commands.push(command);
  }).catch(error => {
    console.error(`Error loading command from ${file}:`, error);
  });
}

// Register the slash commands with Discord
const rest = new REST({ version: '9' }).setToken(token);
(async () => {
  try {
    const commandNames = commands.map(c => c.data.name);
    console.log(`Started refreshing application (/) commands: ${commandNames.join(', ')}`);

    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands.map(c => c.data.toJSON()) },
    );

    console.log(`Successfully reloaded application (/) commands: ${commandNames.join(', ')}`);
  } catch (error) {
    console.error(error);
  }
})();