const fs = require('fs');

const ProsekaSkillOrder = [2, 1, 4, 5, 3, 'E'];

/**
 * A class designed to store music data from JSON Files
 */
class music {
    constructor() {
        this.ids = new Set();
        this.musics = new Object();
        this.musicmetas = new Object();

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
                tempIDs.add(music.id);
            }
        });

        this.ids = this.getIntersection(this.ids, tempIDs);

        //Create new object for each song to store difficulties
        this.ids.forEach(id => {
            this.musicmetas[id] = new Object();
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