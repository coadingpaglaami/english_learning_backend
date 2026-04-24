const parseConfig = (config: any) => {
  if (typeof config === 'string') {
    try {
      return JSON.parse(config);
    } catch {
      return null;
    }
  }

  return config;
};

export const judgeAnswer = (
  type: string,
  config: any,
  studentData: any,
): boolean => {
  const parsedConfig = parseConfig(config);

  if (!parsedConfig) return false;

  switch (type) {
    case 'MCQ': {
      if (typeof studentData !== 'string') return false;

      const correctOption = parsedConfig.options?.[parsedConfig.correctIndex];

      return (
        studentData.trim().toLowerCase() ===
        String(correctOption).trim().toLowerCase()
      );
    }

    case 'GAP_FILL': {
      if (typeof studentData !== 'string') return false;

      const correctAnswer =
        parsedConfig.answer ??
        parsedConfig.correctAnswer ??
        parsedConfig.options?.[parsedConfig.correctIndex];

      return (
        studentData.trim().toLowerCase() ===
        String(correctAnswer).trim().toLowerCase()
      );
    }

    case 'QUESTION_ANSWER': {
      if (typeof studentData !== 'string') return false;

      if (!parsedConfig.answer) return false;

      return (
        studentData.trim().toLowerCase() ===
        parsedConfig.answer.trim().toLowerCase()
      );
    }

    case 'MATCHING': {
      if (!Array.isArray(studentData)) return false;
      if (!Array.isArray(parsedConfig.pairs)) return false;

      const correctPairs = parsedConfig.pairs.map(
        (p: any) => `${p.left}::${p.right}`,
      );

      return (
        studentData.length === correctPairs.length &&
        studentData.every((pair: string) => correctPairs.includes(pair))
      );
    }

    default:
      return false;
  }
};
