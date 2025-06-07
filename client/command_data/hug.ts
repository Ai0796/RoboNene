// client/command_data/hug.ts
/**
 * @fileoverview /bonk
 * @author Ai0796
 */

import { CommandInfo } from '../methods/generateSlashCommand'; // Assuming CommandInfo exists

export const INFO: CommandInfo = {
    'name': 'hug',
    'utilization': '/hug',
    'description': 'hug someone',
    'ephemeral': false,
    'params': [
        {
            'type': 'user',
            'name': 'user',
            'required': false,
            'description': 'User to Hug'
        }
    ]
};

export const CONSTANTS = {}; // No constants in original