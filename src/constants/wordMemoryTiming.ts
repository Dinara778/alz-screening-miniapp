/** Пауза между немедленным и отсроченным воспроизведением слов (мс). В это время — другие задания. */
export const INTERFERENCE_MS = 90_000;

export const INTERFERENCE_SEC = INTERFERENCE_MS / 1000;

/** Время на изучение списка из 5 слов */
export const WORD_STUDY_MS = 30_000;

export const WORD_STUDY_SEC = WORD_STUDY_MS / 1000;

/** Текст для анкеты: «…после других заданий (примерно …)». */
export const DELAYED_RECALL_HINT =
  INTERFERENCE_SEC >= 120 ? 'примерно через 2 минуты' : 'примерно через полторы минуты';
