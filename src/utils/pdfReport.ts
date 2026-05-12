export const downloadCognitiveReportPdf = async (
  element: HTMLElement,
  filename = 'otchet.pdf',
): Promise<void> => {
  const html2pdf = (await import('html2pdf.js')).default;
  await html2pdf()
    .set({
      margin: [10, 10, 10, 10],
      filename,
      image: { type: 'jpeg', quality: 0.96 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    } as Record<string, unknown>)
    .from(element)
    .save();
};
