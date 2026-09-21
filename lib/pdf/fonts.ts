import fs from 'fs';
import path from 'path';

// TH Sarabun New font for PDF (self-hosted)
export function getTHSarabunNewBase64() {
  const fontPath = path.join(process.cwd(), 'public', 'fonts', 'THSarabunNew.ttf');

  if (!fs.existsSync(fontPath)) {
    console.warn('TH Sarabun New font not found, PDF will use fallback');
    return null;
  }

  const fontBuffer = fs.readFileSync(fontPath);
  return fontBuffer.toString('base64');
}

export function getFontFaceCSS(): string {
  const base64 = getTHSarabunNewBase64();

  if (!base64) {
    return `
      @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');
      body { font-family: 'Sarabun', sans-serif; }
    `;
  }

  return `
    @font-face {
      font-family: 'TH Sarabun New';
      src: url(data:font/truetype;charset=utf-8;base64,${base64}) format('truetype');
      font-weight: normal;
      font-style: normal;
    }
    @font-face {
      font-family: 'TH Sarabun New';
      src: url(data:font/truetype;charset=utf-8;base64,${base64}) format('truetype');
      font-weight: bold;
      font-style: normal;
    }
    body { font-family: 'TH Sarabun New', sans-serif; }
  `;
}
