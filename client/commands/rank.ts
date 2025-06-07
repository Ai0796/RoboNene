// client/commands/rank.ts
/**
 * @fileoverview The main output when users call for the /rank command
 * Generates a leaderboard snapshot of ~20 users between where you are currently ranked
 * @author Potor10
 */

import * as COMMAND from '../command_data/rank'; // Assuming command_data/rank.ts is converted
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

    const targetOption = interaction.options.getUser('user'); // Get user option
    const targetId = targetOption ? targetOption.id : interaction.user.id; // Use target user's ID or command user's ID

    const userEntry = discordClient.db?.prepare('SELECT * FROM users WHERE discord_id=@discordId').all({
      discordId: targetId
    }) as { sekai_id: string }[] | undefined; // Type assertion for DB result

    if (!userEntry || userEntry.length === 0) {
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

    getRank(COMMAND.INFO.name, interaction, discordClient, {
      targetUserId: userEntry[0].sekai_id,
      eventId: discordClient.getCurrentEvent().id // Ensure eventId is passed
    });
  }
};