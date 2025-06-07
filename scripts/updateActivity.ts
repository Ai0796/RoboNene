// scripts/updateActivity.ts
import * as fs from 'fs';
import { Client, ActivityType } from 'discord.js'; // Import ActivityType
import { BOT_ACTIVITY } from '../constants';

interface GameCharacter {
    id: number;
    givenName: string;
    firstName: string;
}

interface Event {
    id: number;
    aggregateAt: number;
    startAt: number;
    eventType: string;
    name: string;
    assetbundleName: string; // Add assetbundleName
}

interface WorldBloom {
    eventId: number;
    id: number;
    chapterNo: number;
    chapterStartAt: number;
    chapterEndAt: number;
    gameCharacterId: number;
    aggregateAt: number; // Add aggregateAt
    character?: string; // Added in DiscordClient.getAllWorldLinkChapters
}

const updateActivityLoop = async (client: Client): Promise<void> => {
    console.log('Updating activity with next event');
    nextEventActivity(client);
};

const serverNumActivity = async (client: Client): Promise<void> => {
    client.user?.setActivity(BOT_ACTIVITY() + // Optional chaining for user
        `${client.guilds.cache.size} ${(client.guilds.cache.size > 1) ? 'servers' : 'server'}`, { type: ActivityType.Playing }); // Specify activity type
};

const getCharacterName = (characterId: number, gameCharacters: GameCharacter[]): string => {
    const charInfo = gameCharacters.find(char => char.id === characterId); // Use find instead of direct index
    if (charInfo) {
        return `${charInfo.givenName} ${charInfo.firstName}`.trim();
    }
    return 'Unknown Character'; // Fallback
};

const nextEventActivity = async (client: Client): Promise<void> => {
    const events: Event[] = JSON.parse(fs.readFileSync('./sekai_master/events.json', 'utf8')) as Event[];
    const gameCharacters: GameCharacter[] = JSON.parse(fs.readFileSync('./sekai_master/gameCharacters.json', 'utf8')) as GameCharacter[];
    const worldBlooms: WorldBloom[] = JSON.parse(fs.readFileSync('./sekai_master/worldBlooms.json', 'utf8')) as WorldBloom[];


    let currentEventIdx = -1;
    const currentDate = new Date();

    // Find the current or next upcoming event
    // The original loop condition `i < events.length` and `events[i-1]` access
    // is a bit dangerous if events[0] is accessed. Re-evaluate.
    // It's likely trying to find the event that's either active or the very next one.
    // A simpler way: find active event first, then next event.
    let activeEvent: Event | undefined;
    let nextEvent: Event | undefined;

    for (const event of events) {
        if (event.startAt <= currentDate.getTime() && event.closedAt >= currentDate.getTime()) {
            activeEvent = event;
        } else if (event.startAt > currentDate.getTime()) {
            if (!nextEvent || event.startAt < nextEvent.startAt) {
                nextEvent = event;
            }
        }
    }

    let targetEvent: Event | undefined = activeEvent || nextEvent;


    let timeUntilStr: string = '';
    if (!targetEvent) {
        serverNumActivity(client);
        return;
    }

    if (targetEvent.eventType === 'world_bloom') {
        const world_events = worldBlooms.filter((x) => x.eventId === targetEvent!.id); // Use non-null assertion
        world_events.sort((a, b) => a.id - b.id);

        let currentWorldEvent: WorldBloom | undefined;
        let nextWorldEvent: WorldBloom | undefined;

        for (const wEvent of world_events) {
            if (wEvent.chapterStartAt <= currentDate.getTime() && wEvent.chapterEndAt >= currentDate.getTime()) {
                currentWorldEvent = wEvent;
            } else if (wEvent.chapterStartAt > currentDate.getTime()) {
                if (!nextWorldEvent || wEvent.chapterStartAt < nextWorldEvent.chapterStartAt) {
                    nextWorldEvent = wEvent;
                }
            }
        }

        const effectiveWorldEvent = currentWorldEvent || nextWorldEvent;

        if (!effectiveWorldEvent) {
            serverNumActivity(client);
            return;
        }

        const character = getCharacterName(effectiveWorldEvent.gameCharacterId, gameCharacters);
        const nextCharacter = nextWorldEvent ? getCharacterName(nextWorldEvent.gameCharacterId, gameCharacters) : undefined;


        if (currentDate.getTime() < effectiveWorldEvent.chapterStartAt) {
            timeUntilStr = `${await formatTime(effectiveWorldEvent.chapterStartAt - currentDate.getTime())} Until ${character}'s Chapter Starts`;
        } else if (currentDate.getTime() < effectiveWorldEvent.chapterEndAt && nextCharacter) {
            timeUntilStr = `${await formatTime(effectiveWorldEvent.chapterEndAt - currentDate.getTime())} Until ${character}'s Chapter Ends (${nextCharacter}'s Chapter Next)`;
        } else {
            timeUntilStr = `${await formatTime(effectiveWorldEvent.chapterEndAt - currentDate.getTime())} Until ${character}'s Chapter Ends`;
        }
    } else { // Regular event
        if (currentDate.getTime() < targetEvent.startAt) {
            timeUntilStr = `${await formatTime(targetEvent.startAt - currentDate.getTime())} Until ${targetEvent.name} Starts`;
        } else if (currentDate.getTime() < targetEvent.aggregateAt) {
            timeUntilStr = `${await formatTime(targetEvent.aggregateAt - currentDate.getTime())} Until ${targetEvent.name} Ends`;
        } else if (currentDate.getTime() < targetEvent.closedAt) {
            timeUntilStr = `${await formatTime(targetEvent.closedAt - currentDate.getTime())} Until ${targetEvent.name} Closes`;
        } else {
            serverNumActivity(client); // Event ended, show server count
            return;
        }
    }
    client.user?.setActivity(timeUntilStr, { type: ActivityType.Watching }); // Specify activity type
};

const formatTime = async (timeInMs: number): Promise<string> => {
    const hours = Math.floor(timeInMs / 3600000);
    const minutes = Math.floor((timeInMs % 3600000) / 60000); // Corrected calculation for remaining minutes

    return `${hours}h ${minutes}m`;
};

const updateActivity = async (client: Client): Promise<void> => {
    let time = new Date();
    time.setSeconds(0);
    time.setMilliseconds(0);
    time.setMinutes(time.getMinutes() + 1); // Set to next full minute
    let timeout = time.getTime() - new Date().getTime(); // Calculate time until next full minute
    while (timeout < 0) { // Ensure timeout is positive
        timeout += 60000;
    }
    setTimeout(() => setInterval(() => updateActivityLoop(client), 60000), timeout);
    updateActivityLoop(client); // Run once immediately
};

export default updateActivity;