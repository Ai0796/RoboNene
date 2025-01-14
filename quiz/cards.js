/**
 * @fileoverview A collection of questions involving cards for the quiz
 * @author Potor10
 */

/**
 * Obtains the full name of a card; Last Name + First Name (otherwise just Last Name)
 * @param {Object} card the data of the card we want to obtain a name from
 */
const getName = (card) => {
  let charName = card.givenName;
  if (card.firstName) {
    charName += ` ${card.firstName}`;
  }
  return charName;
};

const getFullName = (card) => {
  return `${card.prefix} ${getName(card)}`;
};

module.exports = [
  {
    'attr': 'attr',
    'name': (card) => {
      return getFullName(card);
    },
    'prompt': (card) => {
      return `Which character has the attribute \`\`${card.attr}\`\`?`;
    }
  },
  {
    'attr': 'attr',
    'name': (card) => {
      return card.attr;
    },
    'prompt': (card) => {
      return `The card \`\`${getFullName(card)}\`\` is what attribute?`;
    }
  },
  {
    'attr': 'cardSkillName',
    'name': (card) => {
      return getFullName(card);
    },
    'prompt': (card) => {
      return `Which card has the skill: \`\`${card.cardSkillName}\`\`?`;
    }
  },
  {
    'attr': 'cardSkillName',
    'name': (card) => {
      return card.cardSkillName;
    },
    'prompt': (card) => {
      return `The card \`\`${getFullName(card)}\`\` has which skill?`;
    }
  },
  {
    'attr': 'characterId',
    'name': (card) => {
      return card.prefix;
    },
    'prompt': (card) => {
      return `Which is a valid prefix for the character: \`\`${getName(card)}\`\`?`;
    }
  }
];