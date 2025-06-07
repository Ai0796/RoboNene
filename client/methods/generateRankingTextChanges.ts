// client/methods/generateRankingTextChanges.ts
/**
 * @fileoverview An implementation designed to efficiently generate an embed for a
 * leaderboard display, given ranking data along with change over the hour
 * @author Ai0796
 */

import { RESULTS_PER_PAGE } from '../../constants';

let MAXLENGTH = 42; // This is a mutable global in the original, consider refactoring if truly problematic

interface UserRanking {
  rank: number;
  name: string;
  score: number;
  userId: string;
}

const getTierChange = (change: number): string => {
    if (change > 0) {
        return `(↑${change})`;
    } else if (change < 0) {
        return `(↓${change * -1})`;
    }
    return '(-)';
};

/**
 * Generates an ranking embed from the provided params
 * @param {UserRanking[]} data a collection of player data on the leaderboard
 * @param {number} page the current page (if applicable)
 * @param {number | null} target the rank that we will highlight on the embed with a star
 * @param {number[]} changes an array of old score values correlating to data
 * @param {number[]} tierChanges an array of old tier values correlating to data
 * @param {boolean} mobile whether it's a mobile display or not
 * @return {string} a generated embed of the current leaderboard
 */
const generateRankingTextChanges = (data: UserRanking[], page: number, target: number | null, changes: number[], tierChanges: number[], mobile: boolean): string => {
    let rankLabel = 'T';
    let nameLabel = 'Name';
    let scoreLabel = 'Score'; 
    let changeLabel = 'Change Hr';

    //Ignore this
    if (mobile) {
        MAXLENGTH = 30;
    } else {
        MAXLENGTH = 42;
    }

    let maxRankLength = rankLabel.length;
    let maxRankChangeLength = 0;
    let maxNameLength = nameLabel.length;
    let maxScoreLength = scoreLabel.length;
    let maxChangeLength = changeLabel.length;

    data.forEach((user, i) => {
        if (user.rank.toString().length > maxRankLength) {
            maxRankLength = user.rank.toString().length;
        }
        if (getTierChange(tierChanges[i]).length > maxRankChangeLength) {
            maxRankChangeLength = getTierChange(tierChanges[i]).length;
        }

        user.name = user.name.replace(/[\n\t]/g, '').trim();

        if (user.name.length > maxNameLength) {
            maxNameLength = user.name.length;
        }
        if (user.score.toLocaleString().length > maxScoreLength) {
            maxScoreLength = user.score.toLocaleString().length;
        }
        // Ensure changes[i] is a valid number before using it in toLocaleString
        const formattedChange = (data[i].score - (changes[i] !== -1 ? changes[i] : 0)).toLocaleString();
        if (formattedChange.length > maxChangeLength) {
            maxChangeLength = formattedChange.length;
        }
    });

    let difference = Math.max(0, (maxRankLength + maxRankChangeLength + maxNameLength + maxScoreLength + maxChangeLength) - MAXLENGTH);
    maxNameLength -= difference;

    let leaderboardText = '';
    let rank = ' '.repeat(maxRankLength + maxRankChangeLength - rankLabel.length) + rankLabel;
    let name = nameLabel + ' '.repeat(maxNameLength - nameLabel.length);
    let score = scoreLabel + ' '.repeat(maxScoreLength - scoreLabel.length);
    let change = ' '.repeat(maxChangeLength - changeLabel.length) + changeLabel;
    leaderboardText += `\`${rank} ${name} ${score} ${change}\``;
    leaderboardText += '\n';
    for (let i = 0; i < RESULTS_PER_PAGE; i++) {
        if (i >= data.length) { // Corrected boundary condition
            leaderboardText += '\u200b';
            break;
        }

        let rankStr = ' '.repeat(maxRankLength - data[i].rank.toString().length) + data[i].rank;
        rankStr += getTierChange(tierChanges[i]) + ' '.repeat(maxRankChangeLength - getTierChange(tierChanges[i]).length);
        let nameStr = data[i].name.substring(0, maxNameLength).replace('`', '\'');
        let nameFormatted = nameStr + ' '.repeat(maxNameLength - nameStr.length);
        let scoreFormatted = ' '.repeat(maxScoreLength - data[i].score.toLocaleString().length) +
            data[i].score.toLocaleString();

        let changeStr = '';
        if (changes[i] === -1) {
            changeStr = 'NaN';
        } else {
            changeStr = (data[i].score - changes[i]).toLocaleString();
        }
        let changeFormatted = ' '.repeat(maxChangeLength - changeStr.length) + 
            changeStr;

        leaderboardText += `\`${rankStr} ${nameFormatted} ${scoreFormatted} ${changeFormatted}\``;
        if ((page * RESULTS_PER_PAGE) + i + 1 === target) {
            leaderboardText += '⭐';
        }
        leaderboardText += '\n';
    }

    return leaderboardText;
};

export default generateRankingTextChanges;