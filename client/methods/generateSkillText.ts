// client/methods/generateSkillText.ts
/**
 * @fileoverview An implementation designed to efficiently generate an embed for a
 * skill display, give a list of skill orders
 * @author Ai0796
 */

import { RESULTS_PER_PAGE } from '../../constants';

/**
 * Generates an ranking embed from the provided params
 * @param {string[]} difficulties Array of Difficulty Names
 * @param {string[]} skillOrders Array of Skill Orders, should be same length as difficulties
 * @return {string} a String of the optimal skill order
 */
const generateSkillText = (difficulties: string[], skillOrders: string[]): string => {
    let maxDifficultyLength = 0;
    let maxSkillOrderLength = 0;

    skillOrders.forEach((_v, i) => { // Renamed 'v' to '_v' as it's unused
        let difficulty = difficulties[i];
        let skillOrder = skillOrders[i];
        maxDifficultyLength = Math.max(maxDifficultyLength, difficulty.length);
        maxSkillOrderLength = Math.max(maxSkillOrderLength, skillOrder.length);
    });

    let skillOrderText = '';
    for (let i = 0; i < RESULTS_PER_PAGE; i++) {
        if (i >= skillOrders.length) {
            skillOrderText += '\u200b';
            break;
        }

        let difficultyStr = difficulties[i] + ' '.repeat(maxDifficultyLength - difficulties[i].length);
        let skillOrderStr = ' '.repeat(maxSkillOrderLength - skillOrders[i].length) + skillOrders[i];

        skillOrderText += `\`\`${difficultyStr} ${skillOrderStr}\`\``;
        skillOrderText += '\n';
    }

    return skillOrderText;
};

export default generateSkillText;