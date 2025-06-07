const fs = require('fs');
const hepburn = require('hepburn');
const https = require('https');

const ProsekaSkillOrder = [1, 2, 3, 4, 5, 'E'];
const difficulties = ['easy', 'normal', 'hard', 'expert', 'master', 'append'];
const diffAcronyms = ['E', 'N', 'H', 'EX', 'M', 'A'];

const getGithub = (link) => {
    return new Promise((resolve, reject) => {
        https.get(link, (res) => {
            let data = '';
            // A chunk of data has been received.
            res.on('data', (chunk) => {
                data += chunk;
            });
            // The whole response has been received.
            res.on('end', () => {
                try {
                    // Parse the data and resolve the promise.
                    resolve(JSON.parse(data));
                } catch (e) {
                    // If parsing fails, reject the promise.
                    reject(new Error(`Failed to parse JSON from ${link}: ${e.message}`));
                }
            });
        }).on('error', (err) => {
            // Handle request errors by rejecting the promise.
            reject(new Error(`Error fetching data from GitHub ${link}: ${err.message}`));
        });
    });
};

/**
 * A class designed to store music data from JSON Files
 */
class music {
    constructor() {
        this.ids = new Set();
        this.musics = new Object();
        this.aliases = new Object();
        this.musicmetas = new Object();
        this.optimalDifficulty = new Object();

        const tempIDs = new Set();
        const musicsJSON = JSON.parse(fs.readFileSync('./sekai_master/musics.json'));
        const musicMetasJSON = JSON.parse(fs.readFileSync('./sekai_master/music_metas.json'));

        //Checks music metas first for all IDs listed
        musicMetasJSON.forEach(musicMeta => {
            this.ids.add(musicMeta.music_id);
        });

        //Checks musics second to get listed IDs titles
        musicsJSON.forEach(music => {
            if(this.ids.has(music.id)) {
                this.musics[music.id] = music.title;
                this.aliases[music.id] = [music.title, music.pronunciation]
                tempIDs.add(music.id);
            }
        });

        this.ids = this.getIntersection(this.ids, tempIDs);

        //Create new object for each song to store difficulties
        this.ids.forEach(id => {
            this.musicmetas[id] = new Object();
            this.optimalDifficulty[id] = new Array();
        });

        //Checks music metas again now that we have titles to be used as keys
        musicMetasJSON.forEach(music => {
            if(this.ids.has(music.music_id))
            {
                //Slice from 0 to 5 since encore (5) doesn't matter
                let skillScores = music.skill_score_multi;
                let skillScoreOrder = [];
                let skillOrder = [];

                skillScoreOrder = skillScores.map((skillScore, i) => [skillScore, i]);

                //Sort to get correct order
                skillScoreOrder.sort(this.sortFunction);

                skillOrder = skillScoreOrder.map((skill) => {
                    return ProsekaSkillOrder[skill[1]];
                });

                this.musicmetas[music.music_id][music.difficulty] = skillOrder;
                let skillScore = music.skill_score_multi.reduce((a, b) => a + b, 0);
                skillScore *= 2.2;
                let score = music.base_score + music.fever_score + skillScore;
                let diffAcronym = diffAcronyms[difficulties.indexOf(music.difficulty)];
                this.optimalDifficulty[music.music_id].push([score, diffAcronym]);
            }
        });
    }

    async loadAliases() {
        const musicsJPJSON = await getGithub('https://raw.githubusercontent.com/Sekai-World/sekai-master-db-diff/heads/main/musics.json');

        musicsJPJSON.forEach(music => {
            if(this.ids.has(music.id)) {
                this.aliases[music.id].push(music.title);
                let romaji = hepburn.fromKana(music.pronunciation)
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                this.aliases[music.id].push();
            }
        });
    }

    //Sort function for 2D arrays that orders it by value of first index
    //Sorts From highest to lowest
    sortFunction(a, b) {
        if (a[0] === b[0]) {
            return 0;
        }
        else {
            return (a[0] > b[0]) ? -1 : 1;
        }
    }

    //Returns intersection of two sets
    getIntersection(setA, setB) {
        const intersection = new Set(
            [...setA].filter(element => setB.has(element))
        );

        return intersection;
    }
}

module.exports = music;