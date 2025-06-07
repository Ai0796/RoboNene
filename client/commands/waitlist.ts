// client/commands/waitlist.ts
/**
 * @fileoverview Creates a Waitlist Queue for users to join and leave
 * @author Ai0796
 */

import * as COMMAND from '../command_data/waitlist'; // Assuming command_data/waitlist.ts is converted
import generateSlashCommand from '../methods/generateSlashCommand';
import { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ComponentType, CommandInteraction, MessageComponentInteraction, User, GuildMember } from 'discord.js'; // Import necessary types
import { NENE_COLOR, FOOTER } from '../../constants';
import * as fs from 'fs';
import Music from '../classes/Musics'; // Assuming Music class is default export
import generateEmbed from '../methods/generateEmbed'; // Import generateEmbed

const musicData = new Music();

interface WaitlistData {
    users: string[]; // User IDs
    message_id: string | null;
    song: string | null; // song name
    leavers: { [userId: string]: number }; // { user_id: timestamp (epoch seconds) }
}

// In-memory rate limit for 'ping' button
const RATE_LIMIT: { [channelId: string]: number } = {};

const BASEDATA: WaitlistData = {
    'users': [],
    'message_id': null,
    'song': null,
    'leavers': {}
};

// File path for waitlist data
const dataFilePath = './data/waitlist.json';

// Function to load data from file
function loadData(): { [channelId: string]: WaitlistData } {
    try {
        if (fs.existsSync(dataFilePath)) {
            const data = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
            return data as { [channelId: string]: WaitlistData }; // Type assertion
        }
    } catch (e: any) {
        console.error('Error loading waitlist data:', e);
    }
    return {};
}

// Function to save data to file
function saveData(data: { [channelId: string]: WaitlistData }): void {
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 4));
}

// Function to remove a user from all waitlists
function removeUser(allData: { [channelId: string]: WaitlistData }, userId: string): { [channelId: string]: WaitlistData } {
    for (const channelId in allData) {
        if (Object.prototype.hasOwnProperty.call(allData, channelId)) {
            allData[channelId].users = allData[channelId].users.filter(u => u !== userId);
        }
    }
    return allData;
}

// Function to set the song for a specific waitlist
function setSong(allData: { [channelId: string]: WaitlistData }, server_id: string, song: string): { [channelId: string]: WaitlistData } {
    if (!allData[server_id]) {
        allData[server_id] = JSON.parse(JSON.stringify(BASEDATA)); // Deep copy
    }
    allData[server_id].song = song;
    return allData;
}

// Function to add a user to the 'leaving soon' list
function addLeaving(allData: { [channelId: string]: WaitlistData }, server_id: string, userId: string, minutes: number): { [channelId: string]: WaitlistData } {
    if (!allData[server_id]) {
        allData[server_id] = JSON.parse(JSON.stringify(BASEDATA)); // Deep copy
    }

    if (!allData[server_id].leavers) {
        allData[server_id].leavers = {};
    }

    allData[server_id].leavers[userId] = Math.floor(Date.now() / 1000) + (minutes * 60);
    // Sort leavers by timestamp
    allData[server_id].leavers = Object.fromEntries(Object.entries(allData[server_id].leavers).sort(([, a], [, b]) => a - b));

    return allData;
}

// Function to check and apply rate limit for pinging
function checkRateLimit(channel_id: string): boolean {
    const now = Date.now();
    if (RATE_LIMIT[channel_id] && now - RATE_LIMIT[channel_id] < 5000) {
        return true;
    } else {
        RATE_LIMIT[channel_id] = now;
        return false;
    }
}

async function waitlistEmbed(data: WaitlistData, client: DiscordClient['client']): Promise<{ embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[]; content?: string }> {
    const users = data.users;
    const song = data.song;
    const leavers = data.leavers;

    // Remove expired leavers
    for (const userId in leavers) {
        if (Object.prototype.hasOwnProperty.call(leavers, userId)) {
            if (leavers[userId] < Date.now() / 1000) {
                delete leavers[userId];
            }
        }
    }

    const embed = new EmbedBuilder()
        .setColor(NENE_COLOR)
        .setTitle('Waitlist Queue');

    if (song) {
        embed.setDescription(`Song: ${song}`);
    }
    if (Object.keys(leavers).length > 0) {
        embed.addFields({
            name: 'Leaving Soon',
            value: Object.keys(leavers).map(u => `<@${u}> <t:${leavers[u]}:R>`).join('\n')
        });
    }
    embed.addFields({
        name: 'Waitlist Users',
        value: users.length > 0 ? users.map((u, index) => `${index + 1}. <@${u}>`).join('\n') : 'No users in queue'
    })
        .setThumbnail(client.user?.displayAvatarURL() || '') // Optional chaining for client.user
        .setTimestamp()
        .setFooter({ text: FOOTER, iconURL: client.user?.displayAvatarURL() || '' }); // Optional chaining

    const addButton = new ButtonBuilder()
        .setStyle(ButtonStyle.Primary)
        .setLabel('Join')
        .setCustomId('join');

    const removeButton = new ButtonBuilder()
        .setStyle(ButtonStyle.Danger)
        .setLabel('Leave')
        .setCustomId('leave');

    const pingNextButton = new ButtonBuilder()
        .setStyle(ButtonStyle.Secondary)
        .setLabel('Ping Next')
        .setCustomId('ping');

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(addButton, removeButton, pingNextButton);

    return { embeds: [embed], components: [actionRow] };
}

async function onInteract(interaction: MessageComponentInteraction, discordClient: DiscordClient, data: WaitlistData, channel_id: string): Promise<void> {
    const { customId } = interaction;
    const user = interaction.user.id.toString();

    if (customId === 'join') {
        if (!data.users.includes(user)) {
            data.users.push(user);
        }
        await interaction.update(await waitlistEmbed(data, discordClient.client));
        // Use followUp for messages that are not part of the component update
        await interaction.followUp({ content: `<@${user}> has joined the the waitlist`, allowedMentions: { parse: [] } });
    } else if (customId === 'leave') {
        data.users = data.users.filter(u => u !== user);
        await interaction.update(await waitlistEmbed(data, discordClient.client));
        await interaction.followUp({ content: `<@${user}> has left the waitlist.`, allowedMentions: { parse: [] } });
    } else if (customId === 'ping') {
        if (checkRateLimit(channel_id)) {
            await interaction.reply({ content: 'Rate limited, please wait a few seconds before trying again', ephemeral: true });
            return;
        }
        if (data.users.length > 0) {
            const nextUser = data.users[0]; // Get the first user in queue
            await confirmJoin(interaction, nextUser, discordClient);
        } else {
            await interaction.reply({ content: 'No users in queue', ephemeral: true });
        }
    }
}

async function confirmJoin(interaction: MessageComponentInteraction, nextUser: string, discordClient: DiscordClient): Promise<void> {
    const messageContent = `<@${nextUser}> you are being added to the room, please do not resist\n\n(NOTE: this will remove you from all other waitlists)!\n\n(<@${interaction.user.id}> requested this ping)`;

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setStyle(ButtonStyle.Success)
            .setLabel('Confirm')
            .setCustomId('confirmJoin')
    );

    // Reply to the interaction with the confirmation message
    const sentConfirmationMessage = await interaction.reply({ content: messageContent, components: [actionRow], fetchReply: true });

    let channel = interaction.channel;
    if (!channel || !channel.isTextBased()) { // Ensure channel is text-based
        console.error('Cannot confirm join: Channel is not text-based.');
        return;
    }

    const message_id = sentConfirmationMessage.id;
    let checkedIn = false;

    const collector = channel.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000 // 1 minute to confirm
    });

    collector.on('collect', async (i) => {
        if (i.customId === 'confirmJoin' && i.user.id === nextUser) {
            await i.reply({ content: 'You have been removed from other waitlists', ephemeral: true });
            channel.send(`<@${nextUser}> has been added to the room`);
            const allData = loadData(); // Reload all data to ensure consistency
            removeUser(allData, nextUser); // Remove from all waitlists
            saveData(allData);
            checkedIn = true;
            await channel.messages.delete(message_id).catch(console.error); // Delete confirmation message
            collector.stop();
        } else {
            await i.reply({ content: 'You are not the intended user for this button.', ephemeral: true });
        }
    });

    collector.on('end', async (_collected, reason) => {
        if (!checkedIn && reason === 'time') {
            try {
                channel.send({ content: `<@${nextUser}> did not confirm in time, <@${nextUser}> has been removed from the waitlist, please use /waitlist again to update`, allowedMentions: { parse: [] } });
            } catch (e: any) {
                console.error('Error sending timeout message:', e);
            }
            await channel.messages.delete(message_id).catch(console.error); // Delete confirmation message
            const allData = loadData(); // Reload all data
            removeUser(allData, nextUser); // Remove from all waitlists
            saveData(allData);
        }
    });
}

async function createWaitlist(interaction: CommandInteraction | MessageComponentInteraction, discordClient: DiscordClient): Promise<void> {
    const channel_id = interaction.channel?.id;
    const channel_name = interaction.channel?.name;

    if (!channel_id || !channel_name || !interaction.channel || !interaction.channel.isTextBased()) {
        await interaction.editReply({
            embeds: [generateEmbed({ name: COMMAND.INFO.name, content: { type: 'Error', message: 'This command can only be used in a text channel.' }, client: discordClient.client })]
        });
        return;
    }

    let DATA = loadData(); // Load all data for consistency

    if (!DATA[channel_id]) {
        DATA[channel_id] = JSON.parse(JSON.stringify(BASEDATA)); // Deep copy
    }

    // Ensure all base properties exist in the specific channel's data
    for (const key in BASEDATA) {
        if (Object.prototype.hasOwnProperty.call(BASEDATA, key) && !(key in DATA[channel_id])) {
            (DATA[channel_id] as any)[key] = (BASEDATA as any)[key]; // Add missing properties
        }
    }


    let embedResponse;
    if (channel_name.includes('-xxxxx')) {
        DATA[channel_id] = JSON.parse(JSON.stringify(BASEDATA)); // Clear waitlist if channel name implies "closed"
        embedResponse = await waitlistEmbed(DATA[channel_id], discordClient.client);
        embedResponse.content = 'Due to lack of room code, the waitlist has been cleared';
    } else {
        embedResponse = await waitlistEmbed(DATA[channel_id], discordClient.client);
    }

    // Edit the initial deferred reply
    const message = await interaction.editReply(embedResponse);

    // If there was a previous message for this waitlist, attempt to delete it
    if (DATA[channel_id].message_id) {
        interaction.channel.messages.delete(DATA[channel_id].message_id).catch(console.error);
    }

    DATA[channel_id].message_id = message.id; // Update message ID to the new one

    // Define filter for the new collector
    const filter = (i: MessageComponentInteraction) => {
        return i.message.id === DATA[channel_id].message_id && ['join', 'leave', 'ping'].includes(i.customId);
    };

    // Create a new collector for the new message
    const collector = interaction.channel.createMessageComponentCollector({
        filter: filter,
        componentType: ComponentType.Button
    });

    collector.on('collect', async (e) => {
        await onInteract(e, discordClient, DATA[channel_id], channel_id); // Pass the specific channel's data
        saveData(DATA); // Save all data after interaction
    });

    saveData(DATA); // Save initial state after creating message
}

export default {
    ...COMMAND.INFO,
    data: generateSlashCommand(COMMAND.INFO),

    async execute(interaction: CommandInteraction, discordClient: DiscordClient) { // Explicitly type interaction

        await interaction.deferReply({
            ephemeral: COMMAND.INFO.ephemeral
        });

        let DATA = loadData(); // Always load the latest data from file

        const subcommand = interaction.options.getSubcommand();
        const channel_id = interaction.channel?.id; // Optional chaining

        if (!channel_id) {
             await interaction.editReply({ embeds: [generateEmbed({ name: COMMAND.INFO.name, content: { type: 'Error', message: 'This command must be used in a channel.' }, client: discordClient.client })] });
             return;
        }

        if (subcommand === 'show') {
            await createWaitlist(interaction, discordClient);
        } else if (subcommand === 'remove') {
            const userToRemove = interaction.options.getUser('user');
            if (!userToRemove) {
                await interaction.editReply({ embeds: [generateEmbed({ name: COMMAND.INFO.name, content: { type: 'Error', message: 'Please provide a user to remove.' }, client: discordClient.client })] });
                return;
            }
            DATA[channel_id].users = DATA[channel_id].users.filter(u => u !== userToRemove.id.toString());
            await createWaitlist(interaction, discordClient); // Re-create waitlist to update display

        } else if (subcommand === 'clear') {
            DATA[channel_id].users = [];
            DATA[channel_id].song = null;
            DATA[channel_id].leavers = {};
            await createWaitlist(interaction, discordClient);

        } else if (subcommand === 'leave') {
            const userId = interaction.user.id.toString();
            DATA = removeUser(DATA, userId); // Remove user from all waitlists
            saveData(DATA); // Save immediately after leaving all
            await interaction.editReply({ content: 'You have been removed from all waitlists' });

        } else if (subcommand === 'song') {
            const song = interaction.options.getString('song');
            if (!song) {
                await interaction.editReply({ embeds: [generateEmbed({ name: COMMAND.INFO.name, content: { type: 'Error', message: 'Please provide a song name.' }, client: discordClient.client })] });
                return;
            }

            if (!Object.values(musicData.musics).includes(song) && song !== 'Omakase (Random)') {
                await interaction.editReply({ content: `Invalid song ${song}` });
                return;
            }

            DATA = setSong(DATA, channel_id, song); // Set song for specific channel
            await createWaitlist(interaction, discordClient);

        } else if (subcommand === 'leaving') {
            const minutes = interaction.options.getInteger('minutes');
            if (minutes === null) {
                await interaction.editReply({ embeds: [generateEmbed({ name: COMMAND.INFO.name, content: { type: 'Error', message: 'Please provide minutes.' }, client: discordClient.client })] });
                return;
            }
            const userId = interaction.user.id.toString();
            addLeaving(DATA, channel_id, userId, minutes); // Add leaving status
            await createWaitlist(interaction, discordClient);
        }
        // No need to save DATA here as createWaitlist or specific subcommand handlers already call saveData.
        // Or if changes are made to DATA outside createWaitlist, ensure saveData is called.
    },

    async autocomplete(interaction: CommandInteraction, discordClient: DiscordClient) { // Explicitly type interaction
        const focusedValue = interaction.options.getFocused();
        if (focusedValue === '') {
            await interaction.respond([
                { name: 'Hitorinbo Envy', value: 'Hitorinbo Envy' },
                { name: 'Lost and Found', value: 'Lost and Found' },
                { name: 'Melt (Sage and LnF exist)', value: 'Melt' },
                { name: 'Viva Happy', value: 'Viva Happy' },
                { name: 'Sage', value: 'Sage' },
                { name: 'Omakase (Random)', value: 'Omakase (Random)' },
            ]);
            return;
        }

        // Filter music data based on focused value (case-insensitive)
        const choices = Object.values(musicData.musics)
            .filter((songTitle: string) => songTitle.toLowerCase().includes(focusedValue.toLowerCase()))
            .slice(0, 10); // Limit to 10 choices for Discord autocomplete

        await interaction.respond(choices.map((songTitle: string) => {
            return { name: songTitle, value: songTitle };
        }));
    }
};