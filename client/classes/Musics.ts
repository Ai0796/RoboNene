// client/classes/Musics.ts
import * as fs from 'fs';
import * as hepburn from 'hepburn';
import * as https from 'https';

const ProsekaSkillOrder = [1, 2, 3, 4, 5, 'E'];
const difficulties = ['easy', 'normal', 'hard', 'expert', 'master', 'append'];
const diffAcronyms = ['E', 'N', 'H', 'EX', 'M', 'A'];

interface MusicMeta {
  music_id: number;
  difficulty: string;
  skill_score_multi: number[];
  base_score: number;
  fever_score: number;
}

interface MusicInfo {
  id: number;
  title: string;
  pronunciation: string;
}

const getGithub = (link: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    https.get(link, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e: any) {
            reject(new Error(`Failed to parse JSON from ${link}: ${e.message}`));
          }
        } else {
          reject(new Error(`Failed to fetch data from ${link}: Status ${res.statusCode}`));
        }
      });
    }).on('error', (err: Error) => {
      reject(new Error(`Error fetching data from GitHub ${link}: ${err.message}`));
    });
  });
};

/**
 * A class designed to store music data from JSON Files
 */
class Music {
  ids: Set<number>;
  musics: { [key: number]: string };
  aliases: { [key: number]: string[] };
  musicmetas: { [key: number]: { [key: string]: (number | string)[] } };
  optimalDifficulty: { [key: number]: [number, string][] };

  constructor() {
    this.ids = new Set<number>();
    this.musics = {};
    this.aliases = {};
    this.musicmetas = {};
    this.optimalDifficulty = {};

    const tempIDs = new Set<number>();
    const musicsJSON: MusicInfo[] = JSON.parse(fs.readFileSync('./sekai_master/musics.json', 'utf8')) as MusicInfo[];
    const musicMetasJSON: MusicMeta[] = JSON.parse(fs.readFileSync('./sekai_master/music_metas.json', 'utf8')) as MusicMeta[];

    //Checks music metas first for all IDs listed
    musicMetasJSON.forEach(musicMeta => {
      this.ids.add(musicMeta.music_id);
    });

    //Checks musics second to get listed IDs titles
    musicsJSON.forEach(music => {
      if (this.ids.has(music.id)) {
        this.musics[music.id] = music.title;
        this.aliases[music.id] = [music.title, music.pronunciation];
        tempIDs.add(music.id);
      }
    });

    this.ids = this.getIntersection(this.ids, tempIDs);

    //Create new object for each song to store difficulties
    this.ids.forEach(id => {
      this.musicmetas[id] = {};
      this.optimalDifficulty[id] = [];
    });

    //Checks music metas again now that we have titles to be used as keys
    musicMetasJSON.forEach(music => {
      if (this.ids.has(music.music_id)) {
        //Slice from 0 to 5 since encore (5) doesn't matter
        let skillScores = music.skill_score_multi;
        let skillScoreOrder: [number, number][] = [];
        let skillOrder: (number | string)[] = [];

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
    const musicsJPJSON: MusicInfo[] = await getGithub('https://raw.githubusercontent.com/Sekai-World/sekai-master-db-diff/heads/main/musics.json');

    musicsJPJSON.forEach(music => {
      if (this.ids.has(music.id)) {
        this.aliases[music.id].push(music.title);
        let romaji = hepburn.fromKana(music.pronunciation)
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        this.aliases[music.id].push(romaji);
      }
    });
  }

  //Sort function for 2D arrays that orders it by value of first index
  //Sorts From highest to lowest
  sortFunction(a: [number, number], b: [number, number]): number {
    if (a[0] === b[0]) {
      return 0;
    }
    else {
      return (a[0] > b[0]) ? -1 : 1;
    }
  }

  //Returns intersection of two sets
  getIntersection(setA: Set<number>, setB: Set<number>): Set<number> {
    const intersection = new Set<number>(
      [...setA].filter(element => setB.has(element))
    );

    return intersection;
  }
}

export default Music;