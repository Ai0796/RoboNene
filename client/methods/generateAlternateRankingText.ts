// client/methods/generateAlternateRankingText.ts
import { RESULTS_PER_PAGE } from '../../constants';

let MAXLENGTH = 42; // This is a mutable global in the original, consider refactoring if truly problematic

const floatSettings: Intl.NumberFormatOptions = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
};

interface UserRanking {
  rank: number;
  name: string;
  score: number;
  userId: string;
}

/**
 * Gets the tier change string.
 * @param {number} change The change in tier.
 * @returns {string} The formatted tier change string.
 */
const getTierChange = (change: number): string => {
  if (change > 0) {
    return `(↑${change})`;
  } else if (change < 0) {
    return `(↓${change * -1})`;
  }
  return '(-)';
};

/**
 * Generates ranking text for an alternative leaderboard display.
 * @param {UserRanking[]} data A collection of player data on the leaderboard.
 * @param {number} page The current page (if applicable).
 * @param {number | null} target The rank that will be highlighted with a star.
 * @param {number[]} hourBeforeData An array of old score values correlating to data.
 * @param {number[]} gamesPlayed An array of games played.
 * @param {number[]} GPH An array of games per hour.
 * @param {boolean} mobile Whether it's a mobile display or not.
 * @returns {string} A generated string of the current leaderboard.
 */
const generateAlternateRankingText = (