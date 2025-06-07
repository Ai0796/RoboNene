// client/command_data/profile.ts
/**
 * @fileoverview Command Data & Constants Related to the /profile command
 * These constants are used to dynamically generate a slash command on discord.
 * This File also contains the constants values used exclusively in the /profile command.
 * @author Potor10
 */

import { CommandInfo } from '../methods/generateSlashCommand'; // Assuming CommandInfo exists

export const INFO: CommandInfo = {
  'name': 'profile',
  'utilization': '/profile',
  'description': 'Display your project sekai profile.',
  'ephemeral': false,
  'subcommands': [
    {
      'name': 'id',
      'description': 'Get a profile by user id',
      'params': [
        {
          'type': 'string',
          'name': 'id',
          'required': true,
          'description': 'An optional Project Sekai user ID target'
        }
      ]
    },
    {
      'name': 'user',
      'description': 'Get a profile by discord user',
      'params': [
        {
          'type': 'user',
          'name': 'user',
          'required': true,
          'description': 'A linked User that has been linked to Ghost Nene'
        }
      ]
    },
    {
      'name': 'self',
      'description': 'Get a profile of yourself'
    }
  ],

  'requiresLink': true
};

export const CONSTANTS = {
  'RATE_LIMIT_ERR': {
    'type': 'Error',
    'message': 'You have reached the maximum amount of requests to the API. ' +
      'You have been temporarily rate limited.'
  },

  'NO_ACC_ERR': {
    'type': 'Error',
    'message': 'Did you just try to profile yourself without ever linking your account?'
  },

  'BAD_ID_ERR': {
    'type': 'Error',
    'message': 'Have you ever heard of a valid ID? Because that\'s not one.'
  },

  'BAD_ACC_ERR': {
    'type': 'Error',
    'message': 'Whoever you\'re trying to profile, they didn\'t link.'
  },

  'PRIVATE': {
    'type': 'Error',
    'message': 'This user has their profile set to private.'
  },

  'cool': '<:attCool:930717822756204575>',
  'cute': '<:attCute:930717822529732659>',
  'happy': '<:attHappy:930717823066595358>',
  'mysterious': '<:attMysterious:930717823217582080>',
  'pure': '<:attPure:930717823414714438>',
  'BLANK_EMOJI': '<:blank:930716814986588170>'
};