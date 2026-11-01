import {
  CalendarCheck,
  CalendarClock,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  MapPin,
  ScrollText,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '@/lib/auth';

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/attendance', label: 'Kehadiran', icon: CalendarCheck },
  { to: '/leave', label: 'Izin & Cuti', icon: CalendarClock },
  { to: '/employees', label: 'Karyawan', icon: Users },
  { to: '/office', label: 'Lokasi & Shift', icon: MapPin },
  { to: '/reports', label: 'Laporan', icon: FileSpreadsheet },
  { to: '/audit', label: 'Audit Log', icon: ScrollText },
];

function navClass(isActive: boolean): string {
  return [
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition whitespace-nowrap',
    isActive
      ? 'bg-indigo-600 text-white'
      : 'text-slate-600 hover:bg-slate-100',
  ].join(' ');
}

export function Layout() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-lg font-bold text-white">
            C
          </span>
          <div>
            <p className="text-sm font-bold text-slate-900">ClockIn</p>
            <p className="text-xs text-slate-500">Admin / HRD</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => navClass(isActive)}>
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <p className="truncate px-3 pb-2 text-xs text-slate-500">
            {session?.user.email}
          </p>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100">
            <LogOut className="h-4 w-4" />
            Keluar
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
              C
            </span>
            <span className="text-sm font-bold text-slate-900">ClockIn Admin</span>
          </div>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
            <LogOut className="h-4 w-4" />
            Keluar
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `${navClass(isActive)} px-2.5 py-1.5 text-xs`
              }>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="p-4 lg:pl-72 lg:pr-8 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}
