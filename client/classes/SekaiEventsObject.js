const { Event } = require('./Events.js');


class SekaiEventProcessor {
    constructor() {
        // Equivalent to global Groups dict
        this.Groups = [
            "Mixed",
            "Virtual Singer",
            "Leo/Need",
            "MORE MORE JUMP!",
            "Vivid BAD SQUAD",
            "WonderlandsxShowtime",
            "25-ji, Nightcord de",
        ]

        // Equivalent to defaultdict(int)
        this.WLChapter = {};
        this.events = [];
    }

    /**
     * Helper method to calculate the most frequent item in an array
     */
    getMode(arr) {
        if (!arr.length) return null;
        const counts = arr.reduce((acc, val) => {
            acc[val] = (acc[val] || 0) + 1;
            return acc;
        }, {});
        return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
    }

    /**
     * Determines the character's formatted name
     */
    getName(characterId, eventData) {
        try {
            const mainCharacter = eventData.getCharacter(characterId);
            let name = "";

            if (mainCharacter.givenNameRuby === "" || !("firstNameRuby" in mainCharacter)) {
                name = mainCharacter.givenNameRuby;
            } else if (mainCharacter.unit === "piapro") {
                name = mainCharacter.firstNameRuby + " " + mainCharacter.givenNameRuby;
            } else {
                name = mainCharacter.givenNameRuby + " " + mainCharacter.firstNameRuby;
            }

            return name;
        } catch {
            return "Unknown";
        }
    }

    /**
     * Generates world bloom sub-events as objects
     */
    addWorldBlooms(event, eventData, group) {
        const blooms = [];
        let i = 1;

        for (const bloom of eventData.worldBloomData) {
            if (bloom.eventId === event.id) {
                const name = ("gameCharacterId" in bloom)
                    ? this.getName(bloom.gameCharacterId, eventData)
                    : "Finale";

                // Increment WLChapter count for this name
                this.WLChapter[name] = (this.WLChapter[name] || 0) + 1;

                blooms.push({
                    eventId: `${event.id}-${i}`,
                    baseEventId: event.id,
                    chapterId: `${i}`,
                    eventName: `WL${this.WLChapter[name]}: ${name}`,
                    eventTime: Math.floor(bloom.chapterStartAt / 1000),
                    eventLength: Math.round((bloom.chapterEndAt - bloom.chapterStartAt) / 86400000),
                    eventUnit: group,
                    eventType: 'world_bloom_chapter',
                    focusUnit: name
                });

                i++;
            }
        }
        return blooms;
    }

    /**
     * Main processing loop returning an array of event objects
     */
    processEvents(eventData) {
        // Reset state per run
        this.eventData = eventData;
        this.WLChapter = {};

        for (const event of eventData.eventData) {
            // Pad missing events based on ID
            while (event.id > this.events.length) {
                this.events.push({
                    eventId: "NaN",
                    eventName: 1,
                    eventTime: 0,
                    eventLength: null,
                    eventUnit: null,
                    eventType: null,
                    focusUnit: null
                });
            }

            const eventDeck = eventData.getEventDeck(event.id);
            const units = [];
            const characterIds = new Set();

            for (const deck of eventDeck) {
                const character = eventData.getCharacterUnit(deck.gameCharacterUnitId);
                units.push(eventData.getUnitId(character.unit));
                characterIds.add(character.gameCharacterId);
            }

            let eventCards = eventData.getEventCards(event.id);

            // Find the first card where isDisplayCardStory is not exactly false
            let mainCardIndex = eventCards.findIndex(card => card.isDisplayCardStory !== false);
            if (mainCardIndex === -1) mainCardIndex = 0; // Fallback if none found

            // Slice array to mimic Python's pop(0) behavior in the while loop
            eventCards = eventCards.slice(mainCardIndex);

            let mainCharacter = eventData.getCharacterID((eventCards[0] ?? { cardId: null }).cardId);
            let i = 0;

            // Iterate until the main character exists in our characterIds set
            while (!characterIds.has(mainCharacter) && i < eventCards.length - 1) {
                i++;
                mainCharacter = eventData.getCharacterID(eventCards[i].cardId);
            }

            const name = this.getName(mainCharacter, eventData);

            const mode = parseInt(this.getMode(units), 10);
            let unit = 0;

            // Filter out units based on logic constraints
            if (units.filter(u => u === mode).length >= 5 || event.eventType === 'world_bloom') {
                unit = mode;
            }

            // Specific override
            if (event.id === 6) {
                event.name = "Singing in Sync"; // Corrected spelling based on context
            }

            // Create the main event object
            this.events.push({
                eventId: event.id,
                eventName: event.name,
                eventTime: Math.floor(event.startAt / 1000),
                eventLength: Math.round((event.aggregateAt - event.startAt) / 86400000),
                eventUnit: this.Groups[unit],
                eventType: event.eventType,
                focusUnit: name
            });

            // Append world bloom sub-events if applicable
            if (event.eventType === 'world_bloom') {
                const subBlooms = this.addWorldBlooms(event, eventData, this.Groups[unit]);
                this.events.push(...subBlooms);
            }
        }

        return this.events;
    }

    isWorldBloom(eventId) {
        const event = eventData.getEvent(eventId);
        return event.eventType === 'world_bloom';
    }

    isWorldBloomChapters(eventId) {
        const event = this.eventData.getEvent(eventId);
        return event.eventType === 'world_bloom_chapter' ? event : null;
    }

    isCheerfulCarnival(eventId) {
        const event = eventData.getEvent(eventId);
        return event.name === 'cheerful_carnival';
    }

    getWorldBloomChapters() {
        const chapters = [];
        for (const event of this.events) {
            if (event.eventType === 'world_bloom_chapter') {
                chapters.push(event);
            }
        }
        return chapters;
    }

    getCharacter(eventId) {
        const event = this.events.find(e => e.eventId === eventId);
        return event ? event.focusUnit : null;
    }

    getEventName(eventId) {
        const event = this.events.find(e => e.eventId === eventId);
        return event ? event.eventName : null;
    }
}

module.exports = { SekaiEventProcessor };