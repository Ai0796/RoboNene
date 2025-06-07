// client/commands/blessing.ts
/**
 * @fileoverview BLESSING
 * @author Ai0796
 */


import { CommandInteraction } from 'discord.js';
import * as COMMAND from '../command_data/blessing'; // Import all exports from blessing
import generateSlashCommand from '../methods/generateSlashCommand'; // Assuming default export
import * as fs from 'fs';
import DiscordClient from '../client/client'; // Assuming default export

const fp = './JSONs/blessing.json';

const blessingLyrics = [
    'Blessings for your birthday',
    'Blessings for your everyday',
    'saigo no ichibyou made mae o muke',
    'hagashite mo naze da ka fueteku tagu to',
    'ranku zuke sareteku rifujin na kachi',
    'sonna mono de hito o oshihakaranaide to',
    'tobikau kotoba o te de ooikakushita',
    'Oh… It\'s time to get up tomoshibi o kesu mae ni',
    'Oh… It\'s time to get up ashimoto o terase!',
    'hora koko o jitto mitsumete mite',
    'saikou no mikata ga utsutteru desho?',
    'sore wa inochi no akashi',
    'Blessings for your birthday',
    'Blessings for your everyday',
    'tatoe ashita sekai ga horonde mo',
    'Blessings for your birthday',
    'Blessings for your everyday',
    'saigo no ichibyou made mae o muke',
    'Hip hip HOORAY',
    'kore kara saki mo',
    'Hip hip HOORAY',
    'kimi ni sachi are',
    'zero kara ichi o umu no wa tayasukunai koto',
    'kanjin na mono wa mienai shi sawarenai koto',
    'fukou to wa shiawase da to kizukenai koto',
    'mainichi ga tanjoubi de meinichi na koto',
    'Oh… Stand up take action doronuma o kakiwakete',
    'Oh… Stand up take action hachisu no hana wa saku!',
    'hora koko ni te o kasanete mite',
    'nukumori ga tsutawatte kuru desho?',
    'sore wa inochi no akashi',
    'Blessings for your birthday',
    'Blessings for your everyday',
    'tatoe kireigoto datte kamawanai',
    'Blessings for your birthday',
    'Blessings for your everyday',
    'kono yo ni umarete kurete arigatou',
    'Hip hip HOORAY',
    'kore kara saki mo',
    'Hip hip HOORAY',
    'kimi ni sachi are',
    'saa saa yotterasshai miterasshai',
    'rokku de ittara konna fuu',
    'Like this Like this Yeah',
    'akapera de ittara konna fuu',
    'Like this Like this Yeah',
    'geemu de ittara konna fuu',
    'Like this Like this Yeah',
    'dansu de ittara konna fuu',
    'Da da da da da',
    'yoku tabete',
    'yoku nemutte',
    'yoku asonde',
    'yoku manade',
    'yoku shabette',
    'yoku kenka shite',
    'goku futsuu na mainichi o',
    'nakenakute mo',
    'waranakute mo',
    'utaenakute mo',
    'nani mo nakute mo',
    'aisenakute mo',
    'aisarenakute mo',
    'soredemo ikite hoshii',
    'Blessings for your birthday',
    'Blessings for your everyday',
    'tatoe ashita sekai ga horonde mo',
    'Blessings for your birthday',
    'Blessings for your everyday',
    'saigo no ichibyou made mae o muke',
    'If you\'re alive',
    'ano ko ga furimuku kamo',
    'If you\'re alive',
    'takarakuji ataru kamo',
    'If you\'re alive',
    'futatabi hajimaru kamo',
    'ikinuku tame nara',
    'bou ni fure',
    'mizu o sase',
    'kemuri ni make',
    'abura o ure',
    'utsutsu o nukase',
    'soshite raishuu mo',
    'raigetsu mo',
    'rainen mo',
    'raise mo',
    'issho ni iwaou',
    'Blessings for your birthday',
    'Blessings for your everyday',
    'taoe kireigoto datte kamawani',
    'Blessings for your birthday',
    'Blessings for your everyday',
    'koko ni tsudoeta kiseki ni arigatou',
    'Hip hip HOORAY',
    'kore kara saki mo',
    'Hip hip HOORAY',
    'kimi ni sachi are',
    'Hip hip HOORAY',
    'kore kara saki mo',
    'Hip hip HOORAY',
    'kimi ni sachi are',
    '🎉🎊✨🎂 Hip hip HOORAY!!! 🎂✨🎊🎉',
];

interface BlessingFile {
    blessings: number;
}

function getBonks(): number {
    let bonk = 0;
    let bonkFile: BlessingFile;
    try {
        if (!fs.existsSync(fp)) {
            bonkFile = { blessings: 0 }; // Initialize if file doesn't exist
        }
        else {
            bonkFile = JSON.parse(fs.readFileSync(fp, 'utf8')) as BlessingFile;
        }

        if ('blessings' in bonkFile) {
            bonkFile['blessings'] = bonkFile['blessings'] + 1;
        }
        else {
            bonkFile['blessings'] = 0; // Should be 1 if it's the first bonk.
        }

        bonk = bonkFile['blessings'];

        fs.writeFile(fp, JSON.stringify(bonkFile), err => {
            if (err) {
                console.error('Error writing Bonk', err); // Changed to console.error
            } else {
                console.log('Wrote Bonk Successfully');
            }
        });
    } catch (e: any) { // Type as any for error
        console.error('Error occurred while writing blessings:', e); // Changed to console.error
    }

    return bonk;
}

export default {
    ...COMMAND.INFO,
    data: generateSlashCommand(COMMAND.INFO),

    async execute(interaction: CommandInteraction, discordClient: DiscordClient) {
        // await interaction.reply("test")
        try {
            const bonks = getBonks();

            await interaction.reply(blessingLyrics[bonks % blessingLyrics.length]);
        } catch (e: any) { // Type as any for error
            console.error(e); // Changed to console.error
            await interaction.reply('An unexpected error occurred while processing the blessing command.');
        }
    }
};