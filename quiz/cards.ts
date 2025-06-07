// quiz/cards.ts
/**
 * @fileoverview A collection of questions involving cards for the quiz
 * @author Potor10
 */

interface Card {
  id: number;
  attr: string;
  cardSkillName: string;
  characterId: number;
  prefix: string;
  // Merged properties from gameCharacters for easier access
  givenName?: string;
  firstName?: string;
}

interface CardPrompt {
  attr?: keyof Card; // Optional attribute key
  name: (card: Card) => string; // Function to get the name for right/wrong answers
  prompt: (card: Card) => string;
}

/**
 * Obtains the full name of a card; Last Name + First Name (otherwise just Last Name)
 * @param {Card} card the data of the card we want to obtain a name from
 */
const getName = (card: Card): string => {
  let charName = card.givenName || ''; // Use empty string if undefined
  if (card.firstName) {
    charName += ` ${card.firstName}`;
  }
  return charName.trim();
};

const getFullName = (card: Card): string => {
  return `${card.prefix} ${getName(card)}`;
};

const cardQuestions: CardPrompt[] = [
  {
    'attr': 'attr',
    'name': (card: Card) => {
      return getFullName(card);
    },
    'prompt': (card: Card) => {
      return `Which character has the attribute \`\`${card.attr}\`\`?`;
    }
  },
  {
    'attr': 'attr',
    'name': (card: Card) => {
      return card.attr;
    },
    'prompt': (card: Card) => {
      return `The card \`\`${getFullName(card)}\`\` is what attribute?`;
    }
  },
  {
    'attr': 'cardSkillName',
    'name': (card: Card) => {
      return getFullName(card);
    },
    'prompt': (card: Card) => {
      return `Which card has the skill: \`\`${card.cardSkillName}\`\`?`;
    }
  },
  {
    'attr': 'cardSkillName',
    'name': (card: Card) => {
      return card.cardSkillName;
    },
    'prompt': (card: Card) => {
      return `The card \`\`${getFullName(card)}\`\` has which skill?`;
    }
  },
  {
    'attr': 'characterId', // This attribute indicates the character associated with the card
    'name': (card: Card) => {
      return card.prefix;
    },
    'prompt': (card: Card) => {
      return `Which is a valid prefix for the character: \`\`${getName(card)}\`\`?`;
    }
  }
];

export default cardQuestions;