/**
 * @fileoverview Command Data & Constants Related to the /hist command
 * These constants are used to dynamically generate a slash command on discord.
 * This File also contains the constants and error values used exclusively in the /hist command.
 * @author Ai0796
 */

module.exports = {
  'INFO': {
    'name': 'hist',
    'utilization': '/hist',
    'description': 'Display a histogram displaying the historical amount of points for a user or tier',
    'ephemeral': false,
    'subcommands': [
      {
        'name': 'cutoff',
        'description': 'Get histogram of a tier cutoff over time',
        'params' : [
          {
            'type': 'integer',
            'name': 'tier',
            'required': true,
            'description': 'The cutoff tier specified',
          },
          {
            'type': 'integer',
            'name': 'binsize',
            'required': false,
            'description': 'Custom size of bin on the histogram'
          },
          {
            'type': 'integer',
            'name': 'min',
            'required': false,
            'description': 'Custom maximum value on the histogram'
          },
          {
            'type': 'integer',
            'name': 'max',
            'required': false,
            'description': 'Custom minimum value on the histogram'
          },
          {
            'type': 'integer',
            'name': 'event',
            'required': false,
            'description': 'The event to display for',
          },
          {
            'type': 'boolean',
            'name': 'hourly',
            'required': false,
            'description': 'Graph hourly instead of per game'
          },
          {
            'type': 'boolean',
            'name': 'games',
            'required': false,
            'description': 'Graph games instead of points'
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
        'description': 'Get histogram of a user over time',
        'params': [
          {
          'type': 'user',
          'name': 'user',
          'required': true,
          'description': 'A linked User that has been tracked'
          },
          {
            'type': 'integer',
            'name': 'binsize',
            'required': false,
            'description': 'Custom size of bin on the histogram'
          },
          {
            'type': 'integer',
            'name': 'min',
            'required': false,
            'description': 'Custom maximum value on the histogram'
          },
          {
            'type': 'integer',
            'name': 'max',
            'required': false,
            'description': 'Custom minimum value on the histogram'
          },
          {
            'type': 'integer',
            'name': 'event',
            'required': false,
            'description': 'The event to display for',
          },
          {
            'type': 'boolean',
            'name': 'hourly',
            'required': false,
            'description': 'Graph hourly instead of per game'
          },
          {
            'type': 'boolean',
            'name': 'games',
            'required': false,
            'description': 'Graph games instead of points'
          }
        ]
      }
    ]
  },

  'CONSTANTS': {
    'NO_EVENT_ERR': {
      'type': 'Error',
      'message': 'There is currently no event going on'
    },
  
    'NO_DATA_ERR': {
      'type': 'Error',
      'message': 'Couldn\'t find anything, what a surprise.'
    },
  
    'SEKAI_BEST_HOST': 'api.sekai.best'
  }
};