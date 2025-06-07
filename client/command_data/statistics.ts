// client/command_data/statistics.ts
/**
 * @fileoverview Used to get statistics about a user
 * @author Ai0796
 */

import { CommandInfo } from '../methods/generateSlashCommand'; // Assuming CommandInfo exists

export const INFO: CommandInfo = {
    'name': 'statistics',
    'utilization': '/statistics',
    'description': 'Get statistics about a users performance this event and the past hour',
    'ephemeral': false,
    'subcommands': [
        {
            'name': 'cutoff',
            'description': 'Get graph of a tier cutoff over time',
            'params': [
                {
                    'type': 'integer',
                    'name': 'tier',
                    'required': true,
                    'description': 'The cutoff tier specified',
                },
                {
                    'type': 'integer',
                    'name': 'event',
                    'required': false,
                    'description': 'The event to display for',
                },
                {
                    'type': 'integer',
                    'name': 'chapter',
                    'required': false,
                    'description': 'The chapter to display for (World Link Only)',
                    'autocomplete': true
                }
            ]
        },
        {
            'name': 'user',
            'description': 'Get graph of a user over time',
            'params': [
                {
                    'type': 'user',
                    'name': 'user',
                    'required': true,
                    'description': 'A linked User that has been tracked'
                },
                {
                    'type': 'integer',
                    'name': 'event',
                    'required': false,
                    'description': 'The event to display for',
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

    'INTERACTION_TIME': 60000,
};