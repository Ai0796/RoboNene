// quiz/characters.ts
/**
 * @fileoverview A collection of questions involving characters for the quiz
 * @author Potor10
 */

interface Character {
  id: number;
  givenName: string;
  firstName: string;
  height: string;
  characterVoice: string;
  birthday: string;
  school: string;
  schoolYear: string;
  hobby: string;
  specialSkill: string;
  favoriteFood: string;
  hatedFood: string;
  weak: string;
}

interface CharacterPrompt {
  attr?: keyof Character; // Optional attribute key
  prompt: (char: Character) => string;
}

const characterQuestions: CharacterPrompt[] = [
  {
    'attr': 'height',
    'prompt': (char: Character) => {
      return `Which character is \`\`${char.height}\`\` tall?`;
    }
  },
  {
    'attr': 'characterVoice',
    'prompt': (char: Character) => {
      return `Which character is voiced by \`\`${char.characterVoice}\`\`?`;
    }
  },
  {
    'attr': 'birthday',
    'prompt': (char: Character) => {
      return `Which character has their birthday on \`\`${char.birthday}\`\`?`;
    }
  },
  {
    'attr': 'school',
    'prompt': (char: Character) => {
      return `Which character goes to \`\`${char.school}\`\`?`;
    }
  },
  {
    'attr': 'schoolYear',
    'prompt': (char: Character) => {
      return `Which character is in year \`\`${char.schoolYear}\`\`?`;
    }
  },
  {
    'attr': 'hobby',
    'prompt': (char: Character) => {
      return `Which character has a hobby of \`\`${char.hobby?.toLowerCase()}\`\`?`; // Optional chaining for hobby
    }
  },
  {
    'attr': 'specialSkill',
    'prompt': (char: Character) => {
      return `Which character has a special skill of \`\`${char.specialSkill?.toLowerCase()}\`\`?`; // Optional chaining for specialSkill
    }
  },
  {
    'attr': 'favoriteFood',
    'prompt': (char: Character) => {
      return `Which character's favorite food is \`\`${char.favoriteFood?.toLowerCase()}\`\`?`; // Optional chaining for favoriteFood
    }
  },
  {
    'attr': 'hatedFood',
    'prompt': (char: Character) => {
      return `Which character doesn't like \`\`${char.hatedFood?.toLowerCase()}\`\`?`; // Optional chaining for hatedFood
    }
  },
  {
    'attr': 'weak',
    'prompt': (char: Character) => {
      return `Which character dislikes \`\`${char.weak?.toLowerCase()}\`\`?`; // Optional chaining for weak
    }
  },
];

export default characterQuestions;