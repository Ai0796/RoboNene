// client/commands/tracking.ts
/**
 * @fileoverview The main output when users call for the /tracking command
 * Enables or disables 2-minute or 1-hour tracking for a specific channel within the server
 * @author Potor10
 */

import * as COMMAND from '../command_data/tracking'; // Assuming command_data/tracking.ts is converted
import generateSlashCommand from '../methods/generateSlashCommand';
import generateEmbed from '../methods/generateEmbed';
import { PermissionsBitField, CommandInteraction, TextChannel } from 'discord.js'; // Import necessary types
import DiscordClient from '../client/client'; // Assuming default export

export default {
  ...COMMAND.INFO,
  data: generateSlashCommand(COMMAND.INFO),

  async execute(interaction: CommandInteraction, discordClient: DiscordClient) { // Explicitly type interaction
    await interaction.deferReply({
      ephemeral: COMMAND.INFO.ephemeral
    });

    const channelOption = interaction.options.getChannel('channel');

    if (!channelOption || !(channelOption instanceof TextChannel)) { // Check if it's a valid TextChannel
      await interaction.editReply({
        embeds: [
          generateEmbed({
            name: COMMAND.INFO.name,
            content: COMMAND.CONSTANTS.INVALID_CHANNEL_ERR,
            client: discordClient.client
          })
        ]
      });
      return;
    }

    const channel = channelOption as TextChannel; // Assert it's a TextChannel
    const enableTracking = interaction.options.getBoolean('enable');
    const trackingType = interaction.options.getInteger('time');

    if (enableTracking === null || trackingType === null) {
      await interaction.editReply({
        embeds: [
          generateEmbed({
            name: COMMAND.INFO.name,
            content: { type: 'Error', message: 'Please provide both enable status and time interval.' },
            client: discordClient.client
          })
        ]
      });
      return;
    }

    const db = discordClient.db;
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

    if (enableTracking) {
      // Check bot's permissions in the selected channel
      const botMember = interaction.guild?.members.me;
      if (!botMember) {
          await interaction.editReply({
              embeds: [
                  generateEmbed({
                      name: COMMAND.INFO.name,
                      content: { type: 'Error', message: 'Could not find bot\'s member in this guild.' },
                      client: discordClient.client
                  })
              ]
          });
          return;
      }
      const permsInChannel = channel.permissionsFor(botMember);

      if (!permsInChannel || !permsInChannel.has(PermissionsBitField.Flags.SendMessages) || !permsInChannel.has(PermissionsBitField.Flags.EmbedLinks)) {
        await interaction.editReply({
          embeds: [
            generateEmbed({
              name: COMMAND.INFO.name,
              content: COMMAND.CONSTANTS.NO_PERMISSIONS_ERR,
              client: discordClient.client
            })
          ]
        });
        return;
      }

      db.prepare('REPLACE INTO tracking (channel_id, guild_id, tracking_type) ' +
        'VALUES (@channelId, @guildId, @trackingType)').run({
          channelId: channel.id,
          guildId: channel.guildId,
          trackingType: trackingType
        });

      const content = {
        type: 'Success',
        message: `Alert Type: \`\`${trackingType} min\`\`\n` +
          'Status: ``Enabled``\n' +
          `Channel: \`\`${channel.name}\`\`\n` +
          `Guild: \`\`${channel.guild.name}\`\``
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
    } else { // Disable tracking
      const query = db.prepare('DELETE FROM tracking WHERE ' +
        'guild_id=@guildId AND channel_id=@channelId AND tracking_type=@trackingType').run({
          guildId: channel.guildId,
          channelId: channel.id,
          trackingType: trackingType
        });

      if (query.changes === 1) {
        const content = {
          type: 'Success',
          message: `Alert Type: \`\`${trackingType} min\`\`\n` +
            'Status: ``Disabled``\n' +
            `Channel: \`\`${channel.name}\`\`\n` +
            `Guild: \`\`${channel.guild.name}\`\``
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
      } else {
        await interaction.editReply({
          embeds: [
            generateEmbed({
              name: COMMAND.INFO.name,
              content: COMMAND.CONSTANTS.NO_TRACKING_ERR,
              client: discordClient.client
            })
          ]
        });
      }
    }
  }
};