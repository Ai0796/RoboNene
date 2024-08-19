/**
 * @fileoverview Creates a Waitlist Queue for users to join and leave
 * @author Ai0796
 */


const COMMAND = require('../command_data/waitlist');

const generateSlashCommand = require('../methods/generateSlashCommand');
const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ComponentType } = require('discord.js');
const { NENE_COLOR, FOOTER } = require('../../constants');
const fs = require('fs');

let DATA = loadData();

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

async function waitlistEmbed(users, client) {
    const embed = new EmbedBuilder()
        .setColor(NENE_COLOR)
        .setTitle('Waitlist Queue')
        .addFields({
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

async function onInteract(interaction, discordClient, data) {
    const { customId } = interaction;
    const user = interaction.user.id.toString();

    if (customId === 'join') {
        if (!data.users.includes(user)) {
            data.users.push(user);
        }
        await interaction.update(await waitlistEmbed(data.users, discordClient.client));
    } else if (customId === 'leave') {
        data.users = data.users.filter(u => u !== user);
        await interaction.update(await waitlistEmbed(data.users, discordClient.client));
    } else if (customId === 'ping') {
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
    const message = `<@${nextUser}> you are being added to the room, please do not resist\n\n(NOTE: this will remove you from all other waitlists)!`;

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

    if (!DATA) {
        DATA = loadData();
    }

    if (!DATA[channel_id]) {
        DATA[channel_id] = {
            'users': [],
            'message_id': null
        };
    }

    const embed = await waitlistEmbed(DATA[channel_id].users, discordClient.client);

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
        await onInteract(e, discordClient, DATA[channel_id]);
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
            createWaitlist(interaction, discordClient);
        }        
    }
};

