// client/command_data/isv.ts
/**
 * @fileoverview Command Data & Constants Related to the /isv command
 * These constants are used to dynamically generate a slash command on discord.
 * This File also contains the constants values used exclusively in the /isv command.
 * @author Potor10
 */

import { CommandInfo } from '../methods/generateSlashCommand'; // Assuming CommandInfo exists

export const INFO: CommandInfo = {
    'name': 'isv',
    'utilization': '/isv',
    'description': 'Quick ISV conversion',
    'ephemeral': true,
    'params': [
        {
            'type': 'string',
            'name': 'isv',
            'required': true,
            'description': 'isv in the format {lead}/{team}'
        }
    ],
};

export const CONSTANTS = {
    'NO_ACC_ERROR': {
        'type': 'Error',
        'message': 'This user has not linked their project sekai account with the bot.'
    }
};