const parseConfig = (config: any) => {
  if (typeof config === 'string') {
    try {
      return JSON.parse(config);
    } catch {
      return {};
    }
  }

  return config ?? {};
};

const getMatchingPairs = (config: any): Array<{ left: string; right: string }> => {
  if (Array.isArray(config?.pairs)) {
    return config.pairs
      .filter((pair: any) => pair?.left && pair?.right)
      .map((pair: any) => ({ left: pair.left, right: pair.right }));
  }

  const leftItems = Array.isArray(config?.leftItems) ? config.leftItems : [];
  const rightItems = Array.isArray(config?.rightItems) ? config.rightItems : [];
  const matches = config?.matches ?? {};

  return leftItems
    .map((left: string, leftIndex: number) => {
      const rightIndex = matches[String(leftIndex)] ?? matches[leftIndex];

      if (typeof rightIndex !== 'number') return null;

      const rightRaw = rightItems[rightIndex];
      const right =
        typeof rightRaw === 'string'
          ? rightRaw
          : typeof rightRaw?.value === 'string'
            ? rightRaw.value
            : '';

      if (!left || !right) return null;

      return { left, right };
    })
    .filter((pair: any) => Boolean(pair));
};

export const resultBuilders = {
  MCQ: (question: any, answer: any) => {
    const config = parseConfig(question.config);
    
    // Correct answer is the text at the correctIndex
    const correctOption = config.options?.[config.correctIndex] || 'N/A';

    return {
      question: config.question,
      userAnswer: answer.answerData, // The text student selected
      correctAnswers: [correctOption],
      note: config.explanation ?? null,
    };
  },

  GAP_FILL: (question: any, answer: any) => {
    const config = parseConfig(question.config);
    
    const correctOption = config.options?.[config.correctIndex] || 'N/A';

    return {
      question: config.question, // e.g. "The cat ___ on the mat."
      userAnswer: answer.answerData,
      correctAnswers: [correctOption],
      note: config.explanation ?? null,
    };
  },

  MATCHING: (question: any, answer: any) => {
    const config = parseConfig(question.config);
    const pairs = getMatchingPairs(config);

    // In matching, correctAnswers is the list of pairs that should have been made
    const correctPairs = pairs.map((p: any) => `${p.left} :: ${p.right}`);

    return {
      question: config.question || 'Match the following items',
      userAnswer: Array.isArray(answer.answerData) ? answer.answerData : [answer.answerData],
      correctAnswers: correctPairs,
      note: null,
    };
  },

  WORD_BOX_MATCH: (question: any, answer: any) => {
    const config = parseConfig(question.config);

    const correctPairs = Array.isArray(config.sentences)
      ? config.sentences
          .map((sentence: any, index: number) => {
            if (typeof sentence === 'string') {
              return null;
            }

            if (!sentence?.text || !sentence?.answer) return null;

            return `${index + 1}. ${sentence.text} => ${sentence.answer}`;
          })
          .filter((value: any) => Boolean(value))
      : Array.isArray(config.items)
        ? config.items.map((item: any) => `${item.word}: ${item.definition}`)
        : [];

    return {
      question: config.question || 'Match words from the box to the sentences',
      userAnswer: Array.isArray(answer.answerData)
        ? answer.answerData
        : [answer.answerData],
      correctAnswers: correctPairs,
      note: config.explanation ?? null,
    };
  },

  QUESTION_ANSWER: (question: any, answer: any) => {
    const config = parseConfig(question.config);

    return {
      question: config.question,
      userAnswer: answer.answerData,
      // Support multiple acceptable variations of a correct answer
      correctAnswers: Array.isArray(config.acceptedAnswers) 
        ? config.acceptedAnswers 
        : [config.answer ?? config.correctAnswer],
      note: config.explanation ?? null,
    };
  },
};