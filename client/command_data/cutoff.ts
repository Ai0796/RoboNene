// client/command_data/cutoff.ts
/**
 * @fileoverview Command Data & Constants Related to the /cutoff command
 * These constants are used to dynamically generate a slash command on discord.
 * This File also contains the constants values used exclusively in the /cutoff command.
 * @author Potor10
 */

import { CommandInfo } from '../methods/generateSlashCommand'; // Assuming CommandInfo exists

export const INFO: CommandInfo = {
  'name': 'cutoff',
  'utilization': '/cutoff',
  'description': 'Obtain detailed information about the cutoff', // Corrected typo: the the -> the
  'ephemeral': false,
  'params': [
    {
      'type': 'integer',
      'name': 'tier',
      'required': true,
      'description': 'The cutoff tier specified',
      'choices': [
        ['T10', 10],
        ['T20', 20],
        ['T30', 30],
        ['T40', 40],
        ['T50', 50],
        ['T100', 100],
        ['T200', 200],
        ['T300', 300],
        ['T400', 400],
        ['T500', 500],
        ['T1000', 1000],
        ['T1500', 1500],
        ['T2000', 2000],
        ['T2500', 2500],
        ['T3000', 3000],
        ['T4000', 4000],
        ['T5000', 5000],
        ['T10000', 10000],
        ['T20000', 20000],
        ['T30000', 30000],
        ['T40000', 40000],
        ['T50000', 50000],
        ['T100000', 100000]
      ]
    },
    {
      'type': 'boolean',
      'name': 'detailed',
      'required': false,
      'description': 'Show extra detailed cutoff information'
    },
    {
      'type': 'boolean',
      'name': 'chapter',
      'required': false,
      'description': 'Get prediction for chapter (World Link only)'
    }
  ]
};

export const CONSTANTS = {
  'RATE_HOST': 'raw.githubusercontent.com',
  'RATE_PATH': '/potor10/SekaiCutoffRate/master/rank/rate.json',

  'RATE_LIMIT_ERR': {
    'type': 'Error',
    'message': 'You have reached the maximum amount of requests to the API. ' +
      'You have been temporarily rate limited.'
  },

  'NO_EVENT_ERR': {
    'type': 'Error',
    'message': 'There is currently no event going on'
  },

  'NO_DATA_ERR': {
    'type': 'Error',
    'message': 'There was a problem with retrieving ranking data from sekai.best'
  },

  'NO_RESPONSE_ERR': {
    'type': 'Error',
    'message': 'There was no response from the server. \nPlease wait ~10 minutes after ranking concludes before trying again.'
  },

  'BAD_INPUT_ERROR': {
    'type': 'Error',
    'message': 'There was an issue with your input parameters. Please try again.'
  },

  'SEKAI_BEST_HOST': 'api.sekai.best',

  'PRED_WARNING': 'You are trying to view predictions for a tier that is lower than 100. These tiers are highly volatile and thus it is highly not recommended to use the following cutoff predictions!',
  'PRED_DESC': 'Fits data into a least squares regression line to generate a prediction.',
  'WEIGHT_PRED_DESC': 'Uses weighted model that squares time for each data point. This model will tend to predict with more recent data',
  'SMOOTH_PRED_DESC': 'Uses a weighted average of estimations from previous models. Generally, smoothed estimates are more resilient to sudden changes in point gain.',
  'NORM_PRED_DESC': 'Uses a normal distribution to generate a prediction. This model will predict with more recent data',

  'NAIVE_DESC': 'Current Score + (Average Points Per Hour \\* Hours Left)',
  'NAIVE_LAST_HR_DESC': 'Current Score + (Average Points Per Hour [Last Hour] \\* Hours Left)'
};