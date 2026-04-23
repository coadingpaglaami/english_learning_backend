export const resultBuilders = {

  MCQ: (question: any, answer: any) => {
    const correctOption =
      question.config.options[question.config.correctIndex];

    return {
      question: question.config.question,
      userAnswer: answer.answerData,
      correctAnswers: [correctOption],
      note: question.config.explanation ?? null,
    };
  },

  GAP_FILL: (question: any, answer: any) => {
    const correctOption =
      question.config.options[question.config.correctIndex];

    return {
      question: question.config.question,
      userAnswer: answer.answerData,
      correctAnswers: [correctOption],
      note: question.config.explanation ?? null,
    };
  },

  MATCHING: (question: any, answer: any) => {

    const correctPairs = question.config.pairs
      .filter((p: any) => p.isCorrectlyMatched)
      .map((p: any) => `${p.left}::${p.right}`);

    return {
      question: question.config.question,
      userAnswer: answer.answerData,
      correctAnswers: correctPairs,
      note: null,
    };
  },

};