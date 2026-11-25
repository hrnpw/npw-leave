// แปลง user-agent เป็นชื่ออุปกรณ์/เบราว์เซอร์สั้นๆ สำหรับแสดงในหน้า admin
export function deviceLabel(userAgent: string | null | undefined): string {
  if (!userAgent) return 'ไม่ทราบอุปกรณ์';
  const ua = userAgent;

  let device = 'อื่นๆ';
  if (/iPhone/.test(ua)) device = 'iPhone';
  else if (/iPad/.test(ua)) device = 'iPad';
  else if (/Android/.test(ua)) device = 'Android';
  else if (/Windows/.test(ua)) device = 'Windows';
  else if (/Macintosh|Mac OS X/.test(ua)) device = 'Mac';
  else if (/CrOS/.test(ua)) device = 'Chromebook';
  else if (/Linux/.test(ua)) device = 'Linux';

  let browser = '';
  if (/SamsungBrowser/.test(ua)) browser = 'Samsung Internet';
  else if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
  else if (/Firefox|FxiOS/.test(ua)) browser = 'Firefox';
  else if (/Chrome|CriOS/.test(ua)) browser = 'Chrome';
  else if (/Safari/.test(ua)) browser = 'Safari';

  return browser ? `${device} · ${browser}` : device;
}
