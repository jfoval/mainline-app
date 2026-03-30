'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Inbox,
  CheckSquare,
  FolderKanban,
  Calendar,
  CalendarDays,
  Target,
  BookOpen,
  Clock,
  Menu,
  X,
  Bot,
  Settings,
  Sun,
  Moon,
  Compass,
  LifeBuoy,
  GitMerge,
  NotebookPen,
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: Clock, hotkey: 'D' },
  { href: '/process', label: 'Morning Process', icon: Sun, hotkey: 'M' },
  { href: '/shutdown', label: 'Shutdown', icon: Moon, hotkey: 'S' },
  { href: '/inbox', label: 'Inbox', icon: Inbox, hotkey: 'I' },
  { href: '/actions', label: 'Next Actions', icon: CheckSquare, hotkey: 'A' },
  { href: '/projects', label: 'Projects', icon: FolderKanban, hotkey: 'P' },
  { href: '/ideal-calendar', label: 'Ideal Calendar', icon: CalendarDays, hotkey: 'C' },
  { href: '/disciplines', label: 'Disciplines', icon: Compass, hotkey: 'L' },
  { href: '/journal', label: 'Journal', icon: NotebookPen, hotkey: 'J' },
  { href: '/horizons', label: 'Horizons', icon: Target, hotkey: 'H' },
  { href: '/reference', label: 'Reference', icon: BookOpen, hotkey: 'F' },
  { href: '/review', label: 'Review', icon: Calendar, hotkey: 'R' },
  { href: '/ai', label: 'AI Assistant', icon: Bot, hotkey: 'T' },
  { href: '/recovery', label: 'Recovery', icon: LifeBuoy },
  { href: '/conflicts', label: 'Sync Conflicts', icon: GitMerge },
  { href: '/settings', label: 'Settings', icon: Settings, hotkey: 'E' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // Don't render sidebar on login/setup pages
  if (pathname === '/login' || pathname === '/setup') return null;

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-sidebar text-sidebar-text md:hidden"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-sidebar text-sidebar-text z-40 flex flex-col transform transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="pl-12 pr-4 md:pl-4 py-4 border-b border-white/10">
          <Link href="/" className="flex items-center gap-3 outline-none focus:outline-none">
            <img src="/branding/logo-horizontal-light.svg" alt="Mainline" className="h-10" />
          </Link>
        </div>

        <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
          {navItems.map(item => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-sidebar-active text-white font-medium'
                    : 'text-sidebar-text/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon size={18} />
                <span className="flex-1">{item.label}</span>
                {item.hotkey && (
                  <kbd className="hidden md:inline text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-sidebar-text/50 leading-none">
                    g {item.hotkey}
                  </kbd>
                )}
              </Link>
            );
          })}
        </nav>

      </aside>
    </>
  );
}
