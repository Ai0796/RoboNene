// client/command_data/bonk.ts
/**
 * @fileoverview /bonk
 * @author Ai0796
 */

import { CommandInfo } from '../methods/generateSlashCommand'; // Assuming CommandInfo exists

export const INFO: CommandInfo = {
    'name': 'bonk',
    'utilization': '/bonk',
    'description': 'Bonk',
    'ephemeral': false,
    'params': [
        {
            'type': 'user',
            'name': 'user',
            'required': true,
            'description': 'User to Bonk'
        }
    ]
};

export const CONSTANTS = {}; // No constants in original