/**
 * @fileoverview Shows common conversions for a specific ISV input
 * @author Ai0796
 */


const COMMAND = require('../command_data/isv');

const generateSlashCommand = require('../methods/generateSlashCommand');
const generateEmbed = require('../methods/generateEmbed');

function verify(inputStr) {
    let regex = new RegExp('^[0-9]+%?(\/[0-9]+)?$');
    return regex.test(inputStr);
}

function removeNonNumeric(str) {
    return str.replace(/\D/g, '');
}

function calculateMultiplier(lead, team) {
    if (lead > 10) {
        lead /= 100;
    }
    if (team > 10) {
        team /= 100;
    }

    return `${Math.round((lead + (team - lead) / 5) * 100)}%`;
}

module.exports = {
    ...COMMAND.INFO,
    data: generateSlashCommand(COMMAND.INFO),

    async execute(interaction, discordClient) {
        // await interaction.reply("test")
        try {
            if (interaction.options._hoistedOptions[0]) {

                let ISVString = interaction.options.getString('isv');
                if (!verify(ISVString)) {
                    await interaction.reply('Invalid ISV format use the format {lead}[/{team}] Ex: 150/700 or 200', { ephemeral: true });
                    return;
                }

                let splitStr = ISVString.split('/');
                let lead = parseInt(removeNonNumeric(splitStr[0]));
                var team;
                if (splitStr.length >= 2) {
                    team = parseInt(removeNonNumeric(splitStr[1]));
                } else {
                    team = lead;
                }

                let equivalents = [];
                let possibleISVs = [
                    80, 85, 90, 100, 105, 110, 115, 120, 125, 130, 135, 140, 150, 160
                ];

                possibleISVs.forEach(i => {
                    let difference = (lead - i) * 4;
                    // Max possible backline is 600
                    if (team + difference > i + 600) return;

                    equivalents.push(`${i}/${team + difference}`);
                });

                equivalents.push(`Boost: ${calculateMultiplier(lead, team)}`)

                let embed = generateEmbed(
                    {
                        name: 'ISV Equivalents', 
                        content: {
                            type: `ISV Equivalents to ${ISVString}`,
                            message: equivalents.join('\n')
                        },
                        client: discordClient.client
                    }
                );

                await interaction.reply({ embeds: [embed] });
            }
        } catch (e) {
            await interaction.reply('Unkown Error has Occured', { ephemeral: true });
            console.log(e);
        } // Due to possible null values add a try catch
    }
};

