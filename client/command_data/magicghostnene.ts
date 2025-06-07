// client/command_data/magicghostnene.ts
/**
 * @fileoverview /bonk
 * @author Ai0796
 */

import { CommandInfo } from '../methods/generateSlashCommand'; // Assuming CommandInfo exists

export const INFO: CommandInfo = {
    'name': 'magicghostnene',
    'utilization': '/magicghostnene',
    'description': 'Ask the magic ghostnenerobo a question',
    'ephemeral': false,
    'params': [
        {
            'type': 'string',
            'name': 'prompt',
            'required': true,
            'description': 'The prompt to ask the magic ghostnenerobo'
        }
    ]
};

export const CONSTANTS = {}; // No constants in original