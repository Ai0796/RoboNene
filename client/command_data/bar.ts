// client/command_data/bar.ts
/**
 * @fileoverview Command Data & Constants Related to the /bar command
 * These constants are used to dynamically generate a slash command on discord.
 * This File also contains the constants and error values used exclusively in the /heatmap command.
 * @author Ai0796
 */

import { CommandInfo } from '../methods/generateSlashCommand'; // Assuming CommandInfo exists

export const INFO: CommandInfo = {
  'name': 'bar',
  'utilization': '/bar',
  'description': 'Display a bar graph displaying the EP gain over a certain hour',
  'ephemeral': false,
  'subcommands': [
    {
      'name': 'cutoff',
      'description': 'Get bar graph of a tier cutoff over an hour',
      'params': [
        {
          'type': 'integer',
          'name': 'tier',
          'required': true,
          'description': 'The cutoff tier specified',
        },
        {
          'type': 'integer',
          'name': 'hour',
          'required': false,
          'description': 'The hour to display for',
          'minValue': 0
        },
        {
          'type': 'integer',
          'name': 'event',
          'required': false,
          'description': 'The event to display for',
        }
      ]
    },
    {
      'name': 'user',
      'description': 'Get bar graph of a user over a specific hour',
      'params': [
        {
          'type': 'user',
          'name': 'user',
          'required': true,
          'description': 'A linked User that has been tracked'
        },
        {
          'type': 'integer',
          'name': 'hour',
          'required': false,
          'description': 'Hour to display for',
          'minValue': 0
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
    'message': 'Did you seriously try to heatmap events that don\'t exist'
  },

  'NO_DATA_ERR': {
    'type': 'Error',
    'message': 'No data found (not like your data is work keeping track of anyways)' // Corrected typo: work -> worth
  },

  'WRONG_USER_ERR': {
    'type': 'Error',
    'message': 'You are not the intended user for this interaction.\nPlease try again after using /leaderboard.'
  },

  'SEKAI_BEST_HOST': 'api.sekai.best',

  'LEFT': '⬅️',
  'RIGHT': '➡️',
};