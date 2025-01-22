/**
 * @fileoverview The main output when users call for the /skillorder command
 * Sends a order from Left to Right for Best to Worst player skill order
 * @author Ai0796
 */

const { EmbedBuilder } = require('discord.js');

const { NENE_COLOR, FOOTER } = require('../../constants');

const COMMAND = require('../command_data/skillorder');

const generateSlashCommand = require('../methods/generateSlashCommand');
const music = require('../classes/Musics');
const generateSkillText = require('../methods/generateSkillText');

//Required since Proseka Skill order is not 1 2 3 4 5
const Difficulties = ['easy', 'normal', 'hard', 'expert', 'master', 'append'];



function skillOrder(order) {
    return `${order[0]} > ${order[1]} > ${order[2]} > ${order[3]} > ${order[4]} > ${order[5]}`;
}

function optimalDifficulty(difficulties) {
    difficulties.sort((a, b) => { return b[0] - a[0]; });
    let returnStr = difficulties.map(difficulty => {
        return `${difficulty[1]}`;
    }).join(' > ');

    return `\`${returnStr}\``;
}

function musicSkillOrder(song) {
    let arr = [];
    Difficulties.forEach(difficulty => {
        if (song[difficulty] == null) { return; }
        arr.push(`${skillOrder(song[difficulty])}`);
    });

    return arr;
}

const musicData = new music();

module.exports = {
    ...COMMAND.INFO,
    data: generateSlashCommand(COMMAND.INFO),

    async execute(interaction, discordClient) {
        // await interaction.reply("test")
        try {
            if (interaction.options._hoistedOptions[0] && musicData.ids.has(interaction.options._hoistedOptions[0].value)) {
                // console.log(interaction.options._hoistedOptions[0].value)
                let id = interaction.options._hoistedOptions[0].value;
                let data = musicData.musicmetas[id];
                let optimalDifficulties = musicData.optimalDifficulty[id];

                let skillOrderText = generateSkillText(Difficulties, musicSkillOrder(data));
                let optimalDifficultyText = optimalDifficulty(optimalDifficulties);

                //Generate Embed with given text
                let skillOrderEmbed = new EmbedBuilder()
                    .setColor(NENE_COLOR)
                    .setTitle(`${musicData.musics[id]}`)
                    .setTimestamp()
                    .addFields({ name: 'Skill Orders', value: skillOrderText, inline: false })
                    .addFields({ name: 'Optimal Difficulty', value: optimalDifficultyText, inline: false })
                    .setFooter({ text: FOOTER, iconURL: interaction.user.displayAvatarURL() });

                await interaction.reply({
                    embeds: [skillOrderEmbed],
                });
            }
        } catch (e) {
            console.log(e);
        } // Due to possible null values add a try catch
    },
    async autocomplete(interaction, discordClient) {
        let focus = interaction.options.getFocused();
        if (focus == '') {
            await interaction.respond([
                { name: 'Hitorinbo Envy', value: 74 },
                { name: 'Lost and Found', value: 226 },
                { name: 'Melt', value: 47 },
            ]);

            return;
        }

        let choices = Object.keys(musicData.musics).filter((key) => {
            return musicData.musics[key].toLowerCase().includes(focus.toLowerCase());
        });

        choices = choices.slice(0, 25);

        await interaction.respond(choices.map((key) => {
            return { name: musicData.musics[key], value: key };
        }));
    }
};

