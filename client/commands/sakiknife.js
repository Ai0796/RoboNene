/**
 * @fileoverview Allows you to bonk a user
 * @author Ai0796
 */


const COMMAND = require('../command_data/sakiknife');

const generateSlashCommand = require('../methods/generateSlashCommand');
const fs = require('fs');

module.exports = {
    ...COMMAND.INFO,
    data: generateSlashCommand(COMMAND.INFO),

    async execute(interaction, discordClient) {
        // await interaction.reply("test")
        try {
            interaction.reply('<:SakiKnife:1129108489634070538>');
        } catch (e) {
            console.log(e);
        } // Due to possible null values add a try catch
    }
};

