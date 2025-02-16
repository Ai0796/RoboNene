/**
 * @fileoverview An implementation designed to efficiently generate an embed for a
 * leaderboard display, given ranking data along with change over the hour
 * @author Ai0796
 */

const { RESULTS_PER_PAGE } = require('../../constants');
var MAXLENGTH = 42;

const floatSettings = {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
};

/**
 * Generates an ranking embed from the provided params
 * @param {Object} data a collection of player data on the leaderboard
 * @param {Integer} page the current page (if applicable)
 * @param {Integer} target the rank that we will highlight on the embed with a star
 * @param {Object} changes an array of old score values correlating to data
 * @param {Object} gamesPlayed an array of old score values correlating to data
 * @param {Object} GPH an array of old score values correlating to data
 * @param {Boolean} mobile whether it's a mobile display or not
 * @return {MessageEmbed} a generated embed of the current leaderboard
 */
const generateAlternateRankingText = (data, page, target, hourBeforeData, gamesPlayed, GPH, mobile) => {
    let rankLabel = 'T';
    let nameLabel = 'Name';
    let scoreLabel = 'Score/GH'; 
    let gamesLabel = 'Games';
    let changeLabel = 'GPH';

    //Ignore this
    if(mobile) {
        MAXLENGTH = 30;
    } else {
        MAXLENGTH = 41;
    }

    let maxRankLength = rankLabel.length;
    let maxNameLength = nameLabel.length;
    let maxScoreLength = scoreLabel.length;
    let maxGamesLength = gamesLabel.length;
    let maxChangeLength = changeLabel.length;

    let changes = [];
    data.forEach((user, i) => {
        changes.push(user.score - hourBeforeData[i]);
    });

    data.forEach((user, i) => {
        if (user.rank.toString().length > maxRankLength) {
            maxRankLength = user.rank.toString().length;
        }

        user.name = user.name.replace('\n', '').trim();

        if (user.name.length > maxNameLength) {
            maxNameLength = user.name.length;
        }
        if ((changes[i] / GPH[i]).toLocaleString(undefined, floatSettings).length > maxScoreLength) {
            maxScoreLength = (changes[i] / GPH[i]).toLocaleString(undefined, floatSettings).length;
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
    let rank = ' '.repeat(maxRankLength - rankLabel.length) + rankLabel;
    let name = nameLabel + ' '.repeat(maxNameLength - nameLabel.length);
    let score = scoreLabel + ' '.repeat(maxScoreLength - scoreLabel.length);
    let games = ' '.repeat(maxGamesLength - gamesLabel.length) + gamesLabel;
    let change = ' '.repeat(maxChangeLength - changeLabel.length) + changeLabel;
    leaderboardText += `\`${rank} ${name} ${score} ${games} ${change}\``;
    leaderboardText += '\n';
    for (let i = 0; i < RESULTS_PER_PAGE; i++) {
        if (i > data.length) {
            leaderboardText += '\u200b';
            break;
        }

        let rank = ' '.repeat(maxRankLength - data[i].rank.toString().length) + data[i].rank;
        let nameStr = data[i].name.substring(0, maxNameLength).replace('`', '\'');
        let name = nameStr + ' '.repeat(maxNameLength - nameStr.length);
        var scoreStr;
        if (GPH[i] == -1 || GPH[i] == 0 || changes[i] == -1) {
            scoreStr = 'N/A';
        } else {
            scoreStr = (changes[i] / GPH[i]).toLocaleString(undefined, floatSettings);
        }
        let score = ' '.repeat(maxScoreLength - scoreStr.length) +
            scoreStr;
        var gamesStr;
        if (gamesPlayed[i] == -1) {
            gamesStr = 'N/A';
        } else {
            gamesStr = (gamesPlayed[i]).toLocaleString();
        }
        var changeStr;
        if (GPH[i] == -1) {
            changeStr = 'N/A';
        }
        else {
            changeStr = (GPH[i]).toLocaleString();
        }
        let games = ' '.repeat(maxGamesLength - gamesStr.length) + gamesStr;
        let change = ' '.repeat(maxChangeLength - changeStr.length) + 
            changeStr;

        leaderboardText += `\`${rank} ${name} ${score} ${games} ${change}\``;
        if ((page * RESULTS_PER_PAGE) + i + 1 === target) {
            leaderboardText += '⭐';
        }
        leaderboardText += '\n';
    }

    return leaderboardText;
};

module.exports = generateAlternateRankingText;