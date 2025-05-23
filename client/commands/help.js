/**
 * @fileoverview Show detailed information about other commands
 * @author Potor10
 */

const { SlashCommandBuilder } = require('@discordjs/builders');

const fs = require('fs');
const path = require('path');

const generateEmbed = require('../methods/generateEmbed'); 

// Constants that are used within the command 
const COMMAND_NAME = 'help';

const HELP_CONSTANTS = {
  'BAD COMMAND': {
    type: 'Error',
    message: 'There was a problem in finding your specified command'
  }
};

// Parse commands jsons in current directory
const commands = {};
const commandFiles = fs.readdirSync(path.join(__dirname, '../command_data')).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const COMMAND = require(`${path.join(__dirname, '../command_data')}/${file}`);
  console.log(`Loaded command data ${COMMAND.INFO.name} from ${file}`);
  commands[COMMAND.INFO.name] = COMMAND.INFO;
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
 * @param {Object} commandInfo detailed information about the command
 * @param {String} commandName named of the command
 * @return {String} option string dynamically generated from existing data
 */
const generateOptions = (commandInfo, commandName) => {
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

module.exports = {
  data: slashCommand,
  
  async execute(interaction, discordClient) {
    await interaction.deferReply({
      ephemeral: true
    });

    const commandInfo = commands[interaction.options._hoistedOptions[0].value];
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

  async autocomplete(interaction, discordClient) {

    let focus = interaction.options.getFocused();

    let commandShow = Object.keys(commands).filter((key) => {
      return key.includes(focus.toLowerCase());
    });
    let choices = commandShow.slice(0, 25);

    if (focus == '') {
      await interaction.respond(choices.map((key) => {
        return { name: key, value: key };
      }));

      return;
    }

    await interaction.respond(choices.map((key) => {
      return { name: key, value: key };
    }));
  }
};