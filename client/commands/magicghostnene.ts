// client/commands/magicghostnene.ts
/**
 * @fileoverview Allows you to bonk a user
 * @author Ai0796
 */

import * as COMMAND from '../command_data/magicghostnene'; // Assuming command_data/magicghostnene.ts is converted
import generateSlashCommand from '../methods/generateSlashCommand';
import { EmbedBuilder, CommandInteraction, Message } from 'discord.js'; // Import CommandInteraction and Message
import { NENE_COLOR, FOOTER } from '../../constants';
import DiscordClient from '../client'; // Assuming default export
import { Content } from '../methods/generateEmbed'; // Import Content interface

/**
 * Generates an embed from the provided params
 * @param {String} name the name of the command
 * @param {Content} content the content of the message
 * @param {String} image an image URL (if applicable)
 * @param {DiscordClient} client the client we are using to handle Discord requests
 * @return {EmbedBuilder} a generated embed
 */
const generateEmbed = ({ name, content, image, client }: { name: string; content: Content; image: string; client: DiscordClient['client'] }): EmbedBuilder => {
    const embed = new EmbedBuilder()
        .setColor(NENE_COLOR)
        .setTitle(name.charAt(0).toUpperCase() + name.slice(1) + ' Nyaa~')
        .addFields({
            name: content.type.charAt(0).toUpperCase() + content.type.slice(1),
            value: content.message.charAt(0).toUpperCase() + content.message.slice(1)
        })
        .setThumbnail(image)
        .setTimestamp()
        .setFooter({ text: FOOTER, iconURL: image });

    return embed;
};

const generateResponse = (): string => {
    const magic8BallResponses = [
        'Outlook unclear. Ask someone else.',
        'Not looking good. Sorry, but that\'s the truth.',
        'Yes, definitely.',
        'No way. I\'m sure about that.',
        'As I see it, yes.',
        'Don\'t count on it.',
        'You can try, but chances are slim.',
        'Signs point to yes, I guess.',
        'My answer is no.',
        'Absolutely, without a doubt.',
        'I wouldn\'t bet on it.',
        'Looking good, I suppose.',
        'Hmm, not likely.',
        'Definitely yes.',
        'Nah, probably not.',
        'Chances are high.',
        'I don\'t think so.',
        'Yes, but don\'t get too excited.',
        'No doubt about it.',
        'Outlook seems good, I think.'
    ];

    return magic8BallResponses[Math.floor(Math.random() * magic8BallResponses.length)];
};

export default {
    ...COMMAND.INFO,
    data: generateSlashCommand(COMMAND.INFO),

    async execute(interaction: CommandInteraction, discordClient: DiscordClient) { // Explicitly type interaction
        await interaction.deferReply({
            ephemeral: COMMAND.INFO.ephemeral
        });

        const prompt = interaction.options.getString('prompt');
        if (!prompt) {
            await interaction.editReply('Please provide a prompt.');
            return;
        }

        const embed = generateEmbed({
            name: interaction.user.globalName || interaction.user.username, // Use globalName if available, fallback to username
            content: {
                type: 'Oh Magic GhostNeneRobo',
                message: prompt
            },
            image: interaction.user.displayAvatarURL(),
            client: discordClient.client
        });

        await interaction.editReply({
            embeds: [embed]
        });

        await interaction.followUp(generateResponse());
    },

    async executeMessage(message: Message, discordClient: DiscordClient) { // Explicitly type message
        message.channel.send(generateResponse());
    }
};