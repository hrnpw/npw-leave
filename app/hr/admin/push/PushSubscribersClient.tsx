'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bell, BellOff, ChevronDown, ChevronUp, Search, Smartphone, X } from 'lucide-react';
import HrLayoutWrapper from '@/components/hr/HrLayoutWrapper';
import type { HrRole } from '@/lib/roles';

export interface TeacherPushRow {
  id: string;
  teacherCode: string;
  name: string;
  department: string | null;
  lastSeenAt: string | null;
  devices: {
    id: string;
    label: string;
    createdAt: string;
    lastUsedAt: string;
  }[];
}

interface Props {
  hrUser: { id: string; firstName: string; lastName: string; role: HrRole };
  rows: TeacherPushRow[];
  now: string;
}

type Filter = 'all' | 'on' | 'off';

const dateTimeFormat = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const dateFormat = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function relativeTime(iso: string, nowMs: number): string {
  const diffMin = Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 60000));
  if (diffMin < 1) return 'เมื่อสักครู่';
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} ชั่วโมงที่แล้ว`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay} วันที่แล้ว`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth} เดือนที่แล้ว`;
  return `${Math.floor(diffMonth / 12)} ปีที่แล้ว`;
}

export default function PushSubscribersClient({ hrUser, rows, now }: Props) {
  const router = useRouter();
  const nowMs = new Date(now).getTime();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const enabledCount = rows.filter((r) => r.devices.length > 0).length;
  const deviceCount = rows.reduce((sum, r) => sum + r.devices.length, 0);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (filter === 'on' && r.devices.length === 0) return false;
        if (filter === 'off' && r.devices.length > 0) return false;
        if (!q) return true;
        return (
          r.name.toLowerCase().includes(q) ||
          r.teacherCode.toLowerCase().includes(q) ||
          (r.department ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        // คนที่เข้าแอปล่าสุดขึ้นก่อน, คนที่ไม่มีข้อมูลไปท้าย (เรียงตามชื่อ)
        if (a.lastSeenAt && b.lastSeenAt) return b.lastSeenAt.localeCompare(a.lastSeenAt);
        if (a.lastSeenAt) return -1;
        if (b.lastSeenAt) return 1;
        return a.name.localeCompare(b.name, 'th');
      });
  }, [rows, query, filter]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'ทั้งหมด', count: rows.length },
    { id: 'on', label: 'เปิดแล้ว', count: enabledCount },
    { id: 'off', label: 'ยังไม่เปิด', count: rows.length - enabledCount },
  ];

  return (
    <HrLayoutWrapper hrUser={hrUser}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 lg:pb-8">
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-5xl mx-auto px-4 py-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                aria-label="กลับ"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  การแจ้งเตือนของครู
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  ครูที่เปิด push และเวลาเข้าแอปล่าสุด
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-6">
              <Stat label="ครูทั้งหมด" value={rows.length} />
              <Stat label="เปิดแจ้งเตือน" value={enabledCount} accent />
              <Stat label="อุปกรณ์" value={deviceCount} />
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาชื่อ รหัส หรือกลุ่มสาระ"
              className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-base focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="ล้างคำค้นหา"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            )}
          </div>

          <div className="flex gap-2" role="tablist">
            {filters.map((f) => (
              <button
                key={f.id}
                role="tab"
                aria-selected={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filter === f.id
                    ? 'bg-sky-600 text-white'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-12">
              ไม่พบครูตามเงื่อนไข
            </p>
          ) : (
            <ul className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
              {visible.map((r) => {
                const on = r.devices.length > 0;
                const isOpen = expanded.has(r.id);
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => on && toggle(r.id)}
                      disabled={!on}
                      aria-expanded={on ? isOpen : undefined}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left enabled:hover:bg-slate-50 dark:enabled:hover:bg-slate-800/50 transition-colors"
                    >
                      <div
                        className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center ${
                          on
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                        }`}
                      >
                        {on ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900 dark:text-slate-100 truncate">{r.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {r.teacherCode}
                          {r.department ? ` · ${r.department}` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {r.lastSeenAt ? (
                          <>
                            <p className="text-sm text-slate-900 dark:text-slate-100" suppressHydrationWarning>
                              {relativeTime(r.lastSeenAt, nowMs)}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{r.devices.length} อุปกรณ์</p>
                          </>
                        ) : (
                          <p className="text-sm text-slate-400">ยังไม่เปิด</p>
                        )}
                      </div>
                      {on &&
                        (isOpen ? (
                          <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                        ))}
                    </button>

                    {on && isOpen && (
                      <ul className="px-4 pb-3 pl-16 space-y-2">
                        {r.devices.map((d) => (
                          <li
                            key={d.id}
                            className="flex items-start gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2"
                          >
                            <Smartphone className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                            <div className="min-w-0 text-sm">
                              <p className="font-medium text-slate-800 dark:text-slate-200">{d.label}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400" suppressHydrationWarning>
                                เข้าแอปล่าสุด {dateTimeFormat.format(new Date(d.lastUsedAt))} น.
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400" suppressHydrationWarning>
                                เปิดแจ้งเตือนเมื่อ {dateFormat.format(new Date(d.createdAt))}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            เวลาเข้าแอปล่าสุดจะบันทึกเฉพาะเครื่องที่เปิดการแจ้งเตือนไว้ (อัปเดตเมื่อครูเปิดหน้าหลักของแอป)
            ครูที่ยังไม่เปิดการแจ้งเตือนจึงไม่มีข้อมูลนี้
          </p>
        </main>
      </div>
    </HrLayoutWrapper>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p
        className={`text-xl font-bold tabular-nums ${
          accent ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
