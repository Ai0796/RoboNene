// client/methods/generateRankingText.ts
/**
 * @fileoverview An implementation designed to efficiently generate an embed for a
 * leaderboard display, given ranking data
 * @author Potor10
 */

import { RESULTS_PER_PAGE } from '../../constants';

interface UserRanking {
  rank: number;
  name: string;
  score: number;
  userId: string;
}

/**
 * Generates an ranking embed from the provided params
 * @param {UserRanking[]} data a collection of player data on the leaderboard
 * @param {number} page the current page (if applicable)
 * @param {number | null} target the rank that we will highlight on the embed with a star
 * @return {string} a generated embed of the current leaderboard
 */
const generateRankingText = (data: UserRanking[], page: number, target: number | null): string => {
  let maxRankLength = 0;
  let maxNameLength = 0;
  let maxScoreLength = 0;

  data.forEach((user) => {
    if (user.rank.toString().length > maxRankLength) {
      maxRankLength = user.rank.toString().length;
    }

    user.name = user.name.replace(/[\n\t]/g, '').trim();

    if (user.name.length > maxNameLength) {
      maxNameLength = user.name.length;
    }
    if (user.score.toLocaleString().length > maxScoreLength) {
      maxScoreLength = user.score.toLocaleString().length;
    }
  });

  let leaderboardText = '';
  for (let i = 0; i < RESULTS_PER_PAGE; i++) {
    if (i >= data.length) { // Corrected boundary condition
      leaderboardText += '\u200b';
      break;
    }

    let rank = ' '.repeat(maxRankLength - data[i].rank.toString().length) + data[i].rank;
    let name = data[i].name + ' '.repeat(maxNameLength - data[i].name.length); 
    let score = ' '.repeat(maxScoreLength - data[i].score.toLocaleString().length) + 
      data[i].score.toLocaleString();
    
    leaderboardText += `\`\`${rank} ${name} ${score}\`\``;
    if ((page * RESULTS_PER_PAGE) + i + 1 === target) {
      leaderboardText += '⭐';
    } 
    leaderboardText += '\n';
  }

  return leaderboardText;
};

export default generateRankingText;