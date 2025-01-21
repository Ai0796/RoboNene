/**
 * @fileoverview Calculates Team Talent and Event Bonus
 * @author Ai0796
 */

const fs = require('fs');

const MASTERYRANKREWARDS = [150, 300, 450, 540, 600];
const V2MASTERYREWARDS = [0.1, 0.2, 1, 1.5, 2];
const V3MASTERYREWARDS = [
    [0.0, 0.1, 0.2, 0.3, 0.4, 0.5],
    [0.0, 0.2, 0.4, 0.6, 0.8, 1],
    [0.0, 1.0, 2.0, 3.0, 4.0, 5.0],
    [0.0, 5.0, 6.0, 7.0, 8.0, 10.0],
    [0.0, 10.0, 11.0, 12.0, 13.0, 15.0]
];
const CARDRARITIES = ['rarity_1', 'rarity_2', 'rarity_3', 'rarity_birthday', 'rarity_4'];

/**
 * @typedef {Object} Team
 * @property {Card} cardDate - The Card Data of the Team
 * @property {number} talent - The Talent of the Team
 * @property {number} eventBonus - The Event Bonus of the team
 * @property {String} eventBonusText - The Event Bonus in Percetage format
 */

/**
 * @typedef {Object} Card
 * @property {number} baseTalent - base talent of card before area or character buffs
 * @property {number} characterDecoTalent - talent from character decorations
 * @property {number} areaDecoTalent - talent from area decorations
 * @property {number} CRTalent - talent from Character Rank
 * @property {number} talent - the total talent of the card
 * @property {string} type - The Type of the card
 * @property {string} group - the group of the card (or side group if Virtual Singer)
 * @property {number} characterId - the characterId of the character
 * @property {number} mastery
 * @property {number} rarity
 */

/**
 * @param {Object} Default card format from Project Sekai from user.deck
 * @param {Object} read in data about the cards
 * @returns {Card}
 */
const readCardTalent = (card, cards, cardEpisodes, gameCharacters) => {
    let data = cards.find((param) => param.id === card.cardId);
    if (data == undefined)
    {
        return;
    }
    var talent = 0;

    //Get Talent for each parameter
    for(let i = 1; i <= 3; i++) {
        data.cardParameters.filter((param) =>
            param.cardLevel === card.level && param.cardParameterType === `param${i}`)
            .map((param) => {
                talent += param.power;
            });
    }

    talent += card.specialTrainingStatus === 'done' ? data.specialTrainingPower1BonusFixed
                                                    + data.specialTrainingPower2BonusFixed
                                                    + data.specialTrainingPower3BonusFixed : 0;
    if(true) {
        let param = cardEpisodes.find((param) => param.cardId === card.cardId && param.seq === 1);
        talent += param.power1BonusFixed;
        talent += param.power2BonusFixed;
        talent += param.power3BonusFixed;
    }
    if (true) {
        let param = cardEpisodes.find((param) => param.cardId === card.cardId && param.seq === 2);
        talent += param.power1BonusFixed;
        talent += param.power2BonusFixed;
        talent += param.power3BonusFixed;
    }

    talent += card.masterRank * MASTERYRANKREWARDS[CARDRARITIES.indexOf(data.cardRarityType)];

    var group = null;

    if(data.supportUnit != 'none') {
        group = data.supportUnit;
    } else {
        let chars = gameCharacters.find((char) => char.id == data.characterId);
        group = chars.unit;
    }
    
    let id = gameCharacters.find((char) => char.gameCharacterId == data.characterId && char.unit == group).id;

    return {
        baseTalent : talent,
        characterDecoTalent: 0,
        areaDecoTalent: 0,
        CRTalent: 0,
        talent : talent,
        type : data.attr,
        group : group,
        characterId: data.characterId,
        unitId: id,
        cardId: card.cardId,
        mastery: card.masterRank,
        rarity: CARDRARITIES.indexOf(data.cardRarityType)
    };
};

const getAreaItemBonus = (cards, data, areaItemLevels) => {
    let itemLevels = data.userAreaItems.map(param => ({'level': param.level, 'areaItemId': param.areaItemId}));
    let idArray = {};
    itemLevels.forEach(element => {
        idArray[element.areaItemId] = element.level;
    });
    cards.forEach(card => {
        let areaItemBuffs = areaItemLevels.filter(param => {
            if ((idArray[param.areaItemId] === param.level)) {
                return ((card.type === param.targetCardAttr) ||
                    (card.group === param.targetUnit) ||
                    (card.characterId === param.targetGameCharacterId));
            }

        });

        areaItemBuffs.forEach(element => {
            if (element.targetGameCharacterId) {
                card.characterDecoTalent += Math.floor(card.baseTalent * element.power1BonusRate / 100.0);
            } else {
                card.areaDecoTalent += Math.floor(card.baseTalent * element.power1BonusRate / 100.0);
            }
        });
    });
};

const getTypeAreaItem = (type, data, areaItemLevels) => {
    let itemLevels = data.userAreaItems.map(param => ({'level': param.level, 'areaItemId': param.areaItemId}));
    let idArray = {};
    itemLevels.forEach(element => {
        idArray[element.areaItemId] = element.level;
    });
    
    let areaItemBuffs = areaItemLevels.filter(param => {
        if ((idArray[param.areaItemId] === param.level)) 
        {
            return (type === param.targetCardAttr);
        }
    });

    var totalBuff = 0;

    areaItemBuffs.forEach(element => {
        totalBuff += element.power1BonusRate / 100.0;
    });

    return totalBuff;
};

const getGroupAreaItem = (group, data, areaItemLevels) => {
    let itemLevels = data.userAreaItems.map(param => ({'level': param.level, 'areaItemId': param.areaItemId}));
    let idArray = {};
    itemLevels.forEach(element => {
        idArray[element.areaItemId] = element.level;
    });
    let areaItemBuffs = areaItemLevels.filter(param => {
        if ((idArray[param.areaItemId] === param.level)) {
            return (group === param.targetUnit);
        }
    });

    var totalBuff = 0;

    areaItemBuffs.forEach(element => {
        totalBuff += element.power1BonusRate / 100.0;
    });

    return totalBuff;
};

const getCharacterRanks = (cards, data) => {
    cards.forEach(card => {
        let rank = data.userCharacters.find(character => character.characterId == card.characterId).characterRank;

        rank = Math.min(rank, 50);

        card.CRTalent += Math.floor(card.baseTalent * (rank / 1000.0));
    });
};

const getEventBonus = (cards, eventBonusCards, eventCards, eventID) => {
    let eventBonus = 0;
    //Look for a perfect match
    cards.forEach(card => {
        let bonus = eventBonusCards.find(param => {
            if (param.eventId == eventID) {
                return param.gameCharacterUnitId === card.unitId && param.cardAttr === card.type;
            }
        });
        if (bonus) {
            eventBonus += bonus.bonusRate;
        }
        else {
            bonus = eventBonusCards.find(param => {
                if (param.eventId == eventID) {
                    return (param.gameCharacterUnitId === card.unitId || param.cardAttr === card.type) && param.bonusRate < 30;
                }
            });
            if (bonus) {
                eventBonus += bonus.bonusRate;
            }
        }

        let gachaBonus = eventCards.find(param => {
            if (param.eventId == eventID) {
                return param.cardId === card.cardId;
            }
        });
        if (gachaBonus) {
            eventBonus += gachaBonus.bonusRate;
        }

        if (eventID >= 36 && eventID <= 51) {
            eventBonus += card.mastery * V2MASTERYREWARDS[card.rarity];
        } else if (eventID >= 52) {
            eventBonus += V3MASTERYREWARDS[card.rarity][card.mastery];
        }

        if (eventID >= 36 && card.group === 'piapro') {
            eventBonus += 15.0;
        }
    });
    return eventBonus / 100.0;
};

/**
 * 
 * @param {Object} data response from a profile lookup from sekapi
 * @param {number} eventID Event that's currently happening
 * @returns {Team}
 */
const calculateTeam = (data, eventID) => {
    const cards = JSON.parse(fs.readFileSync('./sekai_master/cards.json'));
    const areaItemLevels = JSON.parse(fs.readFileSync('./sekai_master/areaItemLevels.json'));
    const eventBonusCards = JSON.parse(fs.readFileSync('./sekai_master/eventDeckBonuses.json'));
    const eventCards = JSON.parse(fs.readFileSync('./sekai_master/eventCards.json'));
    const episodes = JSON.parse(fs.readFileSync('./sekai_master/cardEpisodes.json'));
    const gameCharacters = JSON.parse(fs.readFileSync('./sekai_master/gameCharacterUnits.json'));

    let order = [
        data.userDeck.member1,
        data.userDeck.member2,
        data.userDeck.member3,
        data.userDeck.member4,
        data.userDeck.member5,
    ];
    let cardData = order.map(cardId => data.userCards.find(card => card.cardId === cardId)).filter(card => card != undefined);
    cardData = cardData.map(card => readCardTalent(card, cards, episodes, gameCharacters));

    cardData.forEach(card => {
        card.characterDecoTalent += Math.floor(card.baseTalent * 0.3);
        card.areaDecoTalent += Math.floor(card.baseTalent * 0.15);
    });

    var group = cardData[0].group;
    var type = cardData[0].type;

    cardData.forEach(card => {

        if(card.group != group){
            group = undefined;
        }
        if (card.type != type) {
            type = undefined;
        }
    });

    if (group) {
        cardData.forEach(card => {
            card.areaDecoTalent += Math.floor(card.baseTalent * 0.15);
        });
    }

    if (type) {
        cardData.forEach(card => {
            card.areaDecoTalent += Math.floor(card.baseTalent * 0.15);
        });
    }

    getCharacterRanks(cardData, data);

    let totalTalent = 0;
    cardData.forEach(card => card.talent += card.CRTalent + card.areaDecoTalent + card.characterDecoTalent);
    cardData.forEach(card => totalTalent += card.talent);
    let eventBonus = getEventBonus(cardData, eventBonusCards, eventCards, eventID);

    return {
        cards: cardData,
        talent: totalTalent,
        eventBonus: eventBonus,
        eventBonusText: `${(eventBonus * 100).toFixed(2)}%`
    };
};

module.exports = calculateTeam;
