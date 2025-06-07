// client/command_data/silver.ts
/**
 * @fileoverview /bonk
 * @author Ai0796
 */

import { CommandInfo } from '../methods/generateSlashCommand'; // Assuming CommandInfo exists

export const INFO: CommandInfo = {
    'name': 'silver',
    'utilization': '/silver',
    'description': 'silver got another AP',
    'ephemeral': false,
    'params': [
        {
            'type': 'boolean',
            'name': 'failed',
            'required': false,
            'description': 'did silver fail'
        }
    ]
};

export const CONSTANTS = {}; // No constants in original