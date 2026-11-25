import { describe, it, expect } from 'vitest';
import { deviceLabel } from '../push/deviceLabel';

describe('deviceLabel', () => {
  it('handles missing user-agent', () => {
    expect(deviceLabel(null)).toBe('ไม่ทราบอุปกรณ์');
  });

  it('detects iPhone Safari (installed PWA)', () => {
    expect(
      deviceLabel(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
      )
    ).toBe('iPhone · Safari');
  });

  it('detects Android Chrome', () => {
    expect(
      deviceLabel(
        'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
      )
    ).toBe('Android · Chrome');
  });

  it('detects Samsung Internet before Chrome', () => {
    expect(
      deviceLabel(
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36'
      )
    ).toBe('Android · Samsung Internet');
  });

  it('detects Windows Edge before Chrome', () => {
    expect(
      deviceLabel(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0'
      )
    ).toBe('Windows · Edge');
  });
});
