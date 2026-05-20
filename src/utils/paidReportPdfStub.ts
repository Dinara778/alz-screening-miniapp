import type { PaidReportData } from './paidReport';

/** Текстовое представление платного отчёта (заглушка до полноценного PDF). */
export function formatPaidReportPlainText(report: PaidReportData): string {
  const lines: string[] = [
    report.title,
    report.dateLabel,
    '',
    `Индекс когнитивной устойчивости: ${report.indexValue}/100 — ${report.indexLabel}`,
    '',
    'Расширенная интерпретация',
    `В жизни: ${report.extendedInterpretation.inLife}`,
    `Как это ощущается: ${report.extendedInterpretation.feeling}`,
    `О чём говорит результат: ${report.extendedInterpretation.aboutResult}`,
    '',
    `Ведущий дефицит: ${report.leadingDeficitTitle}`,
  ];

  if (report.overloadEntries.length) {
    lines.push('', 'Персональная карта перегрузки');
    report.overloadEntries.forEach((row) => {
      lines.push(`— ${row.title}`, row.description, `Пример: ${row.example}`);
    });
  }

  if (report.seriousRecommendations.length) {
    lines.push('', 'Адресные рекомендации');
    report.seriousRecommendations.forEach((r, i) => lines.push(`${i + 1}. ${r}`));
  }

  lines.push('', report.footerDisclaimer);
  return lines.join('\n');
}

/**
 * Заглушка генерации PDF: лог в консоль и возврат текста для UI.
 * Позже заменить на html2pdf / серверный рендер.
 */
export async function generatePaidReportPdfStub(report: PaidReportData): Promise<string> {
  const text = formatPaidReportPlainText(report);
  if (import.meta.env.DEV) {
    console.info('[paidReport PDF stub]\n', text);
  }
  return text;
}
