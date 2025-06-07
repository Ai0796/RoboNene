// client/commands/quiz.ts
/**
 * @fileoverview The main output when users call for the /quiz command
 * Contains various classes designed to pool information from the master db and
 * dynamically generate questions for the user.
 * Also contains the main method of user access to the quiz, and randomly selection
 * of a category.
 * @author Potor10
 */

import { ActionRowBuilder, StringSelectMenuBuilder, CommandInteraction, MessageComponentInteraction } from 'discord.js';
import * as fs from 'fs';

import * as COMMAND from '../command_data/quiz'; // Assuming command_data/quiz.ts is converted
import generateSlashCommand from '../methods/generateSlashCommand';
import generateEmbed from '../methods/generateEmbed';
import DiscordClient from '../client/client'; // Assuming default export
import { Content } from '../methods/generateEmbed'; // Import Content interface

/**
 * Shuffles array in place.
 * @param {Array<T>} a An array containing the items.
 * @return {Array<T>} an array that has been shuffled
 */
const shuffle = <T>(a: T[]): T[] => {
  let j, x, i;
  for (i = a.length - 1; i > 0; i--) {
    j = Math.floor(Math.random() * (i + 1));
    x = a[i];
    a[i] = a[j];
    a[j] = x;
  }
  return a;
};

interface EventData {
  id: number;
  name: string;
  startAt: number;
  aggregateAt: number;
  closedAt: number;
  eventType: string;
}

interface CharacterProfile {
  characterId: number;
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
  // Add other properties if needed
}

interface GameCharacter {
  id: number;
  givenName: string;
  firstName: string;
  unit: string; // Add unit property
}

interface CardData {
  id: number;
  attr: string;
  cardSkillName: string;
  characterId: number;
  prefix: string;
}

interface Area {
  id: number;
  name: string;
}

interface AreaItem {
  id: number;
  areaId: number;
  name: string;
}

interface Question {
  right: string;
  wrong: string[];
  prompt: string;
}

interface QuizPrompt<T> {
  attr?: keyof T;
  prompt: (data: T) => string;
  name?: (data: T) => string; // For cases where the name needs custom formatting
}

abstract class QuestionGenerator {
  protected type: string;

  constructor(type: string) {
    this.type = type;
  }

  getType(): string {
    return this.type;
  }

  abstract getQuestion(): Question;
}

/**
 * A class designed to obtain questions from existing event data
 */
class EventQuestion extends QuestionGenerator {
  private events: Event[];
  private prompts: QuizPrompt<Event>[];

  constructor() {
    super('events');
    this.events = JSON.parse(fs.readFileSync('./sekai_master/events.json', 'utf8')) as Event[];
    this.prompts = (require('../../quiz/event') as { default: QuizPrompt<Event>[] }).default; // Access default export
  }

  getQuestion(): Question {
    const eventShuffle = shuffle([...this.events]); // Create a shallow copy to avoid mutating original array

    let event: Event | undefined;
    let wrong: string[] = [];
    const maxAttempts = 100; // Limit attempts to find unique events
    let attempts = 0;

    do {
      event = eventShuffle.pop();
      if (!event) { // No more events to pick from
        // Fallback or throw an error if no valid question can be generated
        return { right: 'Unknown', wrong: ['A', 'B', 'C'], prompt: 'No event data available.' };
      }
      // Collect wrong answers ensuring they are distinct from the right answer and from each other
      wrong = [];
      const tempEventShuffle = [...eventShuffle]; // Temp copy for collecting wrong answers
      while (wrong.length < 3 && tempEventShuffle.length > 0) {
        const incorrectEvent = tempEventShuffle.pop();
        if (incorrectEvent && incorrectEvent.name !== event.name && !wrong.includes(incorrectEvent.name)) {
          wrong.push(incorrectEvent.name);
        }
      }
      attempts++;
    } while (wrong.length < 3 && attempts < maxAttempts); // Ensure enough wrong answers are found

    if (!event || wrong.length < 3) {
      // Handle scenario where not enough distinct events are found
      return { right: event?.name || 'Unknown', wrong: ['A', 'B', 'C'], prompt: 'Not enough distinct event data for a quiz.' };
    }


    const questionIdx = Math.floor(Math.random() * this.prompts.length);

    const question: Question = {
      right: event.name,
      wrong: wrong,
      prompt: this.prompts[questionIdx].prompt(event)
    };

    return question;
  }
}

/**
 * A class designed to obtain questions from existing character data
 */
class CharacterQuestion extends QuestionGenerator {
  private characterInfo: any[]; // Using any for merged character info
  private prompts: QuizPrompt<any>[];

  constructor() {
    super('characters');
    const characterProfiles: CharacterProfile[] = JSON.parse(fs.readFileSync('./sekai_master/characterProfiles.json', 'utf8')) as CharacterProfile[];
    const gameCharacters: GameCharacter[] = JSON.parse(fs.readFileSync('./sekai_master/gameCharacters.json', 'utf8')) as GameCharacter[];
    this.characterInfo = [];

    // Merge character data
    for (let idx in characterProfiles) {
      this.characterInfo.push({
        ...gameCharacters[idx], // Assuming 0-indexed array for gameCharacters corresponding to characterProfiles
        ...characterProfiles[idx]
      });
    }

    this.prompts = (require('../../quiz/characters') as { default: QuizPrompt<any>[] }).default; // Access default export
  }

  getQuestion(): Question {
    const charaShuffle = shuffle([...this.characterInfo]); // Create a shallow copy

    let character: any | undefined;
    const wrong: string[] = [];
    const questionIdx = Math.floor(Math.random() * this.prompts.length);
    const promptDef = this.prompts[questionIdx];
    const attr = promptDef.attr;

    const getName = (char: any): string => {
      let charName = char.givenName;
      if (char.firstName) {
        charName += ` ${char.firstName}`;
      }
      return charName;
    };

    const maxAttempts = 100;
    let attempts = 0;

    do {
      character = charaShuffle.pop();
      if (!character) {
        return { right: 'Unknown', wrong: ['A', 'B', 'C'], prompt: 'No character data available.' };
      }
      // Ensure the character has the attribute and it's not empty/null
    } while ((!attr || !character[attr]) && attempts++ < maxAttempts);

    if (!character) {
      return { right: 'Unknown', wrong: ['A', 'B', 'C'], prompt: 'Not enough valid character data for a quiz.' };
    }

    // Collect wrong answers ensuring they are distinct from the right answer and from each other
    const valueToMatch = attr ? character[attr] : undefined;
    const tempCharaShuffle = [...charaShuffle]; // Temp copy for collecting wrong answers
    while (wrong.length < 3 && tempCharaShuffle.length > 0) {
      const incorrectChar = tempCharaShuffle.pop();
      if (incorrectChar && attr && incorrectChar[attr] && incorrectChar[attr] !== valueToMatch && !wrong.includes(getName(incorrectChar))) {
        wrong.push(getName(incorrectChar));
      }
    }

    if (wrong.length < 3) {
      // If not enough distinct wrong answers, use generic placeholders
      while (wrong.length < 3) {
          wrong.push(`Option ${wrong.length + 1}`);
      }
    }

    const question: Question = {
      right: getName(character),
      wrong: wrong,
      prompt: promptDef.prompt(character)
    };

    return question;
  }
}

/**
 * A class designed to obtain questions from existing card data
 */
class CardQuestion extends QuestionGenerator {
  private cardInfo: any[]; // Using any for merged card info
  private prompts: QuizPrompt<any>[];

  constructor() {
    super('cards');
    const cards: CardData[] = JSON.parse(fs.readFileSync('./sekai_master/cards.json', 'utf8')) as CardData[];
    const gameCharacters: GameCharacter[] = JSON.parse(fs.readFileSync('./sekai_master/gameCharacters.json', 'utf8')) as GameCharacter[];
    this.cardInfo = [];

    for (let idx in cards) {
      this.cardInfo.push({
        ...cards[idx],
        firstName: gameCharacters[cards[idx].characterId - 1]?.firstName,
        givenName: gameCharacters[cards[idx].characterId - 1]?.givenName,
      });
    }

    this.prompts = (require('../../quiz/cards') as { default: QuizPrompt<any>[] }).default; // Access default export
  }

  getQuestion(): Question {
    const cardShuffle = shuffle([...this.cardInfo]); // Create a shallow copy

    let card: any | undefined;
    const wrong: string[] = [];
    const questionIdx = Math.floor(Math.random() * this.prompts.length);
    const promptDef = this.prompts[questionIdx];
    const attr = promptDef.attr;

    const getFullName = (cardData: any): string => {
      return `${cardData.prefix} ${cardData.givenName || ''} ${cardData.firstName || ''}`.trim();
    };

    const maxAttempts = 100;
    let attempts = 0;

    do {
      card = cardShuffle.pop();
      if (!card) {
        return { right: 'Unknown', wrong: ['A', 'B', 'C'], prompt: 'No card data available.' };
      }
    } while ((!attr || !card[attr]) && attempts++ < maxAttempts); // Ensure card has the attribute

    if (!card) {
      return { right: 'Unknown', wrong: ['A', 'B', 'C'], prompt: 'Not enough valid card data for a quiz.' };
    }

    const valueToMatch = attr ? (promptDef.name ? promptDef.name(card) : card[attr]) : undefined;
    const tempCardShuffle = [...cardShuffle];
    while (wrong.length < 3 && tempCardShuffle.length > 0) {
      const incorrectCard = tempCardShuffle.pop();
      if (incorrectCard) {
        const incorrectValue = attr ? (promptDef.name ? promptDef.name(incorrectCard) : incorrectCard[attr]) : undefined;
        if (incorrectValue !== valueToMatch && !wrong.includes(incorrectValue)) {
          wrong.push(incorrectValue);
        }
      }
    }

    if (wrong.length < 3) {
        while (wrong.length < 3) {
            wrong.push(`Option ${wrong.length + 1}`);
        }
    }

    const question: Question = {
      right: promptDef.name ? promptDef.name(card) : String(card[attr]), // Handle name function if provided
      wrong: wrong,
      prompt: promptDef.prompt(card)
    };

    return question;
  }
}

/**
 * A class designed to obtain questions from area item data
 */
class AreaQuestion extends QuestionGenerator {
  private areaItemInfo: any[]; // Using any for merged area item info
  private prompts: QuizPrompt<any>[];

  constructor() {
    super('areaItems');
    const areas: Area[] = JSON.parse(fs.readFileSync('./sekai_master/areas.json', 'utf8')) as Area[];
    const areaItems: AreaItem[] = JSON.parse(fs.readFileSync('./sekai_master/areaItems.json', 'utf8')) as AreaItem[];
    this.areaItemInfo = [];

    for (let areaItemIdx in areaItems) {
      let areaName = 'N/A';
      for (let areaIdx in areas) {
        if (areas[areaIdx].id === areaItems[areaItemIdx].areaId) {
          areaName = areas[areaIdx].name;
          break;
        }
      }

      this.areaItemInfo.push({
        ...areaItems[areaItemIdx],
        areaName: areaName
      });
    }

    this.prompts = (require('../../quiz/areaItems') as { default: QuizPrompt<any>[] }).default; // Access default export
  }

  getQuestion(): Question {
    // Remove duplicates of Music Speakers from the pool (if any) and create a shallow copy
    const areaShuffle = shuffle(this.areaItemInfo.filter((area) => {
      return area.name !== 'Music Speakers';
    }));

    let areaItem: any | undefined;
    const wrong: string[] = [];
    const questionIdx = Math.floor(Math.random() * this.prompts.length);
    const promptDef = this.prompts[questionIdx];
    const attr = promptDef.attr;

    const maxAttempts = 100;
    let attempts = 0;

    do {
      areaItem = areaShuffle.pop();
      if (!areaItem) {
        return { right: 'Unknown', wrong: ['A', 'B', 'C'], prompt: 'No area item data available.' };
      }
    } while ((!attr || !areaItem[attr]) && attempts++ < maxAttempts); // Ensure areaItem has the attribute

    if (!areaItem) {
      return { right: 'Unknown', wrong: ['A', 'B', 'C'], prompt: 'Not enough valid area item data for a quiz.' };
    }

    const valueToMatch = attr ? (promptDef.name ? promptDef.name(areaItem) : areaItem[attr]) : undefined;
    const tempAreaShuffle = [...areaShuffle];
    while (wrong.length < 3 && tempAreaShuffle.length > 0) {
      const incorrectAreaItem = tempAreaShuffle.pop();
      if (incorrectAreaItem) {
        const incorrectValue = attr ? (promptDef.name ? promptDef.name(incorrectAreaItem) : incorrectAreaItem[attr]) : undefined;
        if (incorrectValue !== valueToMatch && !wrong.includes(incorrectValue)) {
          wrong.push(incorrectValue);
        }
      }
    }
    if (wrong.length < 3) {
        while (wrong.length < 3) {
            wrong.push(`Option ${wrong.length + 1}`);
        }
    }

    const question: Question = {
      right: promptDef.name ? promptDef.name(areaItem) : String(areaItem[attr]),
      wrong: wrong,
      prompt: promptDef.prompt(areaItem)
    };

    return question;
  }
}

/**
 * Obtain the account statistics of the user (if it exists)
 * @param {string} userId the Id of the user using the quiz
 * @param {DiscordClient} discordClient the client we are using to serve requests
 * @return {any} an object containing the overall stats of the user (type any for simplicity)
 */
const getAccount = (userId: string, discordClient: DiscordClient): any => {
  // Obtain our user stats
  const user = discordClient.db?.prepare('SELECT * FROM users WHERE discord_id=@discordId').all({
    discordId: userId
  });

  let account = null;
  if (user && user.length) {
    account = user[0];
  }

  return account;
};

export default {
  data: generateSlashCommand(COMMAND.INFO),

  async execute(interaction: CommandInteraction, discordClient: DiscordClient) {
    await interaction.deferReply({
      ephemeral: COMMAND.INFO.ephemeral
    });

    // Init our question generators
    const questions: QuestionGenerator[] = [
      new EventQuestion(),
      new CharacterQuestion(),
      new CardQuestion(),
      new AreaQuestion()
    ];

    // Obtain a random question
    const questionCreator = (questions[Math.floor(Math.random() * questions.length)]);
    let question: Question;
    try {
        question = questionCreator.getQuestion();
    } catch (error) {
        console.error('Error generating quiz question:', error);
        await interaction.editReply({
            embeds: [
                generateEmbed({
                    name: COMMAND.INFO.name,
                    content: { type: 'Error', message: 'Failed to generate a quiz question. Please try again.' },
                    client: discordClient.client
                })
            ]
        });
        return;
    }


    let prompt = question.prompt + '\n';

    // Set our correct answer to be a random index (out of 4)
    const allAnswers = shuffle([question.right, ...question.wrong]); // Shuffle all answers
    const correctIdx = allAnswers.indexOf(question.right); // Find the index of the correct answer

    const answerOptions: { label: string; value: string; emoji: string }[] = [];

    for (let i = 0; i < allAnswers.length; i++) {
      const emojiKey = String(i + 1) as '1' | '2' | '3' | '4'; // Type assertion for emoji access
      answerOptions.push({
        label: allAnswers[i],
        value: allAnswers[i],
        emoji: COMMAND.CONSTANTS[emojiKey]
      });

      prompt += `${COMMAND.CONSTANTS[emojiKey]} \`\`${allAnswers[i]}\`\`\n`;
    }

    // Initialize our question selection menu
    const questionSelect = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(new StringSelectMenuBuilder()
        .setCustomId('quiz')
        .setPlaceholder('Select Your Answer!')
        .addOptions(answerOptions));

    const interactionSec = Math.round(COMMAND.CONSTANTS.INTERACTION_TIME / 1000);

    const content: Content = {
      type: questionCreator.getType(),
      message: prompt + `\n*You have ${interactionSec} seconds to answer this question*`
    };

    const quizMessage = await interaction.editReply({
      embeds: [
        generateEmbed({
          name: COMMAND.INFO.name,
          content: content,
          client: discordClient.client
        })
      ],
      components: [questionSelect],
      fetchReply: true
    });

    const filter = (i: MessageComponentInteraction) => { return i.customId === 'quiz'; };

    const collector = quizMessage.createMessageComponentCollector({
      filter,
      time: COMMAND.CONSTANTS.INTERACTION_TIME
    });

    let answered = false;

    collector.on('collect', async (i) => {
      // Determine if we have the correct user
      if (i.user.id !== interaction.user.id) {
        await i.reply({
          embeds: [
            generateEmbed({
              name: COMMAND.INFO.name,
              content: COMMAND.CONSTANTS.WRONG_USER_ERR,
              client: discordClient.client
            })
          ],
          ephemeral: true
        });
        return;
      } else {
        // Right user has answered the prompt
        answered = true;
      }

      let responseContent: Content = { // Renamed from `content` to avoid conflict
        type: '',
        message: `${question.prompt}\nYour Answer: \`\`${i.values[0]}\`\`\nCorrect Answer: \`\`${question.right}\`\`\n\n`
      };

      let account = getAccount(interaction.user.id, discordClient);

      // Initialize correct if we have an account
      let correct = (account) ? account.quiz_correct : 0;

      if (i.values[0] === question.right) {
        if (account) {
          // Update our user with the new values
          discordClient.db?.prepare('UPDATE users SET quiz_correct=@quizCorrect, ' +
            'quiz_question=@quizQuestion WHERE discord_id=@discordId').run({
              quizCorrect: account.quiz_correct + 1,
              quizQuestion: account.quiz_question + 1,
              discordId: interaction.user.id
            });
        }

        // Append message content
        responseContent.type = COMMAND.CONSTANTS.QUESTION_RIGHT_TYPE;
        responseContent.message += COMMAND.CONSTANTS.QUESTION_RIGHT_MSG;
        correct++;
      } else {
        if (account) {
          // Update our user db with the new values
          discordClient.db?.prepare('UPDATE users SET quiz_question=@quizQuestion ' +
            'WHERE discord_id=@discordId').run({
              quizQuestion: account.quiz_question + 1,
              discordId: interaction.user.id
            });
        }

        // Append message content
        responseContent.type = COMMAND.CONSTANTS.QUESTION_WRONG_TYPE;
        responseContent.message += COMMAND.CONSTANTS.QUESTION_WRONG_MSG;
      }

      if (account) {
        // Output our user statistics
        responseContent.message += `\n\nQuestions Correct: \`\`${correct}\`\``;
        responseContent.message += `\nQuestions Answered: \`\`${account.quiz_question + 1}\`\``;
        responseContent.message += `\nAccuracy: \`\`${+((correct / (account.quiz_question + 1)) * 100).toFixed(2)}%\`\``;
      } else {
        responseContent.message += `\n\n ${COMMAND.CONSTANTS.LINK_MSG}`;
      }

      await interaction.editReply({
        embeds: [
          generateEmbed({
            name: COMMAND.INFO.name,
            content: responseContent,
            client: discordClient.client
          })
        ],
        components: []
      });

    });

    collector.on('end', async () => {
      if (!answered) {
        console.log(`Collected 0 items (timeout) for user ${interaction.user.id}`);

        // If the user has not answered the question yet
        const timeoutContent: Content = { // Renamed to avoid conflict
          type: COMMAND.CONSTANTS.QUESTION_TIMEOUT_TYPE,
          message: `${question.prompt}\nCorrect Answer: \`\`${question.right}\`\`\n\n` +
            COMMAND.CONSTANTS.QUESTION_TIMEOUT_MSG
        };

        let account = getAccount(interaction.user.id, discordClient);

        if (account) {
          discordClient.db?.prepare('UPDATE users SET quiz_question=@quizQuestion ' +
            'WHERE discord_id=@discordId').run({
              quizQuestion: account.quiz_question + 1,
              discordId: interaction.user.id
            });

          timeoutContent.message += `\n\nQuestions Correct: \`\`${account.quiz_correct}\`\``;
          timeoutContent.message += `\nQuestions Answered: \`\`${account.quiz_question + 1}\`\``;
          timeoutContent.message += `\nAccuracy: \`\`${+((account.quiz_correct / (account.quiz_question + 1)) * 100).toFixed(2)}%\`\``;
        } else {
          timeoutContent.message += `\n\n ${COMMAND.CONSTANTS.LINK_MSG}`;
        }

        await interaction.editReply({
          embeds: [
            generateEmbed({
              name: COMMAND.INFO.name,
              content: timeoutContent,
              client: discordClient.client
            })
          ],
          components: []
        });
      }
    });
  }
};