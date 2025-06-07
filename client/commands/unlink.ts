// client/commands/unlink.ts
/**
 * @fileoverview The main output when users call for the /unlink command
 * Shows an prompt for the user to unlink their account the the bot
 * @author Potor10
 */

import { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, CommandInteraction, MessageComponentInteraction } from 'discord.js';
import { NENE_COLOR, FOOTER } from '../../constants';

// Assuming command_data/unlink.ts is converted
import * as COMMAND from '../command_data/unlink';
import generateSlashCommand from '../methods/generateSlashCommand';
import generateEmbed from '../methods/generateEmbed';
import DiscordClient from '../client/client'; // Assuming default export
import { Content } from '../methods/generateEmbed'; // Import Content interface

/**
 * Generates the embed that is used when users request an unlink
 * @param {string} code the code that the user needs to enter into their profile to unlink
 * @param {string} accountId the ID of the account that is trying to unlink from the bot
 * @param {number} expires in epochseconds before the linking expires
 * @param {Content | undefined} content the message body within the unlink embed (ex: success, or failure)
 * @param {DiscordClient['client']} client we are using to interact with disc
 * @return {EmbedBuilder} embed that we recieve to display to the user
 */
const generateUnlinkEmbed = ({ code, accountId, expires, content, client }: { code: string; accountId: string; expires: number; content?: Content; client: DiscordClient['client'] }): EmbedBuilder => {
  const unlinkInformation = {
    type: 'Unlink Information',
    message: `Unlink Code: \`${code}\`\n` +
      `Account ID: \`${accountId}\`\n` +
      `Expires: <t:${Math.floor(expires / 1000)}>`
  };

  const unlinkEmbed = new EmbedBuilder()
    .setColor(NENE_COLOR)
    .setTitle(COMMAND.INFO.name.charAt(0).toUpperCase() + COMMAND.INFO.name.slice(1))
    .addFields(
      { name: unlinkInformation.type, value: unlinkInformation.message },
      { name: COMMAND.CONSTANTS.UNLINK_INSTRUCTIONS.type, value: COMMAND.CONSTANTS.UNLINK_INSTRUCTIONS.message }
    )
    .setImage(COMMAND.CONSTANTS.UNLINK_IMG)
    .setThumbnail(client.user?.displayAvatarURL() || '') // Optional chaining for user
    .setTimestamp()
    .setFooter({ text: FOOTER, iconURL: client.user?.displayAvatarURL() || '' }); // Optional chaining for user

  if (content) {
    unlinkEmbed.addFields({ name: content.type, value: content.message });
  }

  return unlinkEmbed;
};

export default {
  ...COMMAND.INFO,
  data: generateSlashCommand(COMMAND.INFO),

  async execute(interaction: CommandInteraction, discordClient: DiscordClient) { // Explicitly type interaction
    await interaction.deferReply({
      ephemeral: COMMAND.INFO.ephemeral
    });

    const db = discordClient.db;
    // Safely get accountId from options; replace(/\D/g, '') to strip non-digits
    const accountId = (interaction.options.getString('id') || '').replace(/\D/g, '');

    if (!accountId) {
      await interaction.editReply({
        embeds: [
          generateEmbed({
            name: COMMAND.INFO.name,
            content: COMMAND.CONSTANTS.BAD_ID_ERR,
            client: discordClient.client
          })
        ]
      });
      return;
    }

    // Check if the Sekai ID is already linked in the DB
    const sekaiCheck = db?.prepare('SELECT * FROM users WHERE sekai_id=@sekaiId').all({
      sekaiId: accountId
    }) as { discord_id: string }[] | undefined; // Type assertion

    // User exists in the database
    if (!sekaiCheck || sekaiCheck.length === 0) {
      await interaction.editReply({
        embeds: [
          generateEmbed({
            name: COMMAND.INFO.name,
            content: COMMAND.CONSTANTS.NO_SEKAI_ERR,
            client: discordClient.client
          })
        ]
      });
      return;
    }

    // Check if the Sekai ID is linked to the current Discord user's ID
    if (sekaiCheck[0].discord_id === interaction.user.id) {
      db.prepare('DELETE FROM users WHERE sekai_id=@sekaiId').run({
        sekaiId: accountId
      });

      await interaction.editReply('Unlinked your account!');
      return;
    }

    if (!discordClient.checkRateLimit(interaction.user.id)) {
      await interaction.editReply({
        embeds: [generateEmbed({
          name: COMMAND.INFO.name,
          content: {
            type: COMMAND.CONSTANTS.RATE_LIMIT_ERR.type,
            message: COMMAND.CONSTANTS.RATE_LIMIT_ERR.message +
              `\n\nExpires: <t:${Math.floor(discordClient.getRateLimitRemoval(interaction.user.id) / 1000)}>`
          },
          client: discordClient.client
        })]
      });
      return;
    }

    const code = Math.random().toString(36).slice(-5); // Generate a random 5-character code
    const expires = Date.now() + COMMAND.CONSTANTS.INTERACTION_TIME;

    const unlinkButton = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(new ButtonBuilder()
        .setCustomId('unlink')
        .setLabel('UNLINK')
        .setStyle(ButtonStyle.Danger) // Red button
        .setEmoji(COMMAND.CONSTANTS.UNLINK_EMOJI));

    const unlinkMessage = await interaction.editReply({
      embeds: [
        generateUnlinkEmbed({
          code: code,
          accountId: accountId,
          expires: expires,
          client: discordClient.client
        })
      ],
      components: [unlinkButton],
      fetchReply: true
    });

    let unlinked = false;

    const filter = (i: MessageComponentInteraction) => {
      return i.customId === 'unlink';
    };

    const collector = unlinkMessage.createMessageComponentCollector({
      filter,
      time: COMMAND.CONSTANTS.INTERACTION_TIME
    });

    collector.on('collect', async (i) => {
      // Update the button state immediately to prevent multiple clicks
      await i.update({
        embeds: [
          generateUnlinkEmbed({
            code: code,
            accountId: accountId,
            expires: expires,
            client: discordClient.client
          })
        ],
        components: [] // Remove components after click
      });

      if (!discordClient.checkRateLimit(interaction.user.id)) {
        await interaction.editReply({
          embeds: [
            generateUnlinkEmbed({
              code: code,
              accountId: accountId,
              expires: expires,
              content: {
                type: COMMAND.CONSTANTS.RATE_LIMIT_ERR.type,
                message: COMMAND.CONSTANTS.RATE_LIMIT_ERR.message +
                  `\n\nExpires: <t:${Math.floor(discordClient.getRateLimitRemoval(interaction.user.id) / 1000)}>`
              },
              client: discordClient.client
            })
          ],
          components: []
        });
        return;
      }

      discordClient.addSekaiRequest('profile', {
        userId: accountId
      }, async (response: any) => { // Type response as any for Sekai profile response
        if (response.userProfile.word === code) {
          db?.prepare('DELETE FROM users WHERE sekai_id=@sekaiId').run({
            sekaiId: accountId
          });

          unlinked = true;

          await interaction.editReply({
            embeds: [
              generateUnlinkEmbed({
                code: code,
                accountId: accountId,
                expires: expires,
                content: COMMAND.CONSTANTS.UNLINK_SUCC,
                client: discordClient.client
              })
            ],
            components: []
          });
        } else {
          await interaction.editReply({
            embeds: [
              generateUnlinkEmbed({
                code: code,
                accountId: accountId,
                expires: expires,
                content: COMMAND.CONSTANTS.BAD_CODE_ERR(response.userProfile.word),
                client: discordClient.client
              })
            ],
            components: [unlinkButton] // Re-enable button on bad code
          });
        }
      }, async (err: any) => { // Type err as any
        // Log the error
        discordClient.logger?.log({
          level: 'error',
          timestamp: Date.now(),
          message: err.toString()
        });

        // Account could not be found or other API error
        await interaction.editReply({
          embeds: [
            generateUnlinkEmbed({
              code: code,
              accountId: accountId,
              expires: expires,
              content: { type: 'error', message: err.toString() },
              client: discordClient.client
            })
          ],
          components: []
        });
      });
    });

    collector.on('end', async () => {
      // No Response or timed out
      if (!unlinked) {
        await interaction.editReply({
          embeds: [
            generateUnlinkEmbed({
              code: code,
              accountId: accountId,
              expires: expires,
              content: COMMAND.CONSTANTS.EXPIRED_CODE_ERR,
              client: discordClient.client
            })
          ],
          components: []
        });
      }
    });
  }
};