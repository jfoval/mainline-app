'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Inbox,
  CheckSquare,
  FolderKanban,
  Calendar,
  Target,
  BookOpen,
  BarChart3,
  Clock,
  Menu,
  X,
  Bot,
  Settings,
  Sun,
  Moon,
  Compass,
  FileText,
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: Clock },
  { href: '/process', label: 'Morning Process', icon: Sun },
  { href: '/shutdown', label: 'Shutdown', icon: Moon },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/actions', label: 'Next Actions', icon: CheckSquare },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/pipeline', label: 'Pipeline', icon: BarChart3 },
  { href: '/clients', label: 'Clients', icon: FileText },
  { href: '/horizons', label: 'Horizons', icon: Target },
  { href: '/reference', label: 'Reference', icon: BookOpen },
  { href: '/review', label: 'Review', icon: Calendar },
  { href: '/recovery', label: 'Recovery', icon: Compass },
  { href: '/ai', label: 'AI Assistant', icon: Bot },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
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
        <div className="p-6 border-b border-white/10">
          <h1 className="text-xl font-bold">Foval GTD</h1>
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
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10" />
      </aside>
    </>
  );
}
