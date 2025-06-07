// client/command_data/twittertracker.ts
/**
 * @fileoverview Command Data & Constants Related to the /track command
 * These constants are used to dynamically generate a slash command on discord.
 * This File also contains the constants and error values used exclusively in the /graph command.
 * @author Ai0796
 */

import { CommandInfo } from '../methods/generateSlashCommand'; // Assuming CommandInfo exists

export const INFO: CommandInfo = {
    'name': 'twittertracker',
    'utilization': '/twittertracker',
    'description': 'Add a tracker to a twitter account for this channel',
    'ephemeral': true,
    'subcommands': [
        {
            'name': 'add',
            'description': 'Add a tracker to a twitter account for this channel',
            'params': [
                {
                    'type': 'string',
                    'name': 'username',
                    'required': true,
                    'description': 'The Twitter handle to track'
                },
                {
                    'type': 'role',
                    'name': 'role',
                    'required': false,
                    'description': 'The role to ping when a tweet is posted'
                }
            ]
        },
        {
            'name': 'remove',
            'description': 'Remove a tracker from a twitter account for this channel',
            'params': [
                {
                    'type': 'string',
                    'name': 'username',
                    'required': true,
                    'description': 'The Twitter handle to remove'
                }
            ]
        }
    ],

    'adminOnly': true
};

export const CONSTANTS = {
    'INVALID_CHANNEL_ERR': {
        type: 'Error',
        message: 'The channel you have selected is not a valid text channel.'
    },

    'CORRECT': '✅',
    'INCORRECT': '❌',
};