/** Подписи блоков интерпретации — акцент на состоянии «прямо сейчас». */
export const INTERPRETATION_LABEL_IN_LIFE = 'Скорее всего сейчас:';
export const INTERPRETATION_LABEL_FEELING = 'Как это ощущается:';
export const INTERPRETATION_LABEL_MANIFESTATION = 'Как это ощущается:';
export const INTERPRETATION_LABEL_ABOUT_RESULT = 'О чём говорит результат:';
export const INTERPRETATION_LABEL_RECOMMENDATIONS = 'Рекомендации:';

/** Текст после «…:» — без повторного «сейчас», с маленькой буквы. */
export function normalizeInterpretationFragment(text: string): string {
  let t = text.trim();
  if (!t) return t;
  t = t.replace(/^(?:Сейчас|Прямо сейчас|Скорее всего)\s+/iu, '');
  if (!t) return t;
  return t.charAt(0).toLowerCase() + t.slice(1);
}
