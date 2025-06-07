// client/command_data/heatmap.ts
/**
 * @fileoverview Command Data & Constants Related to the /heatmap command
 * These constants are used to dynamically generate a slash command on discord.
 * This File also contains the constants and error values used exclusively in the /heatmap command.
 * @author Ai0796
 */

import { CommandInfo } from '../methods/generateSlashCommand'; // Assuming CommandInfo exists
import { ChannelType } from 'discord.js'; // Assuming ChannelType exists

const palatteChoices: [string, number][] = [ // Added type for choices
  ['Default', 0],
  ['Legacy', 1],
  ['Ankoha', 2],
  ['Cinema', 3],
  ['Shinonome', 4],
  ['Miracle Paint', 5],
  ['Emu', 6]
];

export const INFO: CommandInfo = {
  'name': 'heatmap',
  'utilization': '/heatmap',
  'description': 'Display a heatmap displaying the games played every hour',
  'ephemeral': false,
  'subcommands': [
    {
      'name': 'cutoff',
      'description': 'Get heatmap of a tier cutoff over time',
      'params': [
        {
          'type': 'integer',
          'name': 'tier',
          'required': true,
          'description': 'The cutoff tier specified',
        },
        {
          'type': 'integer',
          'name': 'offset',
          'required': false,
          'description': 'Offset from UTC',
          'minValue': 0,
          'maxValue': 23
        },
        {
          'type': 'integer',
          'name': 'event',
          'required': false,
          'description': 'The event to display for',
        },
        {
          'type': 'integer',
          'name': 'pallete',
          'required': false,
          'description': 'The color palette to use', // Corrected typo: pallete -> palette
          'choices': palatteChoices
        },
        {
          'type': 'boolean',
          'name': 'annotategames',
          'required': false,
          'description': 'Show the games played on the graph, if points will show points instead'
        },
        {
          'type': 'boolean',
          'name': 'bypoints',
          'required': false,
          'description': 'Show the points gained instead of games played'
        },
        {
          'type': 'integer',
          'name': 'chapter',
          'required': false,
          'description': 'The chapter to display for (World Link Only)',
          'autocomplete': true
        }
      ]
    },
    {
      'name': 'user',
      'description': 'Get heatmap of a user over time',
      'params': [
        {
          'type': 'user',
          'name': 'user',
          'required': true,
          'description': 'A linked User that has been tracked'
        },
        {
          'type': 'integer',
          'name': 'offset',
          'required': false,
          'description': 'Offset from hour 0 (Defaults to 18, EST Start time)',
          'minValue': 0,
          'maxValue': 23
        },
        {
          'type': 'integer',
          'name': 'event',
          'required': false,
          'description': 'The event to display for',
        },
        {
          'type': 'integer',
          'name': 'pallete',
          'required': false,
          'description': 'The color palette to use', // Corrected typo: pallete -> palette
          'choices': palatteChoices
        },
        {
          'type': 'boolean',
          'name': 'annotategames',
          'required': false,
          'description': 'Show the games played on the graph'
        },
        {
          'type': 'boolean',
          'name': 'bypoints',
          'required': false,
          'description': 'Show the points gained instead of games played'
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
    'message': 'No data found (not like your data is worth keeping track of anyways)' // Corrected typo: work -> worth
  },

  'SEKAI_BEST_HOST': 'api.sekai.best'
};