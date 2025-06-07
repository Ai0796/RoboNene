// client/command_data/rank.ts
/**
 * @fileoverview Command Data & Constants Related to the /rank command
 * These constants are used to dynamically generate a slash command on discord.
 * This File also contains the constants values used exclusively in the /rank command.
 * @author Potor10
 */

import { CommandInfo } from '../methods/generateSlashCommand'; // Assuming CommandInfo exists

export const INFO: CommandInfo = {
  'name': 'rank',
  'utilization': '/rank',
  'description': 'Display your current ranking on the leaderboard.',
  'ephemeral': true,
  'params': [
    {
      'type': 'user',
      'name': 'user',
      'required': false,
      'description': 'An optional target in your current discord server'
    }
  ],

  'requiresLink': true
};

export const CONSTANTS = {
  'NO_ACC_ERROR': {
    'type': 'Error',
    'message': 'This user has not linked their project sekai account with the bot.'
  }
};