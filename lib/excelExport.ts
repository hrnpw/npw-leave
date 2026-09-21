/**
 * Dynamic Excel export utility
 * Lazy loads ExcelJS only when needed
 */

export async function downloadExcelFile(url: string, filename: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Export failed');

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    throw error;
  }
}

export async function createExcelWorkbook() {
  const ExcelJS = await import('exceljs');
  return new ExcelJS.Workbook();
}
