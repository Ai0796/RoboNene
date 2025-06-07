/**
 * @fileoverview An implementation designed to efficiently generate an embed for a
 * leaderboard display, given ranking data along with change over the hour
 * @author Ai0796
 */

const { RESULTS_PER_PAGE } = require('../../constants');
var MAXLENGTH = 42;

const getTierChange = (change) => {
    if(change > 0) {
        return `(↑${change})`;
    } else if(change < 0) {
        return `(↓${change * -1})`;
    }
    return '(-)';
};

/**
 * Generates an ranking embed from the provided params
 * @param {Object} data a collection of player data on the leaderboard
 * @param {Integer} page the current page (if applicable)
 * @param {Integer} target the rank that we will highlight on the embed with a star
 * @param {Object} changes an array of old score values correlating to data
 * @param {Boolean} mobile whether it's a mobile display or not
 * @return {MessageEmbed} a generated embed of the current leaderboard
 */
const generateRankingText = (data, page, target, changes, tierChanges, mobile) => {
    let rankLabel = 'T';
    let nameLabel = 'Name';
    let scoreLabel = 'Score'; 
    let changeLabel = 'Change Hr';

    //Ignore this
    if(mobile) {
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
        if (((data[i].score - changes[i])).toLocaleString().length > maxChangeLength) {
            maxChangeLength = ((data[i].score - changes[i])).toLocaleString().length;
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
        if (i > data.length) {
            leaderboardText += '\u200b';
            break;
        }

        let rank = ' '.repeat(maxRankLength - data[i].rank.toString().length) + data[i].rank;
        rank += getTierChange(tierChanges[i]) + ' '.repeat(maxRankChangeLength - getTierChange(tierChanges[i]).length);
        let nameStr = data[i].name.substring(0, maxNameLength).replace('`', '\'');
        let name = nameStr + ' '.repeat(maxNameLength - nameStr.length);
        let score = ' '.repeat(maxScoreLength - data[i].score.toLocaleString().length) +
            data[i].score.toLocaleString();

        let changeStr = '';
        if(changes[i] === -1) {
            changeStr = 'NaN';
        } else {
            changeStr = (data[i].score - changes[i]).toLocaleString();
        }
        let change = ' '.repeat(maxChangeLength - changeStr.length) + 
            changeStr;

        leaderboardText += `\`${rank} ${name} ${score} ${change}\``;
        if ((page * RESULTS_PER_PAGE) + i + 1 === target) {
            leaderboardText += '⭐';
        }
        leaderboardText += '\n';
    }

    return leaderboardText;
};

module.exports = generateRankingText;