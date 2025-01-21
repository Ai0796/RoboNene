/**
 * @fileoverview Allows you to bonk a user
 * @author Ai0796
 */

const COMMAND = require('../command_data/magicghostnene');

const generateSlashCommand = require('../methods/generateSlashCommand');
const { EmbedBuilder } = require('discord.js');
const { NENE_COLOR, FOOTER } = require('../../constants');

/**
 * Generates an embed from the provided params
 * @param {String} name the name of the command
 * @param {Content} content the content of the message
 * @param {String} image an image URL (if applicable)
 * @param {DiscordClient} client the client we are using to handle Discord requests
 * @return {MessageEmbed} a generated embed
 */
const generateEmbed = ({ name, content, image, client }) => {
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

const generateResponse = () => {
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

module.exports = {
    ...COMMAND.INFO,
    data: generateSlashCommand(COMMAND.INFO),

    async execute(interaction, discordClient) {
        await interaction.deferReply({
            ephemeral: COMMAND.INFO.ephemeral
        });

        let prompt = interaction.options.getString('prompt');

        let embed = generateEmbed({
            name: interaction.user.globalName,
            content: {
                type: 'oh magic ghostnenerobo',
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

    async executeMessage(message, discordClient) {

        message.channel.send(generateResponse());
    }
};

