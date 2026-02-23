/**
 * @fileoverview World Bloom Chapter Autocomplete Implementation
 * Used for any command that is able to select chapters (Graph, Heatmap, etc.)
 * Uses Fuzzy Search to provide relevant results
 * Discord Autocomplete is limited to 25 results as such this is necessary
 * @author Ai0796
 */

const { fuzzy, search } = require('fast-fuzzy');

getWorldBloomAutocomplete = async (discordClient, inputText) => {

    let world_blooms = discordClient.getAllWorldLinkChapters();

    let WL_Tracker = {}; // There are multiple World Links and I can't think of another way to do this
    let name2id = {};

    let options = world_blooms.map((chapter, i) => {

        if (!WL_Tracker[chapter.name]) {
            WL_Tracker[chapter.name] = 1;
        } else {
            WL_Tracker[chapter.name] += 1;
        }
        name2id[`${chapter.character} - World Link ${WL_Tracker[chapter.name]}`] = chapter.id;
        return `${chapter.character} - World Link ${WL_Tracker[chapter.name]}`;
    });

    if (inputText) {
        options = search(inputText, options, {
            keySelector: (option) => option.name,
            threshold: 0.4,
        });
    }

    options = options.map((name) => {
        return {
            name: name,
            value: name2id[name],
        };
    });

    return options.slice(0, 25);
}

module.exports = getWorldBloomAutocomplete;