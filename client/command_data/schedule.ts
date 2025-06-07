// client/command_data/schedule.ts
/**
 * @fileoverview Command Data & Constants Related to the /schedule command
 * These constants are used to dynamically generate a slash command on discord.
 * This File also contains the constants values used exclusively in the /schedule command.
 * @author Potor10
 */

import { CommandInfo } from '../methods/generateSlashCommand'; // Assuming CommandInfo exists

export const INFO: CommandInfo = {
  'name': 'schedule',
  'utilization': '/schedule',
  'description': 'Get the current datamined schedule information.',
  'ephemeral': false,
  'params': [
    {
      'type': 'boolean',
      'name': 'show-vlive',
      'required': false,
      'description': 'whether to show the virtual lives'
    }
  ]
};

export const CONSTANTS = {}; // No constants in original