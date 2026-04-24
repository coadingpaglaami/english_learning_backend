export const resultBuilders = {
  MCQ: (question: any, answer: any) => {
    const config = typeof question.config === 'string' ? JSON.parse(question.config) : question.config;
    
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
    const config = typeof question.config === 'string' ? JSON.parse(question.config) : question.config;
    
    const correctOption = config.options?.[config.correctIndex] || 'N/A';

    return {
      question: config.question, // e.g. "The cat ___ on the mat."
      userAnswer: answer.answerData,
      correctAnswers: [correctOption],
      note: config.explanation ?? null,
    };
  },

  MATCHING: (question: any, answer: any) => {
    const config = typeof question.config === 'string' ? JSON.parse(question.config) : question.config;

    // In matching, correctAnswers is the list of pairs that should have been made
    const correctPairs = config.pairs.map((p: any) => `${p.left} :: ${p.right}`);

    return {
      question: config.question || 'Match the following items',
      userAnswer: Array.isArray(answer.answerData) ? answer.answerData : [answer.answerData],
      correctAnswers: correctPairs,
      note: null,
    };
  },

  WORD_BOX_MATCH: (question: any, answer: any) => {
    const config = typeof question.config === 'string' ? JSON.parse(question.config) : question.config;

    // Typically: { "word": "Apple", "definition": "A red fruit" }
    const correctPairs = config.items.map((item: any) => `${item.word}: ${item.definition}`);

    return {
      question: "Match words from the box to their definitions",
      userAnswer: answer.answerData, 
      correctAnswers: correctPairs,
      note: config.explanation ?? null,
    };
  },

  QUESTION_ANSWER: (question: any, answer: any) => {
    const config = typeof question.config === 'string' ? JSON.parse(question.config) : question.config;

    return {
      question: config.question,
      userAnswer: answer.answerData,
      // Support multiple acceptable variations of a correct answer
      correctAnswers: Array.isArray(config.acceptedAnswers) 
        ? config.acceptedAnswers 
        : [config.correctAnswer],
      note: config.explanation ?? null,
    };
  },
};