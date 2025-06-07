// client/command_data/pray.ts
/**
 * @fileoverview /pray
 * @author Ai0796
 */

import { CommandInfo } from '../methods/generateSlashCommand'; // Assuming CommandInfo exists

export const INFO: CommandInfo = {
    'name': 'pray',
    'utilization': '/pray',
    'description': 'Pray to our lord and savior Kohane',
    'ephemeral': false,
    'params': [
        {
            'type': 'string',
            'name': 'character',
            'required': false,
            'description': 'The character to pray to.',
            'choices': [
                ['Miku', 'Miku'],
                ['Rin', 'Rin'],
                ['Len', 'Len'],
                ['Luka', 'Luka'],
                ['KAITO', 'KAITO'],
                ['MEIKO', 'MEIKO'],
                ['Ichika', 'Ichika'],
                ['Saki', 'Saki'],
                ['Honami', 'Honami'],
                ['Shiho', 'Shiho'],
                ['Minori', 'Minori'],
                ['Haruka', 'Haruka'],
                ['Shizuku', 'Shizuku'],
                ['Airi', 'Airi'],
                ['An', 'An'],
                ['Akito', 'Akito'],
                ['Toya', 'Toya'],
                ['Tsukasa', 'Tsukasa'],
                ['Rui', 'Rui'],
                ['Emu', 'Emu'],
                ['Nene', 'Nene'],
                ['Kanade', 'Kanade'],
                ['Mafuyu', 'Mafuyu'],
                ['Mizuki', 'Mizuki'],
                ['Ena', 'Ena']
            ]
        }
    ]
};

export const CONSTANTS = {}; // No constants in original