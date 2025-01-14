/**
 * @fileoverview Creates a Waitlist Queue for users to join and leave
 * @author Ai0796
 */

module.exports = {
    'INFO': {
        'name': 'waitlist',
        'utilization': '/waitlist',
        'description': 'creates a waitlist queue for users to join and leave',
        'ephemeral': false,
        'subcommands': [
            {
                'name': 'show',
                'description': 'Shows the current waitlist queue',
            },
            {
                'name': 'remove',
                'description': 'Removes a user from the rooms waitlist',
                'params': [
                    {
                        'type': 'user',
                        'name': 'user',
                        'required': true,
                        'description': 'The user to remove'
                    }
                ]
            },
            {
                'name': 'clear',
                'description': 'Clears the waitlist in the current channel (removes song)'
            },
            {
                'name': 'leave',
                'description': 'Removes you from all waitlists'
            },
            {
                'name': 'song',
                'description': 'Sets the waitlist song',
                'params': [
                    {
                        'type': 'string',
                        'name': 'song',
                        'required': true,
                        'description': 'The song to set',
                        'autocomplete': true
                    }
                ]
            },
            {
                'name': 'leaving',
                'description': 'Sets when you expect to leave the waitlist',
                'params': [
                    {
                        'type': 'integer',
                        'minValue': 0,
                        'name': 'minutes',
                        'required': true,
                        'description': 'The time you expect to leave the waitlist in minutes'
                    }
                ]
            }
        ]
    },

    'CONSTANTS': {
        'NO_ACC_ERROR': {
            'type': 'Error',
            'message': 'This user has not linked their project sekai account with the bot.'
        }
    }
};