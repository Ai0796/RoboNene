// client/command_data/gacha.ts
/**
 * @fileoverview /pray
 * @author Ai0796
 */

import { CommandInfo } from '../methods/generateSlashCommand'; // Assuming CommandInfo exists

export const INFO: CommandInfo = {
    'name': 'gacha',
    'utilization': '/gacha',
    'description': 'Spend your luck on a gacha roll',
    'ephemeral': false,
    'params': [
        {
            'type': 'boolean',
            'name': 'single',
            'description': 'Whether to do a single pull or not',
            'required': false,
        }
    ]
};

export const CONSTANTS = {}; // No constants in original