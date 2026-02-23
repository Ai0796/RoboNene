/**
 * @fileoverview Tracks when Mack has a moment
 * @author Ai0796
 */

const COMMAND = require('../command_data/mack');

const generateSlashCommand = require('../methods/generateSlashCommand');
const fs = require('fs');

const fp = './JSONs/mack.json';

function getBonks(reset) {
    var bonk = 1;
    var bonkFile;
    try {
        if (!fs.existsSync(fp) || reset) {
            bonkFile = [];
        }
        else {
            bonkFile = JSON.parse(fs.readFileSync(fp, 'utf8'));
        }

        if (bonkFile.length > 0) {
            bonkFile[0] += 1;
        }
        else {
            bonkFile.push(1);
        }

        bonk = bonkFile[0];

        fs.writeFile(fp, JSON.stringify(bonkFile), err => {
            if (err) {
                console.log('Error writing Mack', err);
            } else {
                // console.log(`Wrote Silver Successfully`);
            }
        });
    } catch (e) {
        console.log('Error occured while writing Mack: ', e);
    }

    return bonk;
}

const phrases = [
    'nyaa',
    'so true bestie',
    'he\'s probably simping over kanade',
    'how do I transfer to MRE',
    'get the toe gif',
    'omg An',
    'get some help',
    'what a gorilla',
    'that\'s my t1 hermit',
    'please don\'t be rocks again',
    'omg fes kanade toes',
    'what a mizuki oshi'
];

module.exports = {
    ...COMMAND.INFO,
    // data: generateSlashCommand(COMMAND.INFO),

    async execute(interaction, discordClient) {
        // await interaction.reply("test")
        let moments = getBonks();

        await interaction.reply(`Mackaylen has had ${moments} moments, ${phrases[Math.floor(Math.random() * phrases.length)]}`);
    }
};