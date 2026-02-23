/**
 * @fileoverview Creates a Waitlist Queue for users to join and leave
 * @author Ai0796
 */


const COMMAND = require('../command_data/waitlist');

const generateSlashCommand = require('../methods/generateSlashCommand');
const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ComponentType } = require('discord.js');
const { NENE_COLOR, FOOTER } = require('../../constants');
const fs = require('fs');
const music = require('../classes/Musics');

let DATA = loadData();
const musicData = new music();

let RATE_LIMIT = {}; // Rate limit is short, no need to store in file

const BASEDATA = {
    'users': [],
    'message_id': null,
    'server_id': null,
    'song': null, // song name
    'leavers': {}, // { user_id: timestamp }
    'lastUse': 0
};

/**
 * @param Data
 * @param Data.users Gets list of users in queue
 * @param Data.message_id Gets the last message sent
 */

function loadData() {

    let data = JSON.parse(fs.readFileSync('./data/waitlist.json'));

    return data
}

function saveData(data) {
    fs.writeFileSync('./data/waitlist.json', JSON.stringify(data, null, 4));
}

function removeUser(data, user) {
    for (const [key, value] of Object.entries(data)) {
        if (value.users.includes(user)) {
            data[key].users = value.users.filter(u => u !== user);
        }
    }

    return data;
}

function setSong(data, server_id, song) {
    if (!data[server_id]) {
        data[server_id] = JSON.parse(JSON.stringify(BASEDATA));
    }
    data[server_id].song = song;
    return data;
}

function addLeaving(data, server_id, user_id, minutes) {
    if (!data[server_id]) {
        data[server_id] = JSON.parse(JSON.stringify(BASEDATA));
    }

    if (!data[server_id].leavers) {
        data[server_id].leavers = {};
    }

    data[server_id].leavers[user_id] = Math.floor(Date.now() / 1000) + (minutes * 60);
    data[server_id].leavers = Object.fromEntries(Object.entries(data[server_id].leavers).sort(([, a], [, b]) => a - b));

    return data;
}

function checkRateLimit(channel_id) {
    return false; // Disable rate limit for now, as it is not needed
    const now = Date.now();
    if (RATE_LIMIT[channel_id] && now - RATE_LIMIT[channel_id] < 5000) {
        return true;
    } else {
        RATE_LIMIT[channel_id] = now;
        return false;
    }
}

async function waitlistEmbed(data, client) {

    const users = data.users;
    const song = data.song;
    const leavers = data.leavers;

    for (const [key, value] of Object.entries(leavers)) {
        if (value < Date.now()/1000) {
            delete leavers[key];
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
        value: users.length > 0 ? users.map(u => `<@${u}>`).join('\n') : 'No users in queue'
    })
        .setThumbnail(client.user.displayAvatarURL())
        .setTimestamp()
        .setFooter({ text: FOOTER, iconURL: client.user.displayAvatarURL() });

    const addButton = new ButtonBuilder()
        .setStyle('Primary')
        .setLabel('Join')
        .setCustomId('join');

    const removeButton = new ButtonBuilder()
        .setStyle('Danger')
        .setLabel('Leave')
        .setCustomId('leave');

    const pingNextButton = new ButtonBuilder()
        .setStyle('Secondary')
        .setLabel('Ping Next')
        .setCustomId('ping');

    const actionRow = new ActionRowBuilder()
        .addComponents(addButton, removeButton, pingNextButton);

    return { embeds: [embed], components: [actionRow] };
}

async function onInteract(interaction, discordClient, data, channel_id) {
    const { customId } = interaction;
    const user = interaction.user.id.toString();

    if (customId === 'join') {
        if (!data.users.includes(user)) {
            data.users.push(user);
        }
        await interaction.update(await waitlistEmbed(data, discordClient.client));

        await interaction.followUp({ content: `<@${user}> has joined the the waitlist`, allowedMentions: {parse: []} });
    } else if (customId === 'leave') {
        data.users = data.users.filter(u => u !== user);
        await interaction.update(await waitlistEmbed(data, discordClient.client));
    } else if (customId === 'ping') {
        if (checkRateLimit(channel_id)) {
            await interaction.reply({ content: 'Rate limited, please wait a few seconds before trying again', ephemeral: true });
            return;
        }
        if (data.users.length > 0) {
            const nextUser = data.users[0];
            confirmJoin(interaction, nextUser, discordClient);
            return;
        } else {
            await interaction.reply({ content: 'No users in queue', ephemeral: true });
            return;
        }
    }
}

async function confirmJoin(interaction, nextUser, discordClient) {
    const message = `<@${nextUser}> you are being added to the room, please do not resist\n\n(NOTE: this will remove you from all other waitlists)!\n\n(<@${interaction.user.id}> requested this ping)`;

    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setStyle('Success')
            .setLabel('Confirm')
            .setCustomId('confirmJoin')
    );

    await interaction.reply({ content: message, components: [actionRow] });
    let sent = await interaction.fetchReply();
    let channel = interaction.channel;
    let message_id = sent.id;
    let checkedIn = false;

    let collector = interaction.channel.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000
    });

    collector.on('collect', async (i) => {
        if (i.customId === 'confirmJoin' && i.user.id === nextUser) {
            i.reply({ content: 'You have been removed from other waitlists', ephemeral: true });
            channel.send(`<@${nextUser}> has been added to the room`);
            removeUser(DATA, nextUser);
            saveData(DATA);
            checkedIn = true;
            await channel.messages.fetch(message_id).then(message => message.delete());
            collector.stop();
        }
    });
    collector.on('end', async () => {
        if (checkedIn) {
            return;
        }
        try {
            channel.send({ content: `<@${nextUser}> did not confirm in time, <@${nextUser}> has been removed from the waitlist, please use /waitlist again to update`, allowedMentions: {parse: []}});
        } catch (e) {
            console.error(e);
        }
        await channel.messages.fetch(message_id).then(message => message.delete());
        removeUser(DATA, nextUser);
        saveData(DATA);
    });
}

async function joinAll(interaction, discordClient, data, server_id, song) {
    const user = interaction.user.id.toString();
    let timeCutoff = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

    let channelsJoined = [];

    for (const [key, value] of Object.entries(data)) {
        if (!value.server_id || value.server_id !== server_id) {
            continue;
        }
        if (value.lastUse < timeCutoff) {
            continue;
        }
        if (value.song === song && !value.users.includes(user)) {
            data[key].users.push(user);
            channelsJoined.push(key);
        }
    }

    saveData(data);

    return channelsJoined;
}

async function getChannelName(discordClient, channel_id) {
    try {
        let channel = await discordClient.client.channels.fetch(channel_id);
        return channel.name;
    } catch (e) {
        console.error(e);
        return 'Unknown Channel';
    }
}

async function listAll(interaction, discordClient, data, song) {
    let channels = [];
    let timeCutoff = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

    let guildId = interaction.guild.id.toString();

    for (const [key, value] of Object.entries(data)) {

        if (value.lastUse && value.lastUse < timeCutoff) {
            continue;
        }
        if (song && value.song !== song) {
            continue;
        }

        if (!value.server_id || value.server_id !== guildId) {
            continue;
        }

        if (value.lastUse < timeCutoff) {
            continue;
        }

        channels.push({
            channel: key,
            lastUse: value.lastUse,
            userCount: value.users.length,
            song: value.song || 'No song set'
        });
    }
    
    if (channels.length === 0) {
        return 'No waitlists found with the inputs';
    }

    let descriptions = [];

    if (channels.length > 1) {
        channels = channels.sort((a, b) => b.lastUse - a.lastUse); // Sort by last used
    }

    channels.forEach(channel => {
        descriptions.push(`<#${channel.channel}> <t:${channel.lastUse}:R> ${channel.userCount} in Queue \`${channel.song}\``);
    });

    await interaction.editReply({ content: descriptions.slice(0, 20).join('\n') || 'No users found in waitlist', ephemeral: true });

    descriptions = descriptions.slice(20);

    if (descriptions.length > 0) {
        while (descriptions.length > 20) {
            descriptions = descriptions.slice(20);
            await interaction.followUp({ content: descriptions.slice(0, 20).join('\n'), ephemeral: true });
        }
    }
}

async function createWaitlist(interaction, discordClient) {
    const channel_id = interaction.channel.id.toString();
    const channel_name = interaction.channel.name;

    if (!DATA) {
        DATA = loadData();
    }

    if (!DATA[channel_id]) {
        DATA[channel_id] = JSON.parse(JSON.stringify(BASEDATA));
    }

    for (const [key, value] of Object.entries(BASEDATA)) {
        if (!DATA[channel_id][key]) {
            DATA[channel_id][key] = value;
        }
    }

    var embed;
    if (channel_name.includes('-xxxxxasdfklasdfjalwkejfwekqlr')) { // disable this for now
        DATA[channel_id] = JSON.parse(JSON.stringify(BASEDATA)); // Create new instance

        embed = await waitlistEmbed(DATA[channel_id], discordClient.client);
        embed['content'] = 'Due to lack of room code, the waitlist has been cleared';
    } else {
        embed = await waitlistEmbed(DATA[channel_id], discordClient.client);
    }

    DATA[channel_id].server_id = interaction.guild.id.toString();
    DATA[channel_id].lastUse = Math.floor(Date.now() / 1000);

    console.log('Waitlist created:', DATA[channel_id]);

    const message = await interaction.editReply(embed);

    if (DATA[channel_id].message_id) {
        interaction.channel.messages.fetch(DATA[channel_id].message_id)
            .then(message => message.delete());
    }

    DATA[channel_id].message_id = message.id;

    let filter = (i) => {
        return i.message.id == DATA[channel_id].message_id && ['join', 'leave', 'ping'].includes(i.customId);
    };

    const collector = interaction.channel.createMessageComponentCollector({
        filter: filter,
        componentType: ComponentType.Button
    });

    collector.on('collect', async (e) => {
        await onInteract(e, discordClient, DATA[channel_id], channel_id);
        saveData(DATA);
    });

    saveData(DATA);
}

async function waitlistClear(discordClient, interaction, channel_id) {
    if (!DATA) {
        DATA = loadData();
    }

    // If last use is more than 1 hour ago, clear the waitlist
    if (DATA[channel_id].lastUse && (Date.now()/1000 - DATA[channel_id].lastUse) > 3600) {
        DATA[channel_id] = JSON.parse(JSON.stringify(BASEDATA));
        saveData(DATA);
        interaction.editReply({ content: 'Waitlist cleared', ephemeral: true });
        return; // Only clear if not used in the last hour
    }

    // If used within the last hour, send notification to prevent trolls
    else {
        try {
            let embed = new EmbedBuilder()
                .setColor(NENE_COLOR)
                .setTitle('Waitlist Cleared')
                .setDescription('Waitlist Clear Requested, please click the button to cancel within 3 minutes to prevent accidental clears.')
                .setTimestamp()
                .setFooter({ text: FOOTER, iconURL: discordClient.client.user.displayAvatarURL() });

            const cancelButton = new ButtonBuilder()
                .setStyle('Danger')
                .setLabel('Cancel Clear')
                .setCustomId('cancelClear');

            const actionRow = new ActionRowBuilder()
                .addComponents(cancelButton);

            const message = await interaction.editReply({ embeds: [embed], components: [actionRow], ephemeral: true });

            let cleared = true;

            const filter = (i) => {
                return i.message.id === message.id && i.customId === 'cancelClear';
            };

            const collector = interaction.channel.createMessageComponentCollector({
                filter: filter,
                componentType: ComponentType.Button,
                time: 180000 // 3 minutes
            });

            collector.on('collect', async (i) => {
                cleared = false;
                await i.update({ content: 'Waitlist clear cancelled', components: [], embeds: [] });
            });

            collector.on('end', async () => {
                if (cleared) {
                    DATA[channel_id] = JSON.parse(JSON.stringify(BASEDATA));
                    saveData(DATA);
                    try {
                        await message.edit({ content: 'Waitlist cleared', components: [], embeds: [] });
                    } catch (e) {
                        console.error(e);
                    }
                }
            });
        } catch (e) {
            console.error(e);
        }
    }
}

module.exports = {
    ...COMMAND.INFO,
    data: generateSlashCommand(COMMAND.INFO),

    async execute(interaction, discordClient) {

        await interaction.deferReply({
            ephemeral: COMMAND.INFO.ephemeral
        });

        if (!DATA) {
            DATA = loadData();
        }

        console.log('starting waitlist')

        if (interaction.options.getSubcommand() === 'show') {
            createWaitlist(interaction, discordClient);
        } else if (interaction.options.getSubcommand() === 'remove') {

            const user = interaction.options.getUser('user') ?? null;
            let channel_id = interaction.channel.id.toString();
            let user_id = user.id.toString();

            DATA[channel_id].users = DATA[channel_id].users.filter(u => u !== user_id);
            createWaitlist(interaction, discordClient);

        } else if (interaction.options.getSubcommand() === 'clear') {
            let channel_id = interaction.channel.id.toString();

            waitlistClear(discordClient, interaction, channel_id);

        } else if (interaction.options.getSubcommand() === 'leave') {

            let user_id = interaction.user.id.toString();
            DATA = removeUser(DATA, user_id);
            saveData(DATA);
            await interaction.editReply({ content: 'You have been removed from all waitlists' });

        } else if (interaction.options.getSubcommand() === 'song') {

            let song = interaction.options.getString('song');
            let channel_id = interaction.channel.id.toString();

            if (!Object.values(musicData.musics).includes(song) && song !== 'Omakase (Random)' && song.toLowerCase() !== 'minecraft') {
                await interaction.editReply({ content: `Invalid song ${song}` });
                return;
            }

            DATA = setSong(DATA, channel_id, song);

            createWaitlist(interaction, discordClient);

        } else if (interaction.options.getSubcommand() === 'leaving') {
            let minutes = interaction.options.getInteger('minutes');

            let channel_id = interaction.channel.id.toString();
            let user_id = interaction.user.id.toString();
            addLeaving(DATA, channel_id, user_id, minutes);

            createWaitlist(interaction, discordClient);
        } else if (interaction.options.getSubcommand() === 'joinall') {
            // Do something
            let song = interaction.options.getString('song');

            let channels = await joinAll(interaction, discordClient, DATA, interaction.guild.id.toString(), song);

            let channelList = channels.map((c) => `<#${c}>`).join('\n');

            await interaction.editReply({ content: `You have been added to ${channels.length} waitlists for the song ${song}`, ephemeral: true});
            if (channels.length > 0) {
                await interaction.followUp({ content: channelList, ephemeral: true });
            }

        } else if (interaction.options.getSubcommand() === 'list') {
            // Do something
            let song = interaction.options.getString('song') ?? null;
            
            await listAll(interaction, discordClient, DATA, song);
        }
    },

    async autocomplete(interaction, discordClient) {
        let focus = interaction.options.getFocused();

        if (focus == '') {
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

        let choices = Object.keys(musicData.musics).filter((key) => {
            return musicData.musics[key].toLowerCase().includes(focus.toLowerCase());
        });

        choices = choices.slice(0, 10);

        await interaction.respond(choices.map((key) => {
            return { name: musicData.musics[key], value: musicData.musics[key] };
        }));
    },
};