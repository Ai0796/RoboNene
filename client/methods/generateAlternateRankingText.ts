// client/methods/generateAlternateRankingText.ts
import { RESULTS_PER_PAGE } from '../../constants';

let MAXLENGTH = 41; // This is a mutable global in the original, consider refactoring if truly problematic

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
const generateAlternateRankingText = (data: UserRanking[], page: number, target: number | null, hourBeforeData: number[], gamesPlayed: number[], GPH: number[], mobile: boolean): string => {
  const rankLabel = 'T';
  const nameLabel = 'Name';
  const scoreLabel = 'Score/GH';
  const gamesLabel = 'Games';
  const changeLabel = 'GPH';

  //Ignore this
  if (mobile) {
    MAXLENGTH = 30;
  } else {
    MAXLENGTH = 41;
  }

  let maxRankLength = rankLabel.length;
  let maxNameLength = nameLabel.length;
  let maxScoreLength = scoreLabel.length;
  let maxGamesLength = gamesLabel.length;
  let maxChangeLength = changeLabel.length;

  const changes: number[] = [];
  data.forEach((user, i) => {
    changes.push(user.score - hourBeforeData[i]);
  });

  data.forEach((user, i) => {
    if (user.rank.toString().length > maxRankLength) {
      maxRankLength = user.rank.toString().length;
    }

    user.name = user.name.replace(/[\n\t]/g, '').trim();

    if (user.name.length > maxNameLength) {
      maxNameLength = user.name.length;
    }

    // Calculate score string length (EP/Game or Score/GH)
    let scoreStrForLength: string;
    if (GPH[i] === -1 || GPH[i] === 0 || changes[i] === -1) {
      scoreStrForLength = 'N/A';
    } else {
      scoreStrForLength = (changes[i] / GPH[i]).toLocaleString(undefined, floatSettings);
    }
    if (scoreStrForLength.length > maxScoreLength) {
      maxScoreLength = scoreStrForLength.length;
    }

    if (gamesPlayed[i].toLocaleString().length > maxGamesLength) {
      maxGamesLength = gamesPlayed[i].toLocaleString().length;
    }
    if (GPH[i].toLocaleString().length > maxChangeLength) {
      maxChangeLength = GPH[i].toLocaleString().length;
    }
  });

  let difference = Math.max(0, (maxRankLength + maxNameLength + maxScoreLength + maxGamesLength + maxChangeLength) - MAXLENGTH);
  maxNameLength -= difference;

  let leaderboardText = '';
  const rankHeader = ' '.repeat(maxRankLength - rankLabel.length) + rankLabel;
  const nameHeader = nameLabel + ' '.repeat(maxNameLength - nameLabel.length);
  const scoreHeader = scoreLabel + ' '.repeat(maxScoreLength - scoreLabel.length);
  const gamesHeader = ' '.repeat(maxGamesLength - gamesLabel.length) + gamesLabel;
  const changeHeader = ' '.repeat(maxChangeLength - changeLabel.length) + changeLabel;
  leaderboardText += `\`${rankHeader} ${nameHeader} ${scoreHeader} ${gamesHeader} ${changeHeader}\``;
  leaderboardText += '\n';

  for (let i = 0; i < RESULTS_PER_PAGE; i++) {
    if (i >= data.length) { // Corrected boundary condition
      leaderboardText += '\u200b';
      break;
    }

    const user = data[i];

    const rankFormatted = ' '.repeat(maxRankLength - user.rank.toString().length) + user.rank;

    const nameStr = user.name.substring(0, maxNameLength).replace('`', '\'');
    const nameFormatted = nameStr + ' '.repeat(maxNameLength - nameStr.length);

    let scoreStr: string;
    if (GPH[i] === -1 || GPH[i] === 0 || changes[i] === -1) {
      scoreStr = 'N/A';
    } else {
      scoreStr = (changes[i] / GPH[i]).toLocaleString(undefined, floatSettings);
    }
    const scoreFormatted = ' '.repeat(maxScoreLength - scoreStr.length) + scoreStr;

    let gamesStr: string;
    if (gamesPlayed[i] === -1) {
      gamesStr = 'N/A';
    } else {
      gamesStr = (gamesPlayed[i]).toLocaleString();
    }
    const gamesFormatted = ' '.repeat(maxGamesLength - gamesStr.length) + gamesStr;

    let changeStr: string;
    if (GPH[i] === -1) {
      changeStr = 'N/A';
    } else {
      changeStr = (GPH[i]).toLocaleString();
    }
    const changeFormatted = ' '.repeat(maxChangeLength - changeStr.length) + changeStr;

    leaderboardText += `\`${rankFormatted} ${nameFormatted} ${scoreFormatted} ${gamesFormatted} ${changeFormatted}\``;
    if ((page * RESULTS_PER_PAGE) + i + 1 === target) {
      leaderboardText += '⭐';
    }
    leaderboardText += '\n';
  }

  return leaderboardText;
};

export default generateAlternateRankingText;