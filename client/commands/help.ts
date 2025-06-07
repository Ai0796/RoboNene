// client/commands/help.ts
/**
 * @fileoverview Show detailed information about other commands
 * @author Potor10
 */

import { SlashCommandBuilder, CommandInteraction, AutocompleteInteraction } from '@discordjs/builders'; // Import AutocompleteInteraction
import * as fs from 'fs';
import * as path from 'path';

import generateEmbed from '../methods/generateEmbed'; // Assuming default export
import { CommandInfo } from '../methods/generateSlashCommand'; // Import CommandInfo interface
import DiscordClient from '../client/client'; // Assuming default export

// Constants that are used within the command
const COMMAND_NAME = 'help';

const HELP_CONSTANTS = {
  'BAD COMMAND': {
    type: 'Error',
    message: 'There was a problem in finding your specified command'
  }
};

// Parse commands jsons in current directory
const commands: { [key: string]: CommandInfo } = {};
const commandFiles = fs.readdirSync(path.join(__dirname, '../command_data')).filter(file => file.endsWith('.ts') || file.endsWith('.js')); // Look for .ts and .js files

for (const file of commandFiles) {
  const COMMAND_DATA_PATH = `${path.join(__dirname, '../command_data')}/${file}`;
  try {
    // Dynamic import to get the INFO object
    import(COMMAND_DATA_PATH).then(module => {
      const commandModule = module as { INFO: CommandInfo }; // Assert module type
      if (commandModule.INFO) {
        commands[commandModule.INFO.name] = commandModule.INFO;
        console.log(`Loaded command data ${commandModule.INFO.name} from ${file}`);
      } else {
        console.warn(`File ${file} does not export INFO object.`);
      }
    }).catch(error => {
      console.error(`Error importing command data from ${file}:`, error);
    });
  } catch (error) {
    console.error(`Error loading command data for ${file}:`, error);
  }
}

const slashCommand = new SlashCommandBuilder()
  .setName(COMMAND_NAME)
  .setDescription('Get help on commands');

slashCommand.addStringOption(op => {
  op.setName('command');
  op.setDescription('The name of the command you would like information on');
  op.setRequired(true);
  op.setAutocomplete(true);

  return op;
});

/**
 * Generate an options string based on the command that we're trying to query
 * @param {CommandInfo} commandInfo detailed information about the command
 * @param {string} commandName named of the command
 * @return {string} option string dynamically generated from existing data
 */
const generateOptions = (commandInfo: CommandInfo, commandName: string): string => {
  let optStr = `\n\`\`/${commandName}`;

  if (commandInfo.params) {
    commandInfo.params.forEach(op => {
      optStr += ` [${op.name}]`;
    });
  }

  optStr += `\`\`\n${commandInfo.description}\n`;

  if (commandInfo.params) {
    commandInfo.params.forEach(op => {
      optStr += `\n\`\`[${op.name}]\`\`\n`;
      optStr += `**Type:** \`\`${op.type.charAt(0).toUpperCase() + op.type.slice(1)}\`\`\n`;
      optStr += `**Required:** \`\`${(op.required) ? 'Yes' : 'No'}\`\`\n`;
      optStr += `**Description:** ${op.description}\n`;
    });
  }

  return optStr;
};

export default {
  data: slashCommand,

  async execute(interaction: CommandInteraction, discordClient: DiscordClient) { // Added types for interaction and discordClient
    await interaction.deferReply({
      ephemeral: true
    });

    // interaction.options._hoistedOptions[0].value gives the command name string
    const commandNameInput = interaction.options.getString('command'); // Safely get string option

    if (!commandNameInput) {
        await interaction.editReply({
            embeds: [
                generateEmbed({
                    name: COMMAND_NAME,
                    content: HELP_CONSTANTS['BAD COMMAND'],
                    client: discordClient.client
                })
            ]
        });
        return;
    }

    const commandInfo = commands[commandNameInput];
    if (!commandInfo) {
      await interaction.editReply({
        embeds: [
          generateEmbed({
            name: COMMAND_NAME,
            content: HELP_CONSTANTS['BAD COMMAND'],
            client: discordClient.client
          })
        ]
      });
      return;
    }
    let content = {
      type: commandInfo.name,
      message: ''
    };

    if (commandInfo.subcommands) {
      content.message += `${commandInfo.description}\n`;
      commandInfo.subcommands.forEach(sc => {
        content.message += generateOptions(sc, `${commandInfo.name} ${sc.name}`);
      });
    } else {
      content.message += generateOptions(commandInfo, commandInfo.name);
    }

    await interaction.editReply({
      embeds: [
        generateEmbed({
          name: COMMAND_NAME,
          content: content,
          client: discordClient.client
        })
      ]
    });
  },

  async autocomplete(interaction: AutocompleteInteraction, discordClient: DiscordClient) { // Added types for interaction and discordClient

    const focus = interaction.options.getFocused();

    const commandShow = Object.keys(commands).filter((key) => {
      return key.includes(focus.toLowerCase());
    });
    const choices = commandShow.slice(0, 25); // Limit to 25 choices for Discord

    await interaction.respond(choices.map((key) => {
      return { name: key, value: key };
    }));
  }
};