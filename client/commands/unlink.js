/**
 * @fileoverview The main output when users call for the /unlink command
 * Shows an prompt for the user to unlink their account the the bot
 * @author Potor10
 */

const { EmbedBuilder, ButtonBuilder, ActionRowBuilder } = require('discord.js');
const { NENE_COLOR, FOOTER } = require('../../constants');

const COMMAND = require('../command_data/unlink');

const generateSlashCommand = require('../methods/generateSlashCommand');
const generateEmbed = require('../methods/generateEmbed');

/**
 * Generates the embed that is used when users request a link
 * @param {String} code the code that the user needs to enter into their profile to link
 * @param {String} accountId the ID of the account that is trying to link to the bot
 * @param {Integer} expires in epochseconds before the linking expires
 * @param {Object} content the message body within the link embed (ex: success, or failure)
 * @param {DiscordClient} client we are using to interact with disc
 * @return {EmbedBuilder} embed that we recieve to display to the user
 */
const generateUnlinkEmbed = ({ code, accountId, expires, content, client }) => {
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
    .setThumbnail(client.user.displayAvatarURL())
    .setTimestamp()
    .setFooter({ text: FOOTER, iconURL: client.user.displayAvatarURL() });

  if (content) {
    unlinkEmbed.addFields({ name: content.type, value: content.message });
  }

  return unlinkEmbed;
};

module.exports = {
  ...COMMAND.INFO,
  data: generateSlashCommand(COMMAND.INFO),

  async execute(interaction, discordClient) {
    await interaction.deferReply({
      ephemeral: COMMAND.INFO.ephemeral
    });

    const db = discordClient.db;
    const accountId = (interaction.options._hoistedOptions[0].value).replace(/\D/g, '');

    const sekaiCheck = db.prepare('SELECT * FROM users WHERE sekai_id=@sekaiId').all({
      sekaiId: accountId
    });

    // User exists in the database
    if (!sekaiCheck.length) {
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

    if (sekaiCheck[0].discord_id == interaction.user.id) {
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

    const code = Math.random().toString(36).slice(-5);
    const expires = Date.now() + COMMAND.CONSTANTS.INTERACTION_TIME;

    const unlinkButton = new ActionRowBuilder()
      .addComponents(new ButtonBuilder()
        .setCustomId('unlink')
        .setLabel('UNLINK')
        .setStyle(4)
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

    const filter = (i) => {
      return i.customId == 'unlink';
    };

    const collector = unlinkMessage.createMessageComponentCollector({
      filter,
      time: COMMAND.CONSTANTS.INTERACTION_TIME
    });

    collector.on('collect', async (i) => {
      await i.update({
        embeds: [
          generateUnlinkEmbed({
            code: code,
            accountId: accountId,
            expires: expires,
            client: discordClient.client
          })
        ],
        components: []
      });

      discordClient.addSekaiRequest('profile', {
        userId: accountId
      }, async (response) => {
        if (response.userProfile.word === code) {
          // Check through the client if the code is set in the description
          db.prepare('DELETE FROM users WHERE sekai_id=@sekaiId').run({
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
            components: [unlinkButton]
          });
        }
      }, async (err) => {
        // Log the error
        discordClient.logger.log({
          level: 'error',
          timestamp: Date.now(),
          message: err.toString()
        });

        // Account could not be found
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

    collector.on('end', async (collected) => {
      // No Response
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