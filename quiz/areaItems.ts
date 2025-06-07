// quiz/areaItems.ts
/**
 * @fileoverview A collection of questions involving area items for the quiz
 * @author Potor10
 */

interface AreaItem {
  id: number;
  areaId: number;
  name: string;
  // Merged property for easier access
  areaName?: string;
}

interface AreaItemPrompt {
  attr?: keyof AreaItem; // Optional attribute key
  name: (item: AreaItem) => string; // Function to get the name for right/wrong answers
  prompt: (item: AreaItem) => string;
}

const areaItemQuestions: AreaItemPrompt[] = [
  {
    'attr': 'areaName',
    'name': (item: AreaItem) => {
      return item.areaName || 'Unknown Area'; // Provide fallback
    },
    'prompt': (item: AreaItem) => {
      return `Where can you find \`\`${item.name}\`\`?`;
    }
  },
  {
    'attr': 'areaName',
    'name': (item: AreaItem) => {
      return item.name;
    },
    'prompt': (item: AreaItem) => {
      return `Which item can be found in \`\`${item.areaName}\`\`?`;
    }
  }
];

export default areaItemQuestions;