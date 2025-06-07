// client/commands/private.ts
/**
 * @fileoverview The main output when users call for the /private command
 * Updates the user information on their profile's desired privacy setting
 * @author Potor10
 */

import * as COMMAND from '../command_data/private'; // Assuming command_data/private.ts is converted
import generateSlashCommand from '../methods/generateSlashCommand';
import generateEmbed from '../methods/generateEmbed';
import DiscordClient from '../client/client'; // Assuming default export
import { CommandInteraction } from 'discord.js'; // Import CommandInteraction

export default {
  ...COMMAND.INFO,
  data: generateSlashCommand(COMMAND.INFO),

  async execute(interaction: CommandInteraction, discordClient: DiscordClient) { // Explicitly type interaction
    // { ephemeral: true }
    await interaction.deferReply({
      ephemeral: COMMAND.INFO.ephemeral
    });

    const db = discordClient.db;

    // Ensure db is not null before proceeding
    if (!db) {
        await interaction.editReply({
            embeds: [
                generateEmbed({
                    name: COMMAND.INFO.name,
                    content: { type: 'Error', message: 'Database not initialized.' },
                    client: discordClient.client
                })
            ]
        });
        return;
    }

    const user = db.prepare('SELECT * FROM users WHERE discord_id=@discordId').all({
      discordId: interaction.user.id
    }) as { discord_id: string }[] | undefined; // Type assertion

    if (!user || user.length === 0) {
      await interaction.editReply({
        embeds: [
          generateEmbed({
            name: COMMAND.INFO.name,
            content: COMMAND.CONSTANTS.NO_ACC_ERROR,
            client: discordClient.client
          })
        ]
      });
      return;
    }

    // Get the boolean value from options
    const enablePrivacy = interaction.options.getBoolean('enable');
    if (enablePrivacy === null) { // Check for null explicitly
      await interaction.editReply({
        embeds: [
          generateEmbed({
            name: COMMAND.INFO.name,
            content: { type: 'Error', message: 'Please specify whether to enable or disable privacy.' },
            client: discordClient.client
          })
        ]
      });
      return;
    }

    db.prepare('UPDATE users SET private=@private WHERE discord_id=@discordId').run({
      private: enablePrivacy ? 1 : 0, // Convert boolean to 1 or 0
      discordId: interaction.user.id
    });

    const content = {
      type: 'Success',
      message: `Private\nStatus: \`\`${enablePrivacy ? 'Enabled' : 'Disabled'}\`\`\n\n` +
        `You can ${enablePrivacy ? 'no longer' : 'now'} see \`Area Item\` and \`Card Level\`` +
        'information when someone uses /profile on your ID'
    };

    await interaction.editReply({
      embeds: [
        generateEmbed({
          name: COMMAND.INFO.name,
          content: content,
          client: discordClient.client
        })
      ]
    });
  }
};