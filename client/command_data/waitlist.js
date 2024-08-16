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
    },

    'CONSTANTS': {
        'NO_ACC_ERROR': {
            'type': 'Error',
            'message': 'This user has not linked their project sekai account with the bot.'
        }
    }
};