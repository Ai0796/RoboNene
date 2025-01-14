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
    'song': null, // song name
    'leavers': {} // { user_id: timestamp }
};

/**
 * @param Data
 * @param Data.users Gets list of users in queue
 * @param Data.message_id Gets the last message sent
 */

function loadData() {
    return JSON.parse(fs.readFileSync('./data/waitlist.json'));
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
        data[server_id] = BASEDATA;
    }
    data[server_id].song = song;
    return data;
}

function addLeaving(data, server_id, user_id, minutes) {
    if (!data[server_id]) {
        data[server_id] = BASEDATA;
    }

    if (!data[server_id].leavers) {
        data[server_id].leavers = {};
    }

    data[server_id].leavers[user_id] = Math.floor(Date.now() / 1000) + (minutes * 60);
    data[server_id].leavers = Object.fromEntries(Object.entries(data[server_id].leavers).sort(([, a], [, b]) => a - b));

    return data;
}

function checkRateLimit(channel_id) {
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
        name: 'Users',
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
            channel.send('You did not confirm in time, you have been removed from the waitlist, please use /waitlist again to update');
        } catch (e) {
            console.error(e);
        }
        await channel.messages.fetch(message_id).then(message => message.delete());
        removeUser(DATA, nextUser);
        saveData(DATA);
    });
}

async function createWaitlist(interaction, discordClient) {
    const channel_id = interaction.channel.id.toString();
    const channel_name = interaction.channel.name;

    if (!DATA) {
        DATA = loadData();
    }

    if (!DATA[channel_id]) {
        DATA[channel_id] = BASEDATA;
    }

    for (const [key, value] of Object.entries(BASEDATA)) {
        if (!DATA[channel_id][key]) {
            DATA[channel_id][key] = value;
        }
    }

    var embed;
    if (channel_name.includes('-xxxxx')) {
        DATA[channel_id] = BASEDATA;

        embed = await waitlistEmbed(DATA[channel_id], discordClient.client);
        embed['content'] = 'Due to lack of room code, the waitlist has been cleared';
    } else {
        embed = await waitlistEmbed(DATA[channel_id], discordClient.client);
    }


    const message = await interaction.editReply(embed);

    if (DATA[channel_id].message_id) {
        interaction.channel.messages.fetch(DATA[channel_id].message_id)
            .then(message => message.delete());
    }

    DATA[channel_id].message_id = message.id;

    const collector = interaction.channel.createMessageComponentCollector({
        componentType: ComponentType.Button
    });

    collector.on('collect', async (e) => {
        await onInteract(e, discordClient, DATA[channel_id], channel_id);
        saveData(DATA);
    });

    saveData(DATA);
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
            DATA[channel_id].users = [];
            DATA[channel_id].song = null;
            DATA[channel_id].leavers = {};
            createWaitlist(interaction, discordClient);
        } else if (interaction.options.getSubcommand() === 'leave') {
            let user_id = interaction.user.id.toString();
            DATA = removeUser(DATA, user_id);
            saveData(DATA);
            await interaction.editReply({ content: 'You have been removed from all waitlists' });
        } else if (interaction.options.getSubcommand() === 'song') {
            let song = interaction.options.getString('song');
            let channel_id = interaction.channel.id.toString();

            if (!musicData.keys.has(song)) {
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
        }
    },

    async autocomplete(interaction, discordClient) {
        let focus = interaction.options.getFocused();
        console.log(focus);
        if (focus == '') {
            await interaction.respond([
                { name: 'Hitorinbo Envy', value: 'Hitorinbo Envy' },
                { name: 'Lost and Found', value: 'Lost and Found' },
                { name: 'Melt', value: 'Melt' },
                { name: 'Viva Happy', value: 'Viva Happy' },
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
    }
};