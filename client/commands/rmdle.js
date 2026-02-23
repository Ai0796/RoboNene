/**
 * @fileoverview Allows you to bonk a user
 * @author Ai0796
 */

const COMMAND = require('../command_data/rmdle');

const generateSlashCommand = require('../methods/generateSlashCommand');
const generateEmbed = require('../methods/generateEmbed');

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { channel } = require('diagnostics_channel');

const timeout = 600000;
const channels = {};

const numberEmojis = {
    '0': '0️⃣', '1': '1️⃣', '2': '2️⃣', '3': '3️⃣', '4': '4️⃣',
    '5': '5️⃣', '6': '6️⃣', '7': '7️⃣', '8': '8️⃣', '9': '9️⃣'
};

// Used for the wordle keyboard equivalent
const numberColor = [
    '❓', '⬛', '🟨', '🟩'
];

function pad(num, size) {

    if (isNaN(num)) {
        return num;
    }

    num = parseInt(num);
    num = Math.abs(num);
    num = num.toString();
    while (num.length < size) num = '0' + num;
    return num;
}

module.exports = {
    ...COMMAND.INFO,
    data: generateSlashCommand(COMMAND.INFO),

    async execute(interaction, discordClient) {
        await interaction.deferReply({
            ephemeral: COMMAND.INFO.ephemeral
        });

        let code = interaction.options.getInteger('code');

        try {
            var channelName;
            if (code) {

                code = pad(code, 5);

                if (`${code}`.length != 5) {
                    await interaction.editReply({
                        embeds: [
                            generateEmbed({
                                name: COMMAND.INFO.name,
                                content: COMMAND.CONSTANTS.WRONG_CODE_LENGTH,
                                client: discordClient.client
                            })
                        ]
                    });
                    return;
                }

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            // We store the secret code inside the Custom ID so we don't need a database
                            .setCustomId(`guessButton_${code}`)
                            .setLabel('rmdle')
                            .setStyle(ButtonStyle.Primary),
                    );

                let userAttempts = {}; // Individual per user

                const buttonFilter = (btnInteraction) => btnInteraction.customId === `guessButton_${code}`;

                const buttonCollector = interaction.channel.createMessageComponentCollector({
                    filter: buttonFilter,
                    time: timeout
                });

                buttonCollector.on('collect', async (btnInteraction) => {
                    // 3. Create and Show the Modal
                    const modal = new ModalBuilder()
                        .setCustomId(`modal_${btnInteraction.id}`) // Unique ID per click
                        .setTitle('Enter 5-Digit Code');

                    const input = new TextInputBuilder()
                        .setCustomId('guess_input')
                        .setLabel('What is your 5-digit guess?')
                        .setStyle(TextInputStyle.Short)
                        .setMinLength(5)
                        .setMaxLength(5)
                        .setRequired(true);

                    userId = btnInteraction.user.id.toString();
                    if (!userAttempts[userId]) {
                        userAttempts[userId] = [0, Array(10).fill(0)]; // [attempts, digit found]
                    }
                    userAttempts[userId][0] += 1;
                    if (userAttempts[userId][0] > 6) {
                        await btnInteraction.reply({
                            content: `You've run out of attempts.`,
                            ephemeral: true
                        });
                        return;
                    }

                    modal.addComponents(new ActionRowBuilder().addComponents(input));
                    await btnInteraction.showModal(modal);

                    // 4. Use awaitModalSubmit as a "Filter/Collector" for the submission
                    try {
                        const submission = await btnInteraction.awaitModalSubmit({
                            // Only collect the modal tied to this specific button click
                            filter: (i) => i.customId === `modal_${btnInteraction.id}`,
                            time: 60000 // 1 minute to type the guess
                        });

                        const userGuess = submission.fields.getTextInputValue('guess_input');

                        // Logic for feedbac
                        let guessBlocks = "";
                        let results = "";
                        for (let i = 0; i < 5; i++) {

                            guessBlocks += numberEmojis[userGuess[i]] || '❓';

                            intGuess = parseInt(userGuess[i]);

                            if (userGuess[i] === code[i]) {
                                results += "🟩";
                                userAttempts[userId][1][intGuess] = Math.max(userAttempts[userId][1][intGuess], 3);
                            }
                            else if (code.includes(userGuess[i])) {
                                results += "🟨";
                                userAttempts[userId][1][intGuess] = Math.max(userAttempts[userId][1][intGuess], 2);
                            }
                            else {
                                results += "⬛";
                                userAttempts[userId][1][intGuess] = Math.max(userAttempts[userId][1][intGuess], 1);
                            }
                        }

                        let numberOrder = ""
                        let numberColorsDisplay = ""

                        for (let i = 0; i <= 9; i++) {
                            numberOrder += numberEmojis[i.toString()];
                            numberColorsDisplay += numberColor[userAttempts[userId][1][i]];
                        }

                        // 5. Send Ephemeral Confirmation
                        await submission.reply({
                            content: `Attempt: ${userAttempts[userId][0]}/6\n${guessBlocks}\n${results}\n\n${numberOrder}\n${numberColorsDisplay}`,
                            ephemeral: true
                        });

                        // Logic for winning
                        if (userGuess === code) {
                            await btnInteraction.followUp({
                                content: `The room code is **${code}**, you guessed it in ${userAttempts[userId][0]} attempts! 🎉`,
                                ephemeral: true
                            });
                        }

                    } catch (err) {
                        // User didn't submit within the time limit
                        console.log("Modal timed out or encountered an error.");
                    }
                });

                await interaction.editReply({
                    content: `Started rmdle with code: **${code}**.`
                });

                // Do this to prevent argument peeking
                let followUp = await interaction.followUp({
                    content: `You have 6 guesses to get into the room.`,
                    components: [row],
                    ephemeral: false
                });

                buttonCollector.on('end', async (interaction) => {
                    await followUp.edit({
                        content: 'The rmdle has ended, please bother your host if you still need the code',
                        components: []
                    });
                });
            }

        } catch (e) {
            console.log(e);
            await interaction.editReply({
                embeds: [
                    generateEmbed({
                        name: COMMAND.INFO.name,
                        content: COMMAND.CONSTANTS.ERROR,
                        client: discordClient.client
                    })
                ]
            });
        } // Due to possible null values add a try catch
    }
};

