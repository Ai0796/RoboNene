// client/command_data/skillorder.ts
/**
 * @fileoverview Command Data & Constants Related to the /about command
 * These constants are used to dynamically generate a slash command on discord.
 * This File also contains the constants values used exclusively in the /about command.
 * @author Ai0796
 */

import { CommandInfo } from '../methods/generateSlashCommand'; // Assuming CommandInfo exists

export const INFO: CommandInfo = {
    'name': 'skillorder',
    'utilization': '/skillorder',
    'description': 'Shows the Optimal Skill Order (Best to Worst) of a Song',
    'ephemeral': false,
    'params': [
        {
            'type': 'integer',
            'name': 'song',
            'required': false,
            'description': 'Song Name',
            'autocomplete': true
        }
    ]
};

export const CONSTANTS = {}; // No constants in original