// client/methods/generateDeferredResponse.ts
/**
 * @fileoverview An implementation designed to create an immediate response to any commands
 * in case there is a processing time involved (since Discord API demands immediate responses)
 * Note: Not currently being used
 * @author Potor10
 */

import { EmbedBuilder } from 'discord.js';
import { NENE_COLOR, FOOTER } from '../../constants';
import { Client } from 'discord.js'; // Import Client from discord.js

/**
 * Generates an Embed that the bot can use to defer a response for later
 * @param {String} commandName the name of the command
 * @param {Client} discordClient the client we are using to handle Discord requests
 * @return {EmbedBuilder} the embed of the deferred response
 */
const generateDeferredResponse = (commandName: string, discordClient: { client: Client }): EmbedBuilder => {
  const botAvatarURL = discordClient.client.user?.displayAvatarURL() || ''; // Safely access displayAvatarURL

  const deferredResponse = new EmbedBuilder()
    .setColor(NENE_COLOR)
    .setTitle('Loading...')
    .setDescription(`Requesting command: \`\`${commandName}\`\`\nPlease be patient`)
    .setThumbnail(botAvatarURL)
    .setTimestamp()
    .setFooter({ text: FOOTER, iconURL: botAvatarURL }); // Safely access displayAvatarURL

  return deferredResponse;
};

export default generateDeferredResponse;