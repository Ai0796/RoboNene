/**
 * @fileoverview Allows you to bonk a user
 * @author Ai0796
 */


const COMMAND = require('../command_data/cat');

const generateSlashCommand = require('../methods/generateSlashCommand');
const axios = require('axios');
const CAT_API_KEY = require('../../config.json').CAT_API_KEY;

module.exports = {
    ...COMMAND.INFO,
    data: generateSlashCommand(COMMAND.INFO),

    async execute(interaction, discordClient) {
        let queryParams = {
            'has_breeds': true,
            'mime_types': 'jpg,png',
            'size': 'small',
            'sub_id': interaction.user.id,
            'limit': 1
        };

        let url = 'https://api.thecatapi.com/v1/images/search'
        url = new URL(url);
        queryParams = new URLSearchParams(queryParams);

        url.search = queryParams.toString();
        let response = await axios.get(url, { headers: { 'x-api-key': CAT_API_KEY } });
        let data = response.data;
        let catUrl = data[0].url;

        await interaction.reply({ content: 'Cat', files: [catUrl] });
    }
};