// client/command_data/quiz.ts
/**
 * @fileoverview Command Data & Constants Related to the /quiz command
 * These constants are used to dynamically generate a slash command on discord.
 * This File also contains the constants values used exclusively in the /quiz command.
 * @author Potor10
 */

import { CommandInfo } from '../methods/generateSlashCommand'; // Assuming CommandInfo exists

export const INFO: CommandInfo = {
  'name': 'quiz',
  'utilization': '/quiz',
  'description': 'A Fun Project Sekai Quiz!',
  'ephemeral': false
};

export const CONSTANTS = {
  'WRONG_USER_ERR': {
    'type': 'Error',
    'message': 'You are not the intended user for this interaction.\nPlease use /quiz to start your own quiz.'
  },

  'QUESTION_RIGHT_TYPE': 'Correct ✅',
  'QUESTION_RIGHT_MSG': 'You have answered the question **correctly**!',

  'QUESTION_WRONG_TYPE': 'Incorrect ❌',
  'QUESTION_WRONG_MSG': 'You have answered the question **incorrectly**!',

  'QUESTION_TIMEOUT_TYPE': 'Timeout ❌',
  'QUESTION_TIMEOUT_MSG': 'There was no response within the allotted time.',

  'LINK_MSG': 'Link an account to save your progress',

  'INTERACTION_TIME': 30000,

  '1': '1️⃣',
  '2': '2️⃣',
  '3': '3️⃣',
  '4': '4️⃣'
};