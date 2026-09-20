import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export async function getBrowser() {
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    // Development: use local Chrome
    return puppeteer.launch({
      headless: true,
      executablePath:
        process.platform === 'win32'
          ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
          : process.platform === 'darwin'
          ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
          : '/usr/bin/google-chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }

  // Production: use @sparticuz/chromium
  return puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 1280, height: 720 },
    executablePath: await chromium.executablePath(),
    headless: true,
  });
}
