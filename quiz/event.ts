/**
 * @fileoverview A collection of questions involving events for the quiz
 * @author Potor10
 */

import { EventData } from '../client/methods/getEventData'; // Adjust the import path as necessary

interface EventQuestion {
  attr?: keyof EventData; // Optional attribute key
  prompt: (char: EventData) => string;
}

const characterQuestions: EventQuestion[] = [
  {
    'attr': 'startAt',
    'prompt': (event: EventData) => {
      return `Which event began on <t:${Math.floor(event.startAt/1000)}>?`;
    }
  },
  {
    'attr': 'aggregateAt',
    'prompt': (event: EventData) => {
      return `Which event's ranking period ended on <t:${Math.floor(event.aggregateAt/1000)}>?`;
    }
  },
  {
    'attr': 'closedAt',
    'prompt': (event: EventData) => {
      return `Which event closed on <t:${Math.floor(event.closedAt/1000)}>?`;
    }
  },
];

export default characterQuestions;