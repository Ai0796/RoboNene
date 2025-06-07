// client/command_data/spy.ts
/**
 * @fileoverview Command Data & Constants Related to the /spy command
 * These constants are used to dynamically generate a slash command on discord.
 * This File also contains the constants values used exclusively in the /spy command.
 * @author Potor10
 */

import { CommandInfo } from '../methods/generateSlashCommand'; // Assuming CommandInfo exists

export const INFO: CommandInfo = {
  'name': 'spy',
  'utilization': '/spy',
  'description': 'Get information of any position on the leaderboard.',
  'ephemeral': true,
  'subcommands': [
    {
      'name': 'player',
      'description': 'Get information on another player\'s ranking on the leaderboard.',
      'params': [
        {
          'type': 'string',
          'name': 'id',
          'required': true,
          'description': 'The ID of the Project Sekai account you are trying to find on the leaderboard.'
        }
      ]
    },
    {
      'name': 'tier',
      'description': 'Get information on a specific tier on the leaderboard.',
      'params': [
        {
          'type': 'integer',
          'name': 'tier',
          'required': true,
          'description': 'The tier that you want to get information on.'
        }
      ]
    }
  ],

  'requiresLink': true
};

export const CONSTANTS = {
  'BAD_ID_ERR': {
    'type': 'Error',
    'message': 'You have provided an invalid ID.'
  },

  'BAD_INPUT_ERROR': {
    'type': 'Error',
    'message': 'You have provided an invalid input.'
  }
};