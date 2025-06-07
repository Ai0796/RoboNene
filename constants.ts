// constants.ts
/**
 * @fileoverview Constants utilized within the bot
 * @author Potor10
 */

export const BOT_NAME = 'Nene Robo';
export const BOT_ACTIVITY = () => {
  const activities = [
    'Beep Boop in ', 
    'Dreaming in ', 
    'Badmouthing '
  ];
  return activities[Math.floor(Math.random() * (activities.length - 1))];
};

// Default Error Shared Between Most Commands
export const ERR_COMMAND = {
  type: 'Error',
  message: 'Could not understand your command, please try again!'
};

// Rich Embed Information
export const NENE_COLOR = '#34DD9A';
export const FOOTER = 'Robo Nene';

// Results per page on leaderboard embeds (1-20)
export const RESULTS_PER_PAGE = 20;

// Max Requests Per Account Per Hour (120 ~1 request every 30 seconds)
export const RATE_LIMIT = 120;

//Amount of Time between Cutoff data in milliseconds
export const CUTOFF_INTERVAL = 60000;

//Amount of Time between Tracking requests in milliseconds
export const TRACK_INTERVAL = 15000;

//Amount of Time between Twitter calls
export const TWITTER_INTERVAL = 120000;

// Source of game data
export const DIR_DATA = './sekai_master';

// Event ID of last event access
export const LOCKED_EVENT_ID = 84;