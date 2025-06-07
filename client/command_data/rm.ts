// client/command_data/rm.ts
/**
 * @fileoverview contains information about the /rm command
 * @author Ai0796
 */

import { CommandInfo } from '../methods/generateSlashCommand'; // Assuming CommandInfo exists

export const INFO: CommandInfo = {
    'name': 'rm',
    'utilization': '/rm',
    'description': 'Changes the channel name to the given code and players',
    'ephemeral': false,
    'subcommands': [
        {
            'name': 'code',
            'description': 'Change a room\'s code',
            'params': [
                {
                    'type': 'integer',
                    'name': 'code',
                    'required': true,
                    'description': 'The new room code',
                }
            ]
        },
        {
            'name': 'players',
            'description': 'change a rooms players',
            'params': [
                {
                    'type': 'string',
                    'name': 'players',
                    'required': true,
                    'description': 'Players needed',
                    'choices': [
                        ['0 (Full)', 'f'],
                        ['1', '1'],
                        ['2', '2'],
                        ['3', '3'],
                        ['4', '4'],
                    ]
                }
            ]
        },
        {
            'name': 'both',
            'description': 'Change a room\'s code and players',
            'params': [
                {
                    'type': 'integer',
                    'name': 'code',
                    'required': false,
                    'description': 'The new room code',
                },
                {
                    'type': 'string',
                    'name': 'players',
                    'required': false,
                    'description': 'Players needed',
                    'choices': [
                        ['0 (Full)', 'f'],
                        ['1', '1'],
                        ['2', '2'],
                        ['3', '3'],
                        ['4', '4'],
                    ]
                }
            ]
        },
        {
            'name': 'close',
            'description': 'Close a room',
        }
    ]
};

export const CONSTANTS = {
    'WRONG_FORMAT': {
        'type': 'Error',
        'message': 'Wrong channel format. Channel name needs to be in the format *-#####'
    },
    'WRONG_CODE_LENGTH': {
        'type': 'Error',
        'message': 'Room code must be 5 characters long'
    },
    'ERROR': {
        'type': 'Error',
        'message': 'Error occured trying to change channel name.'
    },

    'INTERACTION_TIME': 30000,

    'YES': '✔',
    'NO': '❌',
};