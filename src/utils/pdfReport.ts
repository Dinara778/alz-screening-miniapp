/**
 * PDF из DOM: html2canvas + jsPDF. Блок для печати обёрнут в `.pdf-export-root` (см. FullReportPage):
 * в клоне для снимка координаты сбрасываются — иначе контент за пределами экрана часто попадает в пустой PDF.
 */
export const downloadCognitiveReportPdf = async (
  element: HTMLElement,
  filename = 'otchet.pdf',
): Promise<void> => {
  const html2pdf = (await import('html2pdf.js')).default;

  const opt = {
    margin: [10, 10, 10, 10],
    filename,
    image: { type: 'jpeg' as const, quality: 0.96 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      onclone: (clonedDoc: Document) => {
        const root = clonedDoc.querySelector('.pdf-export-root');
        if (root instanceof HTMLElement) {
          root.style.left = '0px';
          root.style.top = '0px';
          root.style.position = 'fixed';
          root.style.zIndex = '2147483646';
        }
      },
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  };

  const blob: Blob = await html2pdf().set(opt as Record<string, unknown>).from(element).outputPdf('blob');
  if (!(blob instanceof Blob) || blob.size === 0) {
    throw new Error('Не удалось сформировать PDF');
  }

  const file = new File([blob], filename, { type: 'application/pdf' });

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
    try {
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Отчёт' });
        return;
      }
    } catch (e) {
      const err = e as { name?: string };
      if (err?.name === 'AbortError') return;
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
  }
};
