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

const musicData = new music();

let RATE_LIMIT = {}; // Rate limit is short, no need to store in file

const BASEDATA = {
    'userIds': [],
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

function saveData(data) {
    fs.writeFileSync('./data/waitlist.json', JSON.stringify(data, null, 4));
}

async function fetchData(server_id, discordClient) {
    const data = await discordClient.stockdb.ref(`waitlists/${server_id}`).get();
    if (data.exists()) {
        return data.val();
    } else {
        return {};
    }
}

async function setData(server_id, data, discordClient) {
    await discordClient.stockdb.ref(`waitlists/${server_id}`).set(data);
}

async function removeUser(user, discordClient) {
    const snapshots = await discordClient.stockdb.ref('waitlists').get();
    const data = snapshots.val() || {};

    for (const [key, value] of Object.entries(data)) {
        if (value.userIds && value.userIds.includes(user)) {
            await discordClient.stockdb.ref(`waitlists/${key}/userIds`).transaction(snap => {
                const currentIds = snap.val() || [];
                const index = currentIds.indexOf(user);

                if (index > -1) {
                    currentIds.splice(index, 1);
                }
                return currentIds;
            });
        }
    }
}

async function addUser(server_id, user, discordClient) {
    const ref = discordClient.stockdb.ref(`waitlists/${server_id}/userIds`);

    let added = false;
    
    // Use a transaction to safely append to the array
    await ref.transaction(snap => {
        const currentIds = snap.val() || [];
        
        // Prevent duplicate entries
        if (!currentIds.includes(user)) {
            added = true;
            currentIds.push(user);
        }
        
        return currentIds; 
    });

    return added;
}

async function removeUserIndividual(server_id, user, discordClient) {
    const ref = discordClient.stockdb.ref(`waitlists/${server_id}/userIds`);

    await ref.transaction(snap => {
        const currentIds = snap.val() || [];

        const index = currentIds.indexOf(user);
        if (index > -1) {
            currentIds.splice(index, 1);
        }
        return currentIds;
    });
}

async function setSong(server_id, song, discordClient) {
    const ref = discordClient.stockdb.ref(`waitlists/${server_id}/song`);
    await ref.set(song);
}

async function addLeaving(server_id, user_id, minutes, discordClient) {
    const ref = await discordClient.stockdb.ref(`waitlists/${server_id}`);

    await ref.transaction(snap => {
        const data = snap.val();

        data.leavers[user_id] = Math.floor(Date.now() / 1000) + (minutes * 60);
        return data;
    });
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

async function waitlistEmbed(channel_id, discordClient) {

    const client = discordClient.client;
    let data = await fetchData(channel_id, discordClient);

    console.log('Waitlist Data:', data);
    const users = data.userIds || [];
    const song = data.song;
    const leavers = data.leavers;

    console.log(users, song, leavers);

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

async function onInteract(interaction, discordClient, channel_id) {
    try {
        const { customId } = interaction;
        const user = interaction.user.id.toString();

        if (customId === 'join') {
            if (await addUser(channel_id, user, discordClient)) {
                await interaction.update(await waitlistEmbed(channel_id, discordClient));
                await interaction.followUp({ content: `<@${user}> has joined the the waitlist`, allowedMentions: { parse: [] } });
            } else {
                interaction.reply({ content: 'You are already in the waitlist', ephemeral: true });
            }
        } else if (customId === 'leave') {
            await removeUserIndividual(channel_id, user, discordClient);
            await interaction.update(await waitlistEmbed(channel_id, discordClient));
        } else if (customId === 'ping') {
            if (checkRateLimit(channel_id)) {
                await interaction.reply({ content: 'Rate limited, please wait a few seconds before trying again', ephemeral: true });
                return;
            }
            let data = await fetchData(channel_id, discordClient);
            if (data.userIds) {
                const nextUser = data.userIds[0];
                await confirmJoin(interaction, nextUser, discordClient);
                return;
            } else {
                await interaction.reply({ content: 'No users in queue', ephemeral: true });
                return;
            }
        }
    } catch (e) {
        console.error(e);
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

        if (i.replied || i.deferred) return;

        try {
            if (i.customId === 'confirmJoin' && i.user.id === nextUser) {
                await i.reply({ content: 'You have been removed from other waitlists', ephemeral: true });
                channel.send(`<@${nextUser}> has been added to the room, please refresh the waitlist to see the updated queue`);
                removeUser(nextUser, discordClient);
                checkedIn = true;
                await channel.messages.fetch(message_id).then(message => message.delete());
                collector.stop();
            }
        } catch (e) {
            console.error(e);
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
        await removeUser(nextUser, discordClient);
    });
}

async function joinAll(interaction, discordClient, server_id, song) {
    const user = interaction.user.id.toString();
    let timeCutoff = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

    let channelsJoined = [];

    const snapshots = await discordClient.stockdb.ref('waitlists').get();
    const data = snapshots.val() || {};

    for (const [key, value] of Object.entries(data)) {

        console.log(`Checking waitlist ${key}:`, value);
        if (value.server_id === server_id && value.lastUse >= timeCutoff && value.song === song) {
            await addUser(key, user, discordClient);
            channelsJoined.push(key);
        }
    }

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

async function listAll(interaction, discordClient, song) {
    let channels = [];
    let timeCutoff = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

    let guildId = interaction.guild.id.toString();

    const snapshots = await discordClient.stockdb.ref('waitlists').get();
    const data = snapshots.val() || {};

    for (const [key, value] of Object.entries(data)) {
        if (value.server_id === guildId && value.lastUse >= timeCutoff) {
            if (song && value.song !== song) {
                continue;
            }
            channels.push({
                channel: key,
                lastUse: value.lastUse,
                userCount: value.userIds ? value.userIds.length : 0,
                song: value.song || 'No song set'
            });
        }
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

    let data = await fetchData(channel_id, discordClient);

    if (!data || Object.keys(data).length === 0) {
        await discordClient.stockdb.ref(`waitlists/${channel_id}`).set(JSON.parse(JSON.stringify(BASEDATA)));
        data = await fetchData(channel_id, discordClient);
    }

    for (const [key, value] of Object.entries(BASEDATA)) {
        if (!data[key]) {
            await discordClient.stockdb.ref(`waitlists/${channel_id}/${key}`).set(value);
        }
    }

    data = await fetchData(channel_id, discordClient);

    var embed;
    if (channel_name.includes('-xxxxxasdfklasdfjalwkejfwekqlr')) { // disable this for now
        await discordClient.stockdb.ref(`waitlists/${channel_id}`).set(JSON.parse(JSON.stringify(BASEDATA)));

        embed = await waitlistEmbed(channel_id, discordClient);
        embed['content'] = 'Due to lack of room code, the waitlist has been cleared';
    } else {
        embed = await waitlistEmbed(channel_id, discordClient);
    }

    await discordClient.stockdb.ref(`waitlists/${channel_id}/server_id`).set(interaction.guild.id.toString());
    await discordClient.stockdb.ref(`waitlists/${channel_id}/lastUse`).set(Math.floor(Date.now() / 1000));

    console.log('Waitlist created:', await fetchData(channel_id, discordClient));

    const message = await interaction.editReply(embed);

    if (data.message_id) {
        interaction.channel.messages.fetch(data.message_id)
            .then(message => message.delete());
    }

    await discordClient.stockdb.ref(`waitlists/${channel_id}/message_id`).set(message.id);

    let filter = (i) => {
        return i.message.id == (message.id) && ['join', 'leave', 'ping'].includes(i.customId);
    };

    const collector = interaction.channel.createMessageComponentCollector({
        filter: filter,
        componentType: ComponentType.Button
    });

    collector.on('collect', async (e) => {
        await onInteract(e, discordClient, channel_id);
    });
}

async function waitlistClear(discordClient, interaction, channel_id) {

    let data = await fetchData(channel_id, discordClient);

    // If last use is more than 1 hour ago, clear the waitlist
    if (data.lastUse && (Date.now()/1000 - data.lastUse) > 3600) {
        await discordClient.stockdb.ref(`waitlists/${channel_id}`).set(JSON.parse(JSON.stringify(BASEDATA)));
        saveData(discordClient.stockdb);
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
                    discordClient.stockdb.ref(`waitlists/${channel_id}`).set(JSON.parse(JSON.stringify(BASEDATA)));
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

        console.log('starting waitlist');

        if (interaction.options.getSubcommand() === 'show') {
            createWaitlist(interaction, discordClient);
        } else if (interaction.options.getSubcommand() === 'remove') {

            const user = interaction.options.getUser('user') ?? null;
            let channel_id = interaction.channel.id.toString();
            let user_id = user.id.toString();

            await removeUserIndividual(channel_id, user_id, discordClient);
            createWaitlist(interaction, discordClient);

        } else if (interaction.options.getSubcommand() === 'clear') {
            let channel_id = interaction.channel.id.toString();

            waitlistClear(discordClient, interaction, channel_id);

        } else if (interaction.options.getSubcommand() === 'leave') {

            let user_id = interaction.user.id.toString();
            await removeUser(user_id, discordClient);
            await interaction.editReply({ content: 'You have been removed from all waitlists' });

        } else if (interaction.options.getSubcommand() === 'song') {

            let song = interaction.options.getString('song');
            let channel_id = interaction.channel.id.toString();

            if (!Object.values(musicData.musics).includes(song) && song !== 'Omakase (Random)' && song.toLowerCase() !== 'minecraft') {
                await interaction.editReply({ content: `Invalid song ${song}` });
                return;
            }

            await setSong(channel_id, song, discordClient);

            createWaitlist(interaction, discordClient);

        } else if (interaction.options.getSubcommand() === 'leaving') {
            let minutes = interaction.options.getInteger('minutes');

            let channel_id = interaction.channel.id.toString();
            let user_id = interaction.user.id.toString();
            await addLeaving(channel_id, user_id, minutes, discordClient);

            createWaitlist(interaction, discordClient);
        } else if (interaction.options.getSubcommand() === 'joinall') {
            // Do something
            let song = interaction.options.getString('song');

            let channels = await joinAll(interaction, discordClient, interaction.guild.id.toString(), song);

            let channelList = channels.map((c) => `<#${c}>`).join('\n');

            await interaction.editReply({ content: `You have been added to ${channels.length} waitlists for the song ${song}`, ephemeral: true});
            if (channels.length > 0) {
                await interaction.followUp({ content: channelList, ephemeral: true });
            }

        } else if (interaction.options.getSubcommand() === 'list') {
            // Do something
            let song = interaction.options.getString('song') ?? null;
            
            await listAll(interaction, discordClient, song);
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