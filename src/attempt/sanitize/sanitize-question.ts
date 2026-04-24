export const sanitizeQuestion = (question: any) => {
  const config =
    typeof question.config === 'string'
      ? JSON.parse(question.config)
      : question.config;

  switch (question.type) {
    case 'MCQ':
      return {
        ...question,
        config: {
          question: config.question,
          options: config.options,
        },
      };

    case 'GAP_FILL':
      return {
        ...question,
        config: {
          question: config.question,
          options: config.options,
        },
      };

    case 'MATCHING':
      return {
        ...question,
        config: {
          question: config.question,
          pairs: config.pairs.map((pair: any) => ({
            id: pair.id,
            left: pair.left,
            right: pair.right,
          })),
        },
      };

    case 'QUESTION_ANSWER':
      return {
        ...question,
        config: {
          question: config.question,
        },
      };

    default:
      return {
        ...question,
        config,
      };
  }
};
