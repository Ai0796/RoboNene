// client/methods/calculateTeam.ts
/**
 * @fileoverview Calculates Team Talent and Event Bonus
 * @author Ai0796
 */

import * as fs from 'fs';

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

interface UserCard {
    cardId: number;
    level: number;
    specialTrainingStatus: string; // "done" or other values
    masterRank: number;
    defaultImage: string; // "original" or "special_training"
}

interface CardData {
    id: number;
    attr: string; // "cool", "cute", etc.
    cardRarityType: string; // "rarity_1", "rarity_2", etc.
    cardParameters: Array<{ cardLevel: number; cardParameterType: string; power: number }>;
    specialTrainingPower1BonusFixed: number;
    specialTrainingPower2BonusFixed: number;
    specialTrainingPower3BonusFixed: number;
    supportUnit: string; // e.g., "none", "vocaloid", "light_sound"
    characterId: number;
    prefix: string;
}

interface CardEpisode {
    cardId: number;
    seq: number;
    power1BonusFixed: number;
    power2BonusFixed: number;
    power3BonusFixed: number;
}

interface GameCharacterUnit {
    id: number; // This is gameCharacterUnitId
    gameCharacterId: number;
    unit: string; // e.g., "vocaloid", "light_sound"
}

interface UserCharacter {
    characterId: number;
    characterRank: number;
}

interface UserAreaItem {
    level: number;
    areaItemId: number;
}

interface UserProfileData {
    userCards: UserCard[];
    userDeck: {
        member1: number;
        member2: number;
        member3: number;
        member4: number;
        member5: number;
    };
    userChallengeLiveSoloStages: Array<{ characterId: number; rank: number }>;
    userCharacters: UserCharacter[];
    userAreaItems: UserAreaItem[];
    totalPower: {
        totalPower: number;
    };
}

export interface CalculatedCard {
    baseTalent: number;
    characterDecoTalent: number;
    areaDecoTalent: number;
    CRTalent: number;
    talent: number;
    type: string;
    group: string | null;
    characterId: number;
    unitId: number;
    cardId: number;
    mastery: number;
    rarity: number;
}

export interface CalculatedTeam {
    cards: CalculatedCard[];
    talent: number;
    eventBonus: number;
    eventBonusText: string;
}

/**
 * @param {UserCard} card Default card format from Project Sekai from user.deck
 * @param {CardData[]} cards Read in data about the cards
 * @param {CardEpisode[]} cardEpisodes Read in data about card episodes
 * @param {GameCharacterUnit[]} gameCharacters Read in data about game characters units
 * @returns {CalculatedCard | undefined}
 */
const readCardTalent = (card: UserCard, cards: CardData[], cardEpisodes: CardEpisode[], gameCharacters: GameCharacterUnit[]): CalculatedCard | undefined => {
    let data = cards.find((param) => param.id === card.cardId);
    if (data === undefined) {
        return;
    }
    let talent = 0;

    // Get Talent for each parameter
    for (let i = 1; i <= 3; i++) {
        data.cardParameters.filter((param) =>
            param.cardLevel === card.level && param.cardParameterType === `param${i}`)
            .map((param) => {
                talent += param.power;
            });
    }

    talent += card.specialTrainingStatus === 'done' ? data.specialTrainingPower1BonusFixed
        + data.specialTrainingPower2BonusFixed
        + data.specialTrainingPower3BonusFixed : 0;
    // Assuming these are always true based on original code, but if they depend on data
    // they should be conditional
    const episode1 = cardEpisodes.find((param) => param.cardId === card.cardId && param.seq === 1);
    if (episode1 !== undefined) {
        talent += episode1.power1BonusFixed;
        talent += episode1.power2BonusFixed;
        talent += episode1.power3BonusFixed;
    }

    const episode2 = cardEpisodes.find((param) => param.cardId === card.cardId && param.seq === 2);
    if (episode2 !== undefined) {
        talent += episode2.power1BonusFixed;
        talent += episode2.power2BonusFixed;
        talent += episode2.power3BonusFixed;
    }

    talent += card.masterRank * MASTERYRANKREWARDS[CARDRARITIES.indexOf(data.cardRarityType)];

    let group: string | null = null;

    if (data.supportUnit !== 'none') {
        group = data.supportUnit;
    } else {
        let chars = gameCharacters.find((char) => char.gameCharacterId === data.characterId);
        if (chars) {
            group = chars.unit;
        }
    }

    let unitId = -1;
    if (group) {
        const charUnit = gameCharacters.find((char) => char.gameCharacterId === data.characterId && char.unit === group);
        if (charUnit) {
            unitId = charUnit.id;
        }
    }


    return {
        baseTalent: talent,
        characterDecoTalent: 0,
        areaDecoTalent: 0,
        CRTalent: 0,
        talent: talent,
        type: data.attr,
        group: group,
        characterId: data.characterId,
        unitId: unitId,
        cardId: card.cardId,
        mastery: card.masterRank,
        rarity: CARDRARITIES.indexOf(data.cardRarityType)
    };
};

const getAreaItemBonus = (cards: CalculatedCard[], userData: UserProfileData, areaItemLevels: any[]) => { // Using any for areaItemLevels structure for now
    let itemLevels = userData.userAreaItems.map(param => ({ 'level': param.level, 'areaItemId': param.areaItemId }));
    let idArray: { [key: number]: number } = {};
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
            return false; // Added return false for the filter
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

const getTypeAreaItem = (type: string, userData: UserProfileData, areaItemLevels: any[]) => { // Using any for areaItemLevels structure for now
    let itemLevels = userData.userAreaItems.map(param => ({ 'level': param.level, 'areaItemId': param.areaItemId }));
    let idArray: { [key: number]: number } = {};
    itemLevels.forEach(element => {
        idArray[element.areaItemId] = element.level;
    });

    let areaItemBuffs = areaItemLevels.filter(param => {
        if ((idArray[param.areaItemId] === param.level)) {
            return (type === param.targetCardAttr);
        }
        return false; // Added return false for the filter
    });

    let totalBuff = 0;

    areaItemBuffs.forEach(element => {
        totalBuff += element.power1BonusRate / 100.0;
    });

    return totalBuff;
};

const getGroupAreaItem = (group: string, userData: UserProfileData, areaItemLevels: any[]) => { // Using any for areaItemLevels structure for now
    let itemLevels = userData.userAreaItems.map(param => ({ 'level': param.level, 'areaItemId': param.areaItemId }));
    let idArray: { [key: number]: number } = {};
    itemLevels.forEach(element => {
        idArray[element.areaItemId] = element.level;
    });
    let areaItemBuffs = areaItemLevels.filter(param => {
        if ((idArray[param.areaItemId] === param.level)) {
            return (group === param.targetUnit);
        }
        return false; // Added return false for the filter
    });

    let totalBuff = 0;

    areaItemBuffs.forEach(element => {
        totalBuff += element.power1BonusRate / 100.0;
    });

    return totalBuff;
};

const getCharacterRanks = (cards: CalculatedCard[], userData: UserProfileData) => {
    cards.forEach(card => {
        const character = userData.userCharacters.find(character => character.characterId === card.characterId);
        if (character) {
            let rank = character.characterRank;
            rank = Math.min(rank, 50);
            card.CRTalent += Math.floor(card.baseTalent * (rank / 1000.0));
        }
    });
};

interface EventBonusCard {
    eventId: number;
    gameCharacterUnitId: number;
    cardAttr: string;
    bonusRate: number;
}

interface EventCard {
    eventId: number;
    cardId: number;
    bonusRate: number;
}

const getEventBonus = (cards: CalculatedCard[], eventBonusCards: EventBonusCard[], eventCards: EventCard[], eventID: number): number => {
    let eventBonus = 0;
    // Look for a perfect match
    cards.forEach(card => {
        let bonus = eventBonusCards.find(param => {
            if (param.eventId === eventID) {
                return param.gameCharacterUnitId === card.unitId && param.cardAttr === card.type;
            }
            return false; // Added return false for the find
        });
        if (bonus) {
            eventBonus += bonus.bonusRate;
        }
        else {
            bonus = eventBonusCards.find(param => {
                if (param.eventId === eventID) {
                    return (param.gameCharacterUnitId === card.unitId || param.cardAttr === card.type) && param.bonusRate < 30;
                }
                return false; // Added return false for the find
            });
            if (bonus) {
                eventBonus += bonus.bonusRate;
            }
        }

        let gachaBonus = eventCards.find(param => {
            if (param.eventId === eventID) {
                return param.cardId === card.cardId;
            }
            return false; // Added return false for the find
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
 * @param {UserProfileData} data response from a profile lookup from sekapi
 * @param {number} eventID Event that's currently happening
 * @returns {CalculatedTeam}
 */
const calculateTeam = (data: UserProfileData, eventID: number): CalculatedTeam => {
    const cardsJson: CardData[] = JSON.parse(fs.readFileSync('./sekai_master/cards.json', 'utf8')) as CardData[];
    const areaItemLevelsJson: any[] = JSON.parse(fs.readFileSync('./sekai_master/areaItemLevels.json', 'utf8')) as any[]; // Using any for structure
    const eventBonusCardsJson: EventBonusCard[] = JSON.parse(fs.readFileSync('./sekai_master/eventDeckBonuses.json', 'utf8')) as EventBonusCard[];
    const eventCardsJson: EventCard[] = JSON.parse(fs.readFileSync('./sekai_master/eventCards.json', 'utf8')) as EventCard[];
    const episodesJson: CardEpisode[] = JSON.parse(fs.readFileSync('./sekai_master/cardEpisodes.json', 'utf8')) as CardEpisode[];
    const gameCharacterUnitsJson: GameCharacterUnit[] = JSON.parse(fs.readFileSync('./sekai_master/gameCharacterUnits.json', 'utf8')) as GameCharacterUnit[];

    let order = [
        data.userDeck.member1,
        data.userDeck.member2,
        data.userDeck.member3,
        data.userDeck.member4,
        data.userDeck.member5,
    ];
    let cardData: (CalculatedCard | undefined)[] = order.map(cardId => data.userCards.find(card => card.cardId === cardId));
    cardData = cardData.filter((card): card is UserCard => card !== undefined).map(card => readCardTalent(card, cardsJson, episodesJson, gameCharacterUnitsJson));
    
    // Filter out undefined results from readCardTalent
    const filteredCardData = cardData.filter((card): card is CalculatedCard => card !== undefined);

    filteredCardData.forEach(card => {
        card.characterDecoTalent += Math.floor(card.baseTalent * 0.3);
        card.areaDecoTalent += Math.floor(card.baseTalent * 0.15);
    });

    let group: string | undefined = filteredCardData.length > 0 ? filteredCardData[0].group || undefined : undefined;
    let type: string | undefined = filteredCardData.length > 0 ? filteredCardData[0].type : undefined;

    filteredCardData.forEach(card => {
        if (group && card.group !== group) { // Check if group is not null/undefined before comparison
            group = undefined;
        }
        if (type && card.type !== type) { // Check if type is not null/undefined before comparison
            type = undefined;
        }
    });

    if (group) {
        filteredCardData.forEach(card => {
            card.areaDecoTalent += Math.floor(card.baseTalent * 0.15);
        });
    }

    if (type) {
        filteredCardData.forEach(card => {
            card.areaDecoTalent += Math.floor(card.baseTalent * 0.15);
        });
    }

    getCharacterRanks(filteredCardData, data);
    getAreaItemBonus(filteredCardData, data, areaItemLevelsJson); // Pass full data to getAreaItemBonus

    let totalTalent = 0;
    filteredCardData.forEach(card => card.talent = card.baseTalent + card.CRTalent + card.areaDecoTalent + card.characterDecoTalent); // Assign back to card.talent
    filteredCardData.forEach(card => totalTalent += card.talent);
    let eventBonus = getEventBonus(filteredCardData, eventBonusCardsJson, eventCardsJson, eventID);

    return {
        cards: filteredCardData,
        talent: totalTalent,
        eventBonus: eventBonus,
        eventBonusText: `${(eventBonus * 100).toFixed(2)}%`
    };
};

export default calculateTeam;