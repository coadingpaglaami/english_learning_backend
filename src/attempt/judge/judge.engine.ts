export const judgeAnswer = (
  type: string,
  config: any,
  studentData: any,
): boolean => {
  switch (type) {
    case 'MCQ':
      if (typeof studentData !== 'string') return false;

      const correctOption = config.options?.[config.correctIndex];
      return studentData === correctOption;

    case 'GAP_FILL':
      if (typeof studentData !== 'string') return false;

      const correctAnswer = config.options?.[config.correctIndex];
      return studentData === correctAnswer;

    case 'MATCHING':
      if (!Array.isArray(studentData)) return false;

      const correctPairs = config.pairs.map(
        (p: any) => `${p.left}::${p.right}`,
      );

      return (
        studentData.length === correctPairs.length &&
        studentData.every((pair: string) => correctPairs.includes(pair))
      );
    case 'QUESTION_ANSWER':
      if (typeof studentData !== 'string') return false;

      const parsedConfig =
        typeof config === 'string' ? JSON.parse(config) : config;

      if (!parsedConfig.answer) return false;

      return (
        studentData.toLowerCase().trim() ===
        parsedConfig.answer.toLowerCase().trim()
      );

    default:
      return false;
  }
};
