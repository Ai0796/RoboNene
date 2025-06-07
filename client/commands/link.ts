// client/commands/link.ts
import { ActionRowBuilder, ButtonBuilder, EmbedBuilder, ButtonStyle, CommandInteraction, MessageComponentInteraction } from 'discord.js';
import { NENE_COLOR, FOOTER } from '../../constants';

// Assuming command_data/link.ts has been converted and exported properly
import * as COMMAND from '../command_data/link';
import generateSlashCommand from '../methods/generateSlashCommand';
import generateEmbed from '../methods/generateEmbed';
import DiscordClient from '../client/client'; // Assuming default export

// Helper function to check if a member has admin permissions
function isAdmin(interaction: CommandInteraction): boolean {
  try {
    // interaction.member is GuildMember | APIInteractionGuildMember | null
    // Check if interaction.member exists and has permissions property
    if (interaction.member && interaction.member.permissions) {
      // interaction.member.permissions can be a PermissionsBitField
      return (interaction.member.permissions as PermissionsBitField).has('Administrator');
    }
    return false;
  } catch (e) {
    console.error('Error checking admin permissions:', e);
    return false;
  }
}

export default {
  ...COMMAND.INFO,
  data: generateSlashCommand(COMMAND.INFO),

  async execute(interaction: CommandInteraction, discordClient: DiscordClient) {
    await interaction.deferReply({
      ephemeral: COMMAND.INFO.ephemeral
    });

    const db = discordClient.db;
    // Safely get accountId from options; replace(/\D/g, '') to strip non-digits
    const accountId = (interaction.options.getString('id') || '').replace(/\D/g, '');
    const userId = interaction.options.getString('discordid'); // This is a string, not a User object

    if (userId && isAdmin(interaction)) {
      // Admin bypass for linking arbitrary Discord ID to Sekai ID
      if (db) {
        db.prepare('REPLACE INTO users (discord_id, sekai_id) ' +
          'VALUES(@discordId, @sekaiId)').run({
            discordId: userId,
            sekaiId: accountId
          });
        await interaction.editReply('Added');
      } else {
        await interaction.editReply({
          embeds: [
            generateEmbed({
              name: COMMAND.INFO.name,
              content: { type: 'Error', message: 'Database not initialized.' },
              client: discordClient.client
            })
          ]
        });
      }
      return;
    }

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
      return;
    }

    // Check if current Discord user or provided Sekai ID is already linked
    const users = db?.prepare('SELECT * FROM users WHERE ' +
      'discord_id=@discordId OR sekai_id=@sekaiId').all({
        discordId: interaction.user.id,
        sekaiId: accountId
      }) as { discord_id: string; sekai_id: string }[] | undefined; // Type assertion

    if (users && users.length) {
      // User is already linked
      if (users[0].discord_id === interaction.user.id) {
        await interaction.editReply({
          embeds: [
            generateEmbed({
              name: COMMAND.INFO.name,
              content: COMMAND.CONSTANTS.DISCORD_LINKED_ERR,
              client: discordClient.client
            })
          ]
        });
      }
      // Sekai id is already linked
      else if (users[0].sekai_id === accountId) {
        await interaction.editReply({
          embeds: [
            generateEmbed({
              name: COMMAND.INFO.name,
              content: COMMAND.CONSTANTS.SEKAI_LINKED_ERR,
              client: discordClient.client
            })
          ]
        });
      }
      // General Error
      else {
        await interaction.editReply({
          embeds: [
            generateEmbed({
              name: COMMAND.INFO.name,
              content: COMMAND.ERR_COMMAND, // Assuming ERR_COMMAND is available from constants or command_data
              client: discordClient.client
            })
          ]
        });
      }
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

    // No Errors, proceed with link process
    discordClient.addSekaiRequest('profile', {
      userId: accountId
    }, async (response: any) => { // Type response as any for Sekapi profile response
      // Generate a new code for the user
      const code = Math.random().toString(36).slice(-5);
      const expires = Date.now() + COMMAND.CONSTANTS.INTERACTION_TIME;

      const linkButton = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(new ButtonBuilder()
          .setCustomId('link')
          .setLabel('LINK')
          .setStyle(ButtonStyle.Success)
          .setEmoji(COMMAND.CONSTANTS.LINK_EMOJI));

      const linkMessage = await interaction.editReply({
        embeds: [
          generateEmbed({
            name: COMMAND.INFO.name,
            content: {
              type: COMMAND.CONSTANTS.LINK_INSTRUCTIONS.type,
              message: COMMAND.CONSTANTS.LINK_INSTRUCTIONS.message + `\nLink Code: \`${code}\`\nAccount ID: \`${accountId}\`\nExpires: <t:${Math.floor(expires / 1000)}>`
            },
            client: discordClient.client
          })
        ],
        components: [linkButton],
        fetchReply: true
      });

      let linked = false;
      let limited = false;

      const filter = (i: MessageComponentInteraction) => {
        return i.customId === 'link';
      };

      const collector = linkMessage.createMessageComponentCollector({
        filter,
        time: COMMAND.CONSTANTS.INTERACTION_TIME
      });

      collector.on('collect', async (i) => {
        await i.update({
          embeds: [
            generateEmbed({
              name: COMMAND.INFO.name,
              content: {
                type: COMMAND.CONSTANTS.LINK_INSTRUCTIONS.type,
                message: COMMAND.CONSTANTS.LINK_INSTRUCTIONS.message + `\nLink Code: \`${code}\`\nAccount ID: \`${accountId}\`\nExpires: <t:${Math.floor(expires / 1000)}>`
              },
              client: discordClient.client
            })
          ],
          components: [] // Disable button after click
        });

        if (!discordClient.checkRateLimit(interaction.user.id)) {
          limited = true;

          await interaction.editReply({
            embeds: [
              generateEmbed({
                name: COMMAND.INFO.name,
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

        // We got a response, proceeding to authenticate
        discordClient.addSekaiRequest('profile', {
          userId: accountId
        }, async (profileResponse: any) => { // Type profileResponse as any
          if (profileResponse.userProfile.word === code) {
            db?.prepare('REPLACE INTO users (discord_id, sekai_id) ' +
              'VALUES(@discordId, @sekaiId)').run({
                discordId: interaction.user.id,
                sekaiId: accountId
              });

            linked = true;

            await interaction.editReply({
              embeds: [
                generateEmbed({
                  name: COMMAND.INFO.name,
                  content: COMMAND.CONSTANTS.LINK_SUCC,
                  client: discordClient.client
                })
              ],
              components: []
            });
          } else {
            await interaction.editReply({
              embeds: [
                generateEmbed({
                  name: COMMAND.INFO.name,
                  content: COMMAND.CONSTANTS.BAD_CODE_ERR(profileResponse.userProfile.word),
                  client: discordClient.client
                })
              ],
              components: [linkButton] // Re-enable button on bad code
            });
          }
        }, async (err: any) => { // Type err as any
          // Log the error
          discordClient.logger?.log({
            level: 'error',
            timestamp: Date.now(),
            message: err.toString()
          });

          // If the account does not exist (even though we should have checked)
          await interaction.editReply({
            embeds: [
              generateEmbed({
                name: COMMAND.INFO.name,
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
        if (!linked && !limited) {
          await interaction.editReply({
            embeds: [
              generateEmbed({
                name: COMMAND.INFO.name,
                content: COMMAND.CONSTANTS.EXPIRED_CODE_ERR,
                client: discordClient.client
              })
            ],
            components: []
          });
        }
      });
    }, async (err: any) => { // Type err as any for Sekapi initial profile check
      if (err.getCode && err.getCode() === 404) {
        // We got an error trying to find this account
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
        // Log the error
        discordClient.logger?.log({
          level: 'error',
          timestamp: Date.now(),
          message: err.toString()
        });

        await interaction.editReply({
          embeds: [generateEmbed({
            name: COMMAND.INFO.name,
            content: { type: 'error', message: err.toString() },
            client: discordClient.client
          })]
        });
      }
    });
  }
};