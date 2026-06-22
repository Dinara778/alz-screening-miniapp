export type IndexCategoryDisplay = {
  category: string;
  humanPhrase: string;
  color: string;
};

const INSUFFICIENT: IndexCategoryDisplay = {
  category: 'Данных недостаточно для оценки',
  humanPhrase: '',
  color: '#94a3b8',
};

/** 8 диапазонов индекса когнитивной устойчивости (0–100) для экрана результата. */
export function getIndexCategory(index: number): IndexCategoryDisplay {
  if (!Number.isFinite(index)) return { ...INSUFFICIENT };

  const v = Math.max(0, Math.min(100, Math.round(index)));

  if (v >= 90) {
    return {
      category: 'Прямо сейчас у вас отличная когнитивная устойчивость',
      humanPhrase:
        'Мозг работает в отличном режиме — можно браться за сложные задачи.',
      color: '#34d399',
    };
  }
  if (v >= 80) {
    return {
      category: 'Прямо сейчас у вас хорошая когнитивная устойчивость',
      humanPhrase: 'Мозг работает стабильно — лишь иногда нужна короткая пауза.',
      color: '#34d399',
    };
  }
  if (v >= 70) {
    return {
      category: 'Прямо сейчас у вас умеренная нагрузка на когнитивную систему',
      humanPhrase: 'Мозг работает с заметной нагрузкой — но вы справляетесь.',
      color: '#a3e635',
    };
  }
  if (v >= 60) {
    return {
      category: 'Прямо сейчас у вас заметная когнитивная перегрузка',
      humanPhrase: 'Мозг работает на пределе — ему нужен более щадящий режим.',
      color: '#facc15',
    };
  }
  if (v >= 50) {
    return {
      category: 'Прямо сейчас у вас сниженная когнитивная устойчивость',
      humanPhrase: 'Устойчивость мозга снижена — стоит снизить нагрузку и выспаться.',
      color: '#ca8a04',
    };
  }
  if (v >= 40) {
    return {
      category: 'Прямо сейчас у вас выраженная когнитивная нестабильность',
      humanPhrase: 'Мозг работает нестабильно — лучше не браться за сложные задачи.',
      color: '#fb923c',
    };
  }
  if (v >= 25) {
    return {
      category: 'Прямо сейчас у вас высокая когнитивная перегрузка',
      humanPhrase: 'Мозг в режиме сильной перегрузки — ему нужен отдых.',
      color: '#f97316',
    };
  }
  return {
    category: 'Прямо сейчас у вас критически сниженная когнитивная устойчивость',
    humanPhrase: 'Устойчивость мозга сильно снижена — отложите важные дела и восстановитесь.',
    color: '#f87171',
  };
}

/** Индекс пригоден для показа 8 категорий (не деградированный / непустой замер). */
export function isIndexDisplayReady(
  value: number,
  interpretationTrusted: boolean,
  granularId?: string,
): boolean {
  return interpretationTrusted && granularId !== 'degraded' && Number.isFinite(value);
}
