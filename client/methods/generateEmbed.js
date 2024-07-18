/**
 * @fileoverview An implementation designed to easily create a good looking embed on discord
 * from a small subset of parameters.
 * @author Potor10
 */

const { EmbedBuilder } = require('discord.js');
const { NENE_COLOR, FOOTER } = require('../../constants');

/**
 * @typedef {Object} Content
 * @property {String} type the type of message
 * @property {String} message the message
 */

/**
 * Generates an embed from the provided params
 * @param {String} name the name of the command
 * @param {Content} content the content of the message
 * @param {String} image an image URL (if applicable)
 * @param {DiscordClient} client the client we are using to handle Discord requests
 * @return {MessageEmbed} a generated embed
 */
const generateEmbed = ({name, content, image, client}) => {
  const embed = new EmbedBuilder()
    .setColor(NENE_COLOR)
    .setTitle(name.charAt(0).toUpperCase() + name.slice(1) + ' Nyaa~')
    .addFields({
      name: content.type.charAt(0).toUpperCase() + content.type.slice(1),
      value: content.message.charAt(0).toUpperCase() + content.message.slice(1)
    })
    .setThumbnail(client.user.displayAvatarURL())
    .setTimestamp()
    .setFooter({text: FOOTER, iconURL: client.user.displayAvatarURL()});

  if (image) {
    embed.setImage(image);
  }

  return embed;
};

module.exports = generateEmbed;