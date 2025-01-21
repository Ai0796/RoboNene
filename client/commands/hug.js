/**
 * @fileoverview Allows you to bonk a user
 * @author Ai0796
 */


const COMMAND = require('../command_data/hug');
const axios = require('axios');

const generateSlashCommand = require('../methods/generateSlashCommand');
const fs = require('fs');

const fp = './JSONs/hug.json';
const hugAPIURL = 'https://api.otakugifs.xyz/gif?reaction=hug';

function getHugs(userId) {
    let hugs = 1;
    var f;
    try {
        if (!fs.existsSync(fp)) {
            f = new Object();
        }
        else {
            f = JSON.parse(fs.readFileSync(fp, 'utf8'));
        }

        if (userId in f) {
            f[userId] = f[userId] + 1;
        }
        else {
            f[userId] = 1;
        }
 
        hugs = f[userId];

        fs.writeFile(fp, JSON.stringify(f), err => {
            if (err) {
                console.log('Error writing Hugs', err);
            } else {
                console.log('Wrote Hugs Successfully');
            }
        });
    } catch (e) {
        console.log('Error occured while writing hugs: ', e);
    }

    return hugs;
}

async function getHugGif() {

    let hugURL = await axios.get(hugAPIURL);

    return hugURL.data.url;
}

module.exports = {
    ...COMMAND.INFO,
    data: generateSlashCommand(COMMAND.INFO),

    async execute(interaction, discordClient) {
        // await interaction.reply("test")
        try {
            let user = interaction.options.getMember('user');

            if (!user) {
                user = interaction.user;
            }

            let id = user.id;

            let hugs = getHugs(id);
            let mention = '<@' + id + '>';
            let selfMention = '<@' + interaction.user.id + '>';

            if (user.id == interaction.user.id) {
                let hugURL = 'https://tenor.com/view/emu-otori-nene-neo-hug-jump-gif-1414561477616308005'
                await interaction.reply(`Emu is here to hug you, ${mention} Wonderhoy!\nYou have been hugged ${hugs} times!`);
                await interaction.followUp(hugURL);
                return;
            } else {
                let hugURL = await getHugGif();
                await interaction.reply(`${mention} has been hugged by ${selfMention}\n ${mention} has been hugged ${hugs} times!`);
                await interaction.followUp(hugURL);
                return;
            }
        } catch (e) {
            console.log(e);
        } // Due to possible null values add a try catch
    }
};

