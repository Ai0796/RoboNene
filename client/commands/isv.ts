// client/commands/isv.ts
/**
 * @fileoverview Shows common conversions for a specific ISV input
 * @author Ai0796
 */


import { CommandInteraction } from 'discord.js'; // Import CommandInteraction
import * as COMMAND from '../command_data/isv'; // Import all exports from isv
import generateSlashCommand from '../methods/generateSlashCommand'; // Assuming default export
import generateEmbed from '../methods/generateEmbed'; // Assuming default export
import DiscordClient from '../client'; // Assuming default export

function verify(inputStr: string): boolean { // Added type for inputStr
    const regex = new RegExp('[0-9]+/[0-9]+$');
    return regex.test(inputStr);
}

function calculateMultiplier(lead: number, team: number): string { // Added types for lead and team
    if (lead > 10) {
        lead /= 100;
    }
    if (team > 10) {
        team /= 100;
    }

    return ((lead + (team - lead) / 5)).toFixed(2);
}

export default {
    ...COMMAND.INFO,
    data: generateSlashCommand(COMMAND.INFO),

    async execute(interaction: CommandInteraction, discordClient: DiscordClient) { // Added types for interaction and discordClient
        try {
            // interaction.options._hoistedOptions[0] can be problematic, use interaction.options.getString
            const isvOption = interaction.options.getString('isv');

            if (isvOption) { // Check if isvOption exists
                const ISVString = isvOption;
                if (!verify(ISVString)) {
                    await interaction.reply('Invalid ISV format use the format {lead}/{team} Ex: 150/700', { ephemeral: true });
                    return;
                }

                const splitStr = ISVString.split('/');
                const lead = parseInt(splitStr[0]);
                const team = parseInt(splitStr[1]);

                if (isNaN(lead) || isNaN(team)) { // Validate parsed numbers
                    await interaction.reply('Invalid ISV format. Lead and Team must be numbers.', { ephemeral: true });
                    return;
                }

                const equivalents: string[] = [];
                const possibleISVs = [
                    80, 85, 90, 100, 105, 110, 115, 120, 125, 130, 135, 140, 150, 160
                ];

                possibleISVs.forEach(i => {
                    const difference = (lead - i) * 4;
                    // Max possible backline is 600
                    if (team + difference > i + 600) return;

                    equivalents.push(`${i}/${team + difference}`);
                });

                equivalents.push(`Boost: ${calculateMultiplier(lead, team)}`);

                const embed = generateEmbed(
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
            } else {
                // This branch should theoretically not be hit if 'isv' is a required option
                await interaction.reply('Please provide an ISV string.', { ephemeral: true });
            }
        } catch (e: any) { // Type as any for error
            await interaction.reply('Unknown Error has Occurred', { ephemeral: true });
            console.error(e); // Changed to console.error
        }
    }
};