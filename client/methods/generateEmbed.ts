// client/methods/generateEmbed.ts
import { EmbedBuilder } from 'discord.js';
import { NENE_COLOR, FOOTER } from '../../constants';
import { Client } from 'discord.js'; // Import Client from discord.js

export interface Content {
  type: string;
  message: string;
}

interface GenerateEmbedOptions {
  name: string;
  content: Content;
  image?: string;
  client: Client; // Use the imported Client type
}

/**
 * Generates an embed from the provided params
 * @param {String} name the name of the command
 * @param {Content} content the content of the message
 * @param {String} image an image URL (if applicable)
 * @param {Client} client the client we are using to handle Discord requests
 * @return {EmbedBuilder} a generated embed
 */
const generateEmbed = ({ name, content, image, client }: GenerateEmbedOptions): EmbedBuilder => {
  const embed = new EmbedBuilder()
    .setColor(NENE_COLOR)
    .setTitle(name.charAt(0).toUpperCase() + name.slice(1) + ' Nyaa~')
    .addFields({
      name: content.type.charAt(0).toUpperCase() + content.type.slice(1),
      value: content.message.charAt(0).toUpperCase() + content.message.slice(1)
    })
    .setThumbnail(client.user?.displayAvatarURL() || '') // Safely access displayAvatarURL
    .setTimestamp()
    .setFooter({ text: FOOTER, iconURL: client.user?.displayAvatarURL() || '' }); // Safely access displayAvatarURL

  if (image) {
    embed.setImage(image);
  }

  return embed;
};

export default generateEmbed;