/**
 * @fileoverview The main output when users call for the /about command
 * Will create a scrollable leaderboard elaborating about the bot and other features
 * @author Potor10
 */

const COMMAND = require('../command_data/restart');

const generateSlashCommand = require('../methods/generateSlashCommand');
const APP = require('process');
const fs = require('fs');
const { PermissionFlagsBits } = require('discord.js');

function isAdmin(msg) {
    return msg.member.permissionsIn(msg.channel).has(PermissionFlagsBits.ManageMessages);
}

function addMessage(message, channel) {
    var trackFile;
    try {
        trackFile = new Object();

        trackFile[channel] = message;

        fs.writeFile('messages.json', JSON.stringify(trackFile), err => {
            if (err) {
                console.log('Error writing Tracking', err);
            } else {
                console.log('Wrote Tracking Successfully');
            }
        });
    } catch (e) {
        console.log('Error occured while writing Tracking: ', e);
    }
}

module.exports = {
    ...COMMAND.INFO,
    data: generateSlashCommand(COMMAND.INFO),

    async execute(interaction, discordClient) {
        await interaction.deferReply({
            ephemeral: COMMAND.INFO.ephemeral
        });
        if(isAdmin(interaction) && interaction.guildId == '967923753470291978') {
            try {

                // First I create an exec command which is executed before current process is killed
                var cmd = 'pm2 restart 0';

                // Then I look if there's already something ele killing the process  
                if (APP.killed === undefined) {
                    APP.killed = true;

                    // Then I excute the command and kill the app if starting was successful
                    var exec = require('child_process').exec;
                    interaction.editReply('Restarting Application');
                    addMessage('Application Restarted Successfully', interaction.channelId);
                    exec(cmd, function () {
                        process.kill();
                    });
                }
            } catch (e) {
                console.log(e);
                interaction.editReply('Application Restarted: Failure');
            } // Due to possible null values add a try catch
        } else {
            interaction.editReply('You do not have the permissions for that');
        }
    }
};

