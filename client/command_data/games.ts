// client/command_data/games.ts
/**
 * @fileoverview Used to get statistics about a user
 * @author Ai0796
 */

import { CommandInfo } from '../methods/generateSlashCommand'; // Assuming CommandInfo exists

export const INFO: CommandInfo = {
    'name': 'games',
    'utilization': '/games',
    'description': 'Get predicted game energy usage for a user',
    'ephemeral': false,
    'subcommands': [
        {
            'name': 'tier',
            'description': 'get the energy usage for a specific tier on the leaderboard',
            'params': [
                {
                    'type': 'integer',
                    'name': 'tier',
                    'required': false,
                    'description': 'The tier to display for',
                    'maxValue': 100,
                    'minValue': 1
                }
            ]
        }
    ]
};

export const CONSTANTS = {
    'NO_EVENT_ERR': {
        'type': 'Error',
        'message': 'What do you want statistics to do? There isn\'t even an event right now.'
    },

    'SEKAI_BEST_HOST': 'api.sekai.best',

    'CONDENSED': '📱',
};