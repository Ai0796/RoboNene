/**
 * @fileoverview Command Data & Constants Related to the /about command
 * These constants are used to dynamically generate a slash command on discord.
 * This File also contains the constants values used exclusively in the /about command.
 * @author Ai0796
 */

module.exports = {
    'INFO': {
        'name': 'rmdle',
        'utilization': '/rmdle',
        'description': 'have fun',
        'ephemeral': true,
        'params': [
            {
                'type': 'integer',
                'name': 'code',
                'required': true,
                'description': 'The room code',
            }
        ]
    },

    'CONSTANTS': {}
};