/**
 * @fileoverview Command Data & Constants Related to the /graph command
 * These constants are used to dynamically generate a slash command on discord.
 * This File also contains the constants and error values used exclusively in the /graph command.
 * @author Potor10
 */

module.exports = {
  'INFO': {
    'name': 'graph',
    'utilization': '/graph',
    'description': 'Display a graph displaying the historical amount of points for this event',
    'ephemeral': false,
    'subcommands': [
      {
        'name': 'cutoff',
        'description': 'Get graph of a tier cutoff over time',
        'params' : [
          {
            'type': 'integer',
            'name': 'tier',
            'required': true,
            'description': 'The cutoff tier specified',
          },
          {
            'type': 'boolean',
            'name': 'by_tier',
            'required': false,
            'description': 'Whether to graph by tier or by id (defaults to ID)',
          },
          {
            'type': 'string',
            'name': 'event',
            'required': false,
            'description': 'The event to display for, multiple events can be entered in the format {id}, {id}, etc.',
          }
        ]
      },
      {
        'name': 'user',
        'description': 'Get graph of a user over time',
        'params': [
          {
          'type': 'user',
          'name': 'user',
          'required': true,
          'description': 'A linked User that has been tracked'
          },
          {
            'type': 'string',
            'name': 'event',
            'required': false,
            'description': 'The event to display for, multiple events can be entered in the format {id}, {id}, etc.'
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
      'message': 'Please cloose a different cutoff tier'
    },
  
    'SEKAI_BEST_HOST': 'api.sekai.best'
  }
};