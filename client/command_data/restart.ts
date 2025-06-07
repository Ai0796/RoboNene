// client/command_data/restart.ts
/**
 * @fileoverview Command Data & Constants Related to the /restart command
 * These constants are used to dynamically generate a slash command on discord.
 * This File also contains the constants values used exclusively in the /restart command.
 * @author Potor10
 */

import { CommandInfo } from '../methods/generateSlashCommand'; // Assuming CommandInfo exists

export const INFO: CommandInfo = {
    'name': 'restart',
    'utilization': '/restart',
    'description': 'Attempts to Restart the bot, only works for moderators',
    'ephemeral': false,
};

export const CONSTANTS = {
    'NO_ACC_ERROR': {
        'type': 'Error',
        'message': 'This user has not linked their project sekai account with the bot.'
    }
};