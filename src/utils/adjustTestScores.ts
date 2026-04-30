export type TestResults = {
  delayedRecall: number;
  faceRecognition: number;
  flankerRT: number;
  flankerCV: number;
  simpleRT: number;
  simpleCV: number;
  stroopErrors: number;
};

export type Demographics = {
  age: number;
  sex: 'male' | 'female';
  educationYears: number;
};

export type AdjustMetricKey = keyof TestResults;

export type AdjustConfig = {
  impairmentZThreshold: number;
  riskLabels: {
    normal: string;
    observation: string;
    moderate: string;
    high: string;
  };
  coefficients: {
    delayedRecallEducationPerYear: number;
    faceFemaleZBonus: number;
    flankerRtAgePerYear: number;
    flankerRtEducationPerYear: number;
    flankerRtMaleZBonus: number;
    flankerCvAgePerYear: number;
    flankerCvEducationPerYear: number;
    simpleRtAgePerYear: number;
    simpleRtEducationPerYear: number;
    simpleRtMaleMsBonus: number;
    simpleCvAgePerYear: number;
    simpleCvEducationPerYear: number;
    stroopErrorsAgeAfter50PerYear: number;
  };
};

export type AdjustedMetric = {
  metric: AdjustMetricKey;
  raw: number;
  corrected: number;
  mean: number;
  sd: number;
  z: number;
  flagged: boolean;
};

export type AdjustTestScoresOutput = {
  zScores: Record<AdjustMetricKey, number>;
  flags: Record<AdjustMetricKey, boolean>;
  totalFlags: number;
  riskLevel: string;
  metrics: AdjustedMetric[];
};

const DEFAULT_CONFIG: AdjustConfig = {
  impairmentZThreshold: -1.5,
  riskLabels: {
    normal: 'Normal',
    observation: 'Observation',
    moderate: 'Moderate risk',
    high: 'High risk',
  },
  coefficients: {
    delayedRecallEducationPerYear: 0.2,
    faceFemaleZBonus: 0.1,
    flankerRtAgePerYear: 0.5,
    flankerRtEducationPerYear: 1.5,
    flankerRtMaleZBonus: -0.1,
    flankerCvAgePerYear: 0.05,
    flankerCvEducationPerYear: 0.1,
    simpleRtAgePerYear: 1.5,
    simpleRtEducationPerYear: 0.5,
    simpleRtMaleMsBonus: 10,
    simpleCvAgePerYear: 0.2,
    simpleCvEducationPerYear: 0.05,
    stroopErrorsAgeAfter50PerYear: 0.2,
  },
};

const zHigherBetter = (corrected: number, mean: number, sd: number): number =>
  (corrected - mean) / sd;

const zLowerBetter = (corrected: number, mean: number, sd: number): number =>
  (mean - corrected) / sd;

/**
 * Коррекция результатов когнитивных тестов с учетом демографии.
 * Возвращает Z-оценки, флаги нарушения (Z < threshold) и итоговый риск.
 */
export function adjustTestScores(
  results: TestResults,
  demographics: Demographics,
  customConfig?: Partial<AdjustConfig>,
): AdjustTestScoresOutput {
  const config: AdjustConfig = {
    ...DEFAULT_CONFIG,
    ...customConfig,
    riskLabels: { ...DEFAULT_CONFIG.riskLabels, ...(customConfig?.riskLabels ?? {}) },
    coefficients: {
      ...DEFAULT_CONFIG.coefficients,
      ...(customConfig?.coefficients ?? {}),
    },
  };

  const c = config.coefficients;
  const age = demographics.age;
  const edu = demographics.educationYears;
  const eduDelta12 = edu - 12;

  // 1) Отсроченное воспроизведение (RAVLT/CERAD-подобное)
  let delayedMean = 10.44;
  let delayedSd = 3.2;
  if (age <= 40) {
    delayedMean = demographics.sex === 'female' ? 12.14 : 11.95;
    delayedSd = demographics.sex === 'female' ? 1.8 : 2.6;
  } else if (age <= 59) {
    delayedMean = demographics.sex === 'female' ? 11.54 : 10.44;
    delayedSd = demographics.sex === 'female' ? 2.5 : 3.2;
  } else {
    delayedMean = demographics.sex === 'female' ? 10.53 : 9.57;
    delayedSd = demographics.sex === 'female' ? 2.9 : 3.4;
  }
  const delayedCorrected =
    results.delayedRecall + eduDelta12 * c.delayedRecallEducationPerYear;
  const delayedZ = zHigherBetter(delayedCorrected, delayedMean, delayedSd);

  // 2) Узнавание лиц-имен (FNAME): стратификация по возрасту и образованию <=8/>8
  const lowEdu = edu <= 8;
  let faceMean = 2.4;
  let faceSd = 0.7;
  if (age < 50) {
    faceMean = lowEdu ? 2.4 : 2.8;
    faceSd = lowEdu ? 0.7 : 0.5;
  } else if (age <= 65) {
    faceMean = lowEdu ? 2.0 : 2.4;
    faceSd = lowEdu ? 0.8 : 0.6;
  } else {
    faceMean = lowEdu ? 1.5 : 2.0;
    faceSd = lowEdu ? 0.9 : 0.7;
  }
  const faceCorrected = results.faceRecognition;
  let faceZ = zHigherBetter(faceCorrected, faceMean, faceSd);
  if (demographics.sex === 'female') {
    faceZ += c.faceFemaleZBonus;
  }

  // 3) Flanker (неконгруэнтные RT/CV), референт: 30 лет
  const flankerRtCorrected =
    results.flankerRT -
    (age - 30) * c.flankerRtAgePerYear +
    eduDelta12 * c.flankerRtEducationPerYear;
  const flankerCvCorrected =
    results.flankerCV -
    (age - 30) * c.flankerCvAgePerYear +
    eduDelta12 * c.flankerCvEducationPerYear;

  let flankerRtZ = zLowerBetter(flankerRtCorrected, 244, 23);
  if (demographics.sex === 'male') {
    flankerRtZ += c.flankerRtMaleZBonus;
  }
  const flankerCvZ = zLowerBetter(flankerCvCorrected, 9.4, 2.5);

  // 4) Простая сенсомоторная реакция (RT/CV), референт: 20-30 лет
  const simpleRtCorrected =
    results.simpleRT -
    (age - 30) * c.simpleRtAgePerYear +
    eduDelta12 * c.simpleRtEducationPerYear -
    (demographics.sex === 'male' ? c.simpleRtMaleMsBonus : 0);
  const simpleCvCorrected =
    results.simpleCV -
    (age - 30) * c.simpleCvAgePerYear +
    eduDelta12 * c.simpleCvEducationPerYear;

  const simpleRtZ = zLowerBetter(simpleRtCorrected, 298.5, 57.5);
  const simpleCvZ = zLowerBetter(simpleCvCorrected, 27, 5);

  // 5) Stroop ошибки (неконгруэнтные), по образованию >12/<=12
  const stroopMean = edu > 12 ? 6 : 10;
  const stroopSd = edu > 12 ? 3 : 4;
  const stroopCorrected =
    results.stroopErrors -
    (age > 50 ? (age - 50) * c.stroopErrorsAgeAfter50PerYear : 0);
  const stroopZ = zLowerBetter(stroopCorrected, stroopMean, stroopSd);

  const metrics: AdjustedMetric[] = [
    {
      metric: 'delayedRecall',
      raw: results.delayedRecall,
      corrected: delayedCorrected,
      mean: delayedMean,
      sd: delayedSd,
      z: delayedZ,
      flagged: delayedZ < config.impairmentZThreshold,
    },
    {
      metric: 'faceRecognition',
      raw: results.faceRecognition,
      corrected: faceCorrected,
      mean: faceMean,
      sd: faceSd,
      z: faceZ,
      flagged: faceZ < config.impairmentZThreshold,
    },
    {
      metric: 'flankerRT',
      raw: results.flankerRT,
      corrected: flankerRtCorrected,
      mean: 244,
      sd: 23,
      z: flankerRtZ,
      flagged: flankerRtZ < config.impairmentZThreshold,
    },
    {
      metric: 'flankerCV',
      raw: results.flankerCV,
      corrected: flankerCvCorrected,
      mean: 9.4,
      sd: 2.5,
      z: flankerCvZ,
      flagged: flankerCvZ < config.impairmentZThreshold,
    },
    {
      metric: 'simpleRT',
      raw: results.simpleRT,
      corrected: simpleRtCorrected,
      mean: 298.5,
      sd: 57.5,
      z: simpleRtZ,
      flagged: simpleRtZ < config.impairmentZThreshold,
    },
    {
      metric: 'simpleCV',
      raw: results.simpleCV,
      corrected: simpleCvCorrected,
      mean: 27,
      sd: 5,
      z: simpleCvZ,
      flagged: simpleCvZ < config.impairmentZThreshold,
    },
    {
      metric: 'stroopErrors',
      raw: results.stroopErrors,
      corrected: stroopCorrected,
      mean: stroopMean,
      sd: stroopSd,
      z: stroopZ,
      flagged: stroopZ < config.impairmentZThreshold,
    },
  ];

  const zScores = metrics.reduce(
    (acc, m) => {
      acc[m.metric] = m.z;
      return acc;
    },
    {} as Record<AdjustMetricKey, number>,
  );

  const flags = metrics.reduce(
    (acc, m) => {
      acc[m.metric] = m.flagged;
      return acc;
    },
    {} as Record<AdjustMetricKey, boolean>,
  );

  const totalFlags = metrics.filter((m) => m.flagged).length;
  const riskLevel =
    totalFlags === 0
      ? config.riskLabels.normal
      : totalFlags === 1
        ? config.riskLabels.observation
        : totalFlags <= 3
          ? config.riskLabels.moderate
          : config.riskLabels.high;

  return {
    zScores,
    flags,
    totalFlags,
    riskLevel,
    metrics,
  };
}
