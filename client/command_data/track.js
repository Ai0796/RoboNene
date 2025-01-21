/**
 * @fileoverview Command Data & Constants Related to the /track command
 * These constants are used to dynamically generate a slash command on discord.
 * This File also contains the constants and error values used exclusively in the /graph command.
 * @author Ai0796
 */

module.exports = {
    'INFO': {
        'name': 'track',
        'utilization': '/track',
        'description': 'Track a rank to see if it moves and ping the user if it does',
        'ephemeral': false,
        'subcommands': [
            {
                'name': 'tier',
                'description': 'Track a tier to see if it moves and ping the user if it does',
                'params': [
                    {
                        'type': 'integer',
                        'name': 'tier',
                        'required': true,
                        'description': 'The tier specified on the leaderboard',
                        'maxValue': 100
                    },
                    {
                        'type': 'integer',
                        'name': 'cutoff',
                        'required': false,
                        'description': 'Optional cutoff to track e.g. 2,500,000 will alert you when the tier moves past 2.5mil'
                    }
                ]
            },
            {
                'name': 'user',
                'description': 'Tracks a specific tiers user to see if they hit a specific EP (max 5 per server)',
                'params': [
                    {
                        'type': 'integer',
                        'name': 'tier',
                        'required': true,
                        'description': 'A tier on the leaderboard',
                        'maxValue': 100
                    },
                    {
                        'type': 'integer',
                        'name': 'cutoff',
                        'required': false,
                        'description': 'Optional cutoff to track e.g. 2,500,000 will alert you when the user hits 2.5mil'
                    },
                    {
                        'type': 'integer',
                        'name': 'min',
                        'required': false,
                        'description': 'The minimum score to ping'
                    },
                    {
                        'type': 'integer',
                        'name': 'max',
                        'required': false,
                        'description': 'The maximum score to ping'
                    }
                ]
            },
            {
                'name': 'list',
                'description': 'List all the current tracked tiers/users (if Admin shows all in channel)',
            },
            {
                'name': 'remove',
                'description': 'Remove a tracked tier/user',
                'params': [
                    {
                        'type': 'integer',
                        'name': 'num',
                        'required': false,
                        'description': 'The tracker to remove'
                    }
                ]
            }
        ]
            
    },

    'CONSTANTS': {
        'NO_EVENT_ERR': {
            'type': 'Error',
            'message': 'The Current Event is over or there is no event running'
        },

        'NO_DATA_ERR': {
            'type': 'Error',
            'message': 'Please cloose a different cutoff tier'
        },

        'TIER_ERR': {
            'type': 'Error',
            'message': 'Please choose a cutoff Tier Less than or Equal to 100'
        },

        'SEKAI_BEST_HOST': 'api.sekai.best'
    }
};