// client/command_data/blessing.ts
/**
 * @fileoverview Blessing
 * @author Ai0796
 */

import { CommandInfo } from '../methods/generateSlashCommand'; // Assuming CommandInfo exists

export const INFO: CommandInfo = {
    'name': 'blessing',
    'utilization': '/blessing',
    'description': 'blessing',
    'ephemeral': false,
};

export const CONSTANTS = {
    'NO_ACC_ERROR': {
        'type': 'Error',
        'message': 'This user has not linked their project sekai account with the bot.'
    }
};