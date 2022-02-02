module.exports = {
  'INFO': {
    'name': 'leaderboard',
    'utilization': '/leaderboard',
    'description': 'Show the current T100 leaderboard',
    'params': [
      {
        'type': 'integer',
        'name': 'rank',
        'required': false,
        'description': 'Optional rank to jump to.'
      }
    ]
  },

  'CONSTANTS': {
    'BAD_INPUT_ERROR': {
      'type': 'Error',
      'message': 'There was an issue with your input parameters. Please try again.'
    },
  
    'NO_RESPONSE_ERR': {
      'type': 'Error',
      'message': 'There whas no response from the server. Plase try again.'
    },

    'NO_EVENT_ERR': {
      'type': 'Error',
      'message': 'There is currently no event going on'
    },
  
    'BAD_RANGE_ERR': {
      'type': 'Error',
      'message': 'Please choose a rank within the range of 1 to 100'
    },

    'WRONG_USER_ERR': {
      'type': 'Error',
      'message': 'You are not the intended user for this interaction.\nPlease try again after using /leaderboard.'
    },
  
    'LEFT': '⬅️',
    'RIGHT': '➡️'
  }
}