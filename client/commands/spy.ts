// client/commands/spy.ts
/**
 * @fileoverview The main output when users call for the /spy command
 * Generates a leaderboard snapshot of ~20 users between a specified user ID, or a specific rank
 * @author Potor10
 */

import { ERR_COMMAND } from '../../constants'; // Assuming ERR_COMMAND is exported from constants
import * as COMMAND from '../command_data/spy'; // Assuming command_data/spy.ts is converted
import generateSlashCommand from '../methods/generateSlashCommand';
import getRank from '../methods/getRank'; // Assuming getRank.ts is converted
import generateEmbed from '../methods/generateEmbed';
import DiscordClient from '../client/client'; // Assuming default export
import { CommandInteraction } from 'discord.js'; // Import CommandInteraction

export default {
  ...COMMAND.INFO,
  data: generateSlashCommand(COMMAND.INFO), // Ensure data is set by generateSlashCommand

  async execute(interaction: CommandInteraction, discordClient: DiscordClient) { // Explicitly type interaction
    await interaction.deferReply({
      ephemeral: COMMAND.INFO.ephemeral
    });

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'player') {
      const accountId = (interaction.options.getString('id') || '').replace(/\D/g, ''); // Get ID string
      if (!accountId) {
        // Do something because there is an empty account id input
        await interaction.editReply({
          embeds: [
            generateEmbed({
              name: COMMAND.INFO.name,
              content: COMMAND.CONSTANTS.BAD_ID_ERR,
              client: discordClient.client
            })
          ]
        });
      } else {
        getRank(COMMAND.INFO.name, interaction, discordClient, {
          targetUserId: accountId,
          eventId: discordClient.getCurrentEvent().id // Ensure eventId is passed
        });
      }
    } else if (subcommand === 'tier') {
      const tier = interaction.options.getInteger('tier'); // Get integer tier
      if (tier === null) {
        await interaction.editReply({
          embeds: [
            generateEmbed({
              name: COMMAND.INFO.name,
              content: COMMAND.CONSTANTS.BAD_INPUT_ERROR, // Assuming BAD_INPUT_ERROR exists in COMMAND.CONSTANTS
              client: discordClient.client
            })
          ]
        });
        return;
      }
      getRank(COMMAND.INFO.name, interaction, discordClient, {
        targetRank: tier,
        eventId: discordClient.getCurrentEvent().id // Ensure eventId is passed
      });
    } else {
      await interaction.editReply({
        embeds: [
          generateEmbed({
            name: COMMAND.INFO.name,
            content: ERR_COMMAND,
            client: discordClient.client
          })
        ]
      });
    }
  }
};