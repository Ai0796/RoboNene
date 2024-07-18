/**
 * @fileoverview The main output when users call for the /skillorder command
 * Sends a order from Left to Right for Best to Worst player skill order
 * @author Ai0796
 */

const { EmbedBuilder } = require('discord.js');

const { NENE_COLOR, FOOTER} = require('../../constants');

const COMMAND = require('../command_data/skillorder');

const generateSlashCommand = require('../methods/generateSlashCommand');
const fs = require('fs');
const generateSkillText = require('../methods/generateSkillText');

//Required since Proseka Skill order is not 1 2 3 4 5
const ProsekaSkillOrder = [1, 2, 3, 4, 5, 'E'];
const Difficulties = ['easy', 'normal', 'hard', 'expert', 'master'];

/**
 * A class designed to store music data from JSON Files
 */
class music {
    constructor() {
        this.ids = new Set();
        this.musics = new Object();
        this.musicmetas = new Object();

        const tempIDs = new Set();
        const musicsJSON = JSON.parse(fs.readFileSync('./sekai_master/musics.json'));
        const musicMetasJSON = JSON.parse(fs.readFileSync('./sekai_master/music_metas.json'));

        //Checks music metas first for all IDs listed
        musicMetasJSON.forEach(musicMeta => {
            this.ids.add(musicMeta.music_id);
        });

        //Checks musics second to get listed IDs titles
        musicsJSON.forEach(music => {
            if(this.ids.has(music.id)) {
                this.musics[music.id] = music.title;
                tempIDs.add(music.id);
            }
            this.musics[226] = 'Lost and Found'; //Temp solution until song is brought to EN
            tempIDs.add(226);
        });

        this.ids = this.getIntersection(this.ids, tempIDs);

        //Create new object for each song to store difficulties
        this.ids.forEach(id => {
            this.musicmetas[id] = new Object();
        });

        //Checks music metas again now that we have titles to be used as keys
        musicMetasJSON.forEach(music => {
            if(this.ids.has(music.music_id))
            {
                //Slice from 0 to 5 since encore (5) doesn't matter
                let skillScores = music.skill_score_multi;
                let skillScoreOrder = [];
                let skillOrder = [];

                skillScoreOrder = skillScores.map((skillScore, i) => [skillScore, i]);

                //Sort to get correct order
                skillScoreOrder.sort(this.sortFunction);

                skillOrder = skillScoreOrder.map((skill) => {
                    return ProsekaSkillOrder[skill[1]];
                });

                this.musicmetas[music.music_id][music.difficulty] = skillOrder;
            }
        });
    }

    //Sort function for 2D arrays that orders it by value of first index
    //Sorts From highest to lowest
    sortFunction(a, b) {
        if (a[0] === b[0]) {
            return 0;
        }
        else {
            return (a[0] > b[0]) ? -1 : 1;
        }
    }

    //Returns intersection of two sets
    getIntersection(setA, setB) {
        const intersection = new Set(
            [...setA].filter(element => setB.has(element))
        );

        return intersection;
    }
}

function skillOrder(order){
    return `${order[0]} > ${order[1]} > ${order[2]} > ${order[3]} > ${order[4]} > ${order[5]}`;
}

function musicSkillOrder(song)
{
    let arr = [];
    Difficulties.forEach(difficulty => {
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
        try{
            if (interaction.options._hoistedOptions[0] && musicData.ids.has(interaction.options._hoistedOptions[0].value)) {
                // console.log(interaction.options._hoistedOptions[0].value)
                let id = interaction.options._hoistedOptions[0].value;
                let data = musicData.musicmetas[id];

                let skillOrderText = generateSkillText(Difficulties, musicSkillOrder(data));

                //Generate Embed with given text
                let skillOrderEmbed = new EmbedBuilder()
                    .setColor(NENE_COLOR)
                    .setTitle(`${musicData.musics[id]}`)
                    .setTimestamp()
                    .addFields({name: 'NOTE', value: 'Due to the removal of a set order, order is now shown in procs, (e.g. 5 = 5th skill proc)', inline: false})
                    .addFields({name: 'Skill Orders', value: skillOrderText, inline: false})
                    .setFooter({text: FOOTER, iconURL: interaction.user.displayAvatarURL()});

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
                {name: 'Hitorinbo Envy', value: 74},
                {name: 'Lost and Found', value: 226},
                {name: 'Melt', value: 47},
            ]);
        }

        let choices = Object.keys(musicData.musics).filter((key) => {
            return musicData.musics[key].toLowerCase().includes(focus.toLowerCase());
        });

        choices = choices.slice(0, 25);

        await interaction.respond(choices.map((key) => {
            return {name: musicData.musics[key], value: key};
        }));
    }
};

