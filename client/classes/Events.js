// Note: You will need to implement/import your Card class in JavaScript.
// import Card from './lib/Card.js';

const fs = require('fs');

class Card {
    constructor(cardId, eventId, bonus, eventInstance) {
        this.cardId = cardId;
        this.eventId = eventId;
        this.bonus = bonus;

        // Fetch the full card data using the provided Event instance
        this.card = eventInstance.getCard(this.cardId);

        // Extract properties (with a safety check in case the card isn't found)
        if (this.card) {
            this.rarity = this.card.cardRarityType;
            this.unit = this.card.characterId;
        } else {
            this.rarity = null;
            this.unit = null;
            console.warn(`Card with ID ${this.cardId} not found in master data.`);
        }
    }
}

class Event {
    static EN_DB_LINK = "./sekai_master";
    static JP_DB_LINK = "https://raw.githubusercontent.com/Sekai-World/sekai-master-db-diff/main";

    static RARITYWORTH = {
        'rarity_1': '1',
        'rarity_2': '2',
        'rarity_3': '3',
        'rarity_birthday': '4',
        'rarity_4': '5',
    };

    constructor(isJP = false) {
        this.resetDic();
        this.isJP = isJP;
        this.DB_LINK = isJP ? Event.JP_DB_LINK : Event.EN_DB_LINK;

        // Initialize data properties
        this.eventData = [];
        this.eventCardData = [];
        this.eventDeckData = [];
        this.cardData = [];
        this.charactersData = [];
        this.characterUnitsData = [];
        this.unitsData = [];
        this.worldBloomData = [];
    }

    resetDic() {
        this.dataDic = {
            "Event ID": [],
            "Date": [],
            "Time": [],
            "Main Character": [],
            "Side Character1": [],
            "Side Character2": [],
            "EventType": [],
            "EventPoints": [],
            "EventLength": [],
            "Percentage": [],
            "Tier": [],
            "Unit": [],
            "Final Score": []
        };
    }

    async parseWebJSON(url) {
        const response = fs.readFileSync(url, 'utf8');
        return JSON.parse(response);
    }

    /**
     * Loads all master data asynchronously
     */
    async load(overrideLink = null) {
        if (overrideLink) {
            this.DB_LINK = overrideLink;
        }

        // Fetch everything in parallel for better performance
        const [
            eventData,
            eventCardData,
            eventDeckData,
            cardData,
            charactersData,
            characterUnitsData,
            unitsData,
            worldBloomData
        ] = await Promise.all([
            this.parseWebJSON(`${this.DB_LINK}/events.json`),
            this.parseWebJSON(`${this.DB_LINK}/eventCards.json`),
            this.parseWebJSON(`${this.DB_LINK}/eventDeckBonuses.json`),
            this.parseWebJSON(`${this.DB_LINK}/cards.json`),
            this.parseWebJSON(`${this.DB_LINK}/gameCharacters.json`),
            this.parseWebJSON(`${this.DB_LINK}/gameCharacterUnits.json`),
            this.parseWebJSON(`${this.DB_LINK}/unitProfiles.json`),
            this.parseWebJSON(`${this.DB_LINK}/worldBlooms.json`)
        ].map(p => p.catch(e => console.warn(e) || [])));
        // Catch added so one missing file doesn't crash the whole load

        this.eventData = eventData;
        this.eventCardData = eventCardData;
        this.eventDeckData = eventDeckData;
        this.cardData = cardData;
        this.charactersData = charactersData;
        this.characterUnitsData = characterUnitsData;
        this.unitsData = unitsData;
        this.worldBloomData = worldBloomData;
    }

    getEvent(eventId) {
        return this.eventData.find(event => event.id === eventId) || null;
    }

    getEventCards(eventId) {
        return this.eventCardData.filter(card => card.eventId === eventId);
    }

    getCard(cardId) {
        return this.cardData.find(card => card.id === cardId) || null;
    }

    getCharacterID(cardId) {
        const card = this.getCard(cardId);
        return card ? card.characterId : null;
    }

    getCharacter(characterId) {
        return this.charactersData.find(character => character.id === characterId) || null;
    }

    getCharacterUnit(characterUnitId) {
        return this.characterUnitsData.find(unit => unit.id === characterUnitId) || null;
    }

    getEventDeck(eventId) {
        return this.eventDeckData
            .filter(card => card.eventId === eventId && ("gameCharacterUnitId" in card) && !("cardAttr" in card))
            .map(card => {
                // Return a new object to avoid mutating the master data
                const charUnit = this.getCharacterUnit(card.gameCharacterUnitId);
                return { ...card, CharacterId: charUnit ? charUnit.gameCharacterId : null };
            });
    }

    getFullEventBonusCards(eventId) {
        if (eventId === 38) return [];

        const eventDeckBonus = this.eventDeckData.filter(card => card.eventId === eventId && parseInt(card.bonusRate) >= 50);

        const units = [];
        let attr = null;

        for (const card of eventDeckBonus) {
            if ('gameCharacterUnitId' in card) {
                const gameChar = this.getCharacterUnit(card.gameCharacterUnitId);
                if (gameChar) {
                    if (gameChar.id === gameChar.gameCharacterId) {
                        units.push([gameChar.gameCharacterId, null]);
                    } else {
                        units.push([gameChar.gameCharacterId, gameChar.unit]);
                    }
                }
            }
            if ('cardAttr' in card) {
                attr = card.cardAttr;
            }
        }

        const bonus = 50;
        let cards = [];

        for (const [unit, group] of units) {
            cards.push(...this.getCardByUnit(unit, group, eventId));
        }

        // Create focus cards array
        const focusCardIds = this.getFocusEventCards(eventId).map(c => c.cardId);
        const attrCards = this.getCardByAttr(attr, eventId);

        // Equivalent to python: set(cards) & set(attrCards) - set(focusCardIds)
        cards = [...new Set(cards)]
            .filter(cardId => attrCards.includes(cardId))
            .filter(cardId => !focusCardIds.includes(cardId));

        let mappedCards = cards.map(cardId => new Card(cardId, eventId, bonus, this));

        mappedCards.sort((a, b) => parseInt(Event.RARITYWORTH[b.rarity] || 0) - parseInt(Event.RARITYWORTH[a.rarity] || 0));
        return mappedCards;
    }

    getHalfEventBonusCards(eventId) {
        if (eventId === 38) return [];

        const eventDeckBonus = this.eventDeckData.filter(card =>
            card.eventId === eventId && parseInt(card.bonusRate) >= 20 && parseInt(card.bonusRate) < 50
        );

        const units = [];
        let attr = null;

        for (const card of eventDeckBonus) {
            if ('gameCharacterUnitId' in card) {
                const gameChar = this.getCharacterUnit(card.gameCharacterUnitId);
                if (gameChar) {
                    if (gameChar.id === gameChar.gameCharacterId) {
                        units.push([gameChar.gameCharacterId, null]);
                    } else {
                        units.push([gameChar.gameCharacterId, gameChar.unit]);
                    }
                }
            }
            if ('cardAttr' in card) {
                attr = card.cardAttr;
            }
        }

        const bonus = eventId >= 36 ? 25 : 20;
        let cards = [];

        for (const [unit, group] of units) {
            cards.push(...this.getCardByUnit(unit, group, eventId));
        }

        // Equivalent to python: set(cards).symmetric_difference(set(attrCards))
        const attrCards = this.getCardByAttr(attr, eventId);
        const setCards = [...new Set(cards)];
        const setAttrCards = [...new Set(attrCards)];

        const symDiff = [
            ...setCards.filter(x => !setAttrCards.includes(x)),
            ...setAttrCards.filter(x => !setCards.includes(x))
        ];

        let mappedCards = symDiff.map(cardId => new Card(cardId, eventId, bonus, this));
        mappedCards.sort((a, b) => parseInt(Event.RARITYWORTH[b.rarity] || 0) - parseInt(Event.RARITYWORTH[a.rarity] || 0));

        return mappedCards;
    }

    getFocusEventCards(eventId) {
        if (eventId === 38) return [];
        const eventDeckBonus = [];
        if (eventId < 36) return eventDeckBonus;

        const eventCards = this.getEventCards(eventId);
        for (const card of eventCards) {
            if (parseInt(card.bonusRate) > 0) {
                eventDeckBonus.push(card.cardId);
            }
        }

        const bonus = eventId >= 36 ? 70 : 50;
        return eventDeckBonus.map(cardId => new Card(cardId, eventId, bonus, this));
    }

    getCardByUnit(unitId, group, eventId = null) {
        let stopper = Infinity;
        if (eventId !== null) {
            const eCards = this.getEventCards(eventId);
            if (eCards.length > 0) {
                stopper = Math.max(...eCards.map(x => x.cardId));
            }
        }

        const cards = [];
        for (const card of this.cardData) {
            if (card.id > stopper) break;

            if (card.characterId === unitId) {
                if (group) {
                    if (card.supportUnit === group) cards.push(card.id);
                } else {
                    cards.push(card.id);
                }
            }
        }
        return cards;
    }

    getCardByAttr(attr, eventId = null) {
        let stopper = Infinity;
        if (eventId !== null) {
            const eCards = this.getEventCards(eventId);
            if (eCards.length > 0) {
                stopper = Math.max(...eCards.map(x => x.cardId));
            }
        }

        const cards = [];
        for (const card of this.cardData) {
            if (card.id > stopper) break;
            if (card.attr === attr) cards.push(card.id);
        }
        return cards;
    }

    getUnitId(unit) {
        const unitData = this.unitsData.find(u => u.unit === unit);
        return unitData ? unitData.seq : null;
    }

    /**
     * Async replacement for pandas read_csv. 
     * Assumes the CSV files are accessible via standard fetch paths.
     */
    async getData(eventId, tier) {
        // String padStart is used to mimic Python's {:02d} formatting
        const formattedId = String(eventId).padStart(2, '0');
        const filepath = `Events-EN/Event${formattedId}/${tier}.csv`;

        try {
            const response = await fetch(filepath);
            if (!response.ok) throw new Error("CSV not found");
            const csvText = await response.text();

            // Very basic CSV parser (assuming comma separated, no escaped commas in strings)
            const rows = csvText.trim().split('\n');
            const headers = rows.shift().split(',');

            const timeIndex = headers.indexOf("Event Time");
            const scoreIndex = headers.indexOf("Score");

            const xData = [];
            const points = [];

            for (const row of rows) {
                const cols = row.split(',');
                xData.push(parseFloat(cols[timeIndex]));
                points.push(parseFloat(cols[scoreIndex]));
            }

            // Returning objects/arrays instead of numpy arrays
            return { xData, points };

        } catch (error) {
            console.error(`Error loading CSV data for Event ${eventId}:`, error);
            return { xData: [], points: [] };
        }
    }

    getPercentage(timestamp, length) {
        // Converts timestamp to percentage of event completion
        // timestamp: days since event start
        // length: event length in unix timestamp
        return timestamp / (length / 1000 / 60 / 60 / 24);
    }
}

module.exports = { Event };