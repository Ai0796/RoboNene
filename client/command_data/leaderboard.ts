// client/command_data/leaderboard.ts
/**
 * @fileoverview Command Data & Constants Related to the /leaderboard command
 * These constants are used to dynamically generate a slash command on discord.
 * This File also contains the constants and error values used exclusively in the /leaderboard command.
 * @author Potor10
 */

import { CommandInfo } from '../methods/generateSlashCommand'; // Assuming CommandInfo exists

export const INFO: CommandInfo = {
  'name': 'leaderboard',
  'utilization': '/leaderboard',
  'description': 'Show the current T100 leaderboard',
  'ephemeral': false,
  'params': [
    {
      'type': 'integer',
      'name': 'rank',
      'required': false,
      'description': 'Optional rank to jump to.'
    }
  ]
};

export const CONSTANTS = {
  'RATE_LIMIT_ERR': {
    'type': 'Error',
    'message': 'You have reached the maximum amount of requests to the API. ' +
      'You have been temporarily rate limited.'
  },

  'BAD_INPUT_ERROR': {
    'type': 'Error',
    'message': 'There was an issue with your input parameters. Please try again.'
  },

  'NO_RESPONSE_ERR': {
    'type': 'Error',
    'message': 'There was no response from the server. Please try again.'
  },

  'NO_EVENT_ERR': {
    'type': 'Error',
    'message': 'There is currently no event going on'
  },

  'BAD_RANGE_ERR': {
    'type': 'Error',
    'message': 'Please choose a rank within the range of 1 to 120'
  },

  'WRONG_USER_ERR': {
    'type': 'Error',
    'message': 'You are not the intended user for this interaction.\nPlease try again after using /leaderboard.'
  },

  'INTERACTION_TIME': 60000,

  'LEFT': '⬅️',
  'RIGHT': '➡️',
  'MOBILE': '📲',
  'OFFSET': '🔃',
  'ALT': '🔀',
  'LINK': '🌸',
};