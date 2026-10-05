'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Play, Smartphone } from 'lucide-react';
import { Modal } from '@/components/Modal';

const STORAGE_KEY = 'add_to_home_modal_last_shown';
const INTERVAL_MS = 1 * 24 * 60 * 60 * 1000;
const TUTORIAL_URL = 'https://www.youtube.com/shorts/8O3805Zf8g0';

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function AddToHomeModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    try {
      const lastShown = Number(localStorage.getItem(STORAGE_KEY) || '0');
      if (Date.now() - lastShown < INTERVAL_MS) return;
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      return;
    }

    setOpen(true);
  }, []);

  const close = () => setOpen(false);

  return (
    <AnimatePresence>
      {open && (
        <Modal title="เพิ่มแอปลงหน้าจอ" onClose={close}>
          <div className="flex flex-col items-center text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 dark:bg-sky-900/30">
              <Smartphone className="h-7 w-7 text-sky-600 dark:text-sky-400" aria-hidden />
            </div>
            <p className="text-body-sm text-secondary mb-4">
              เพิ่มแอปแจ้งลาไว้บนหน้าจอ เปิดใช้งานได้ทันทีเหมือน App #ไม่ต้องจำ link
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <a
              href={TUTORIAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={close}
              className="flex items-center justify-center gap-2 rounded-lg bg-sky-500 py-3 font-semibold text-white transition-colors hover:bg-sky-600"
            >
              <Play className="h-4 w-4" aria-hidden />
              ดูวิธีเพิ่มลงหน้าจอโฮม
            </a>
            <button
              type="button"
              onClick={close}
              className="rounded-lg bg-slate-100 py-3 font-medium text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              ไว้ทีหลัง
            </button>
          </div>
        </Modal>
      )}
    </AnimatePresence>
  );
}
