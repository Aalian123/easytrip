'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Car,
  ChevronDown,
  ClipboardList,
  Fuel,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Receipt,
  ScrollText,
  Settings2,
  ShieldCheck,
  TriangleAlert,
  UserCog,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { FeatureKey, Role } from '@easytrip/shared';
import { useAuth } from '@/lib/auth-context';
import { useFeatures } from '@/lib/features-context';
import { cn } from '@/lib/cn';
import { Logo, LogoMark } from './logo';
import { GlobalSearch } from './global-search';
import { NotificationBell } from './notification-bell';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface NavItem {
  href: string;
  label: string;
  roles?: Role[];
  feature?: FeatureKey;
}

interface NavGroup {
  key: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  feature?: FeatureKey;
  items: NavItem[];
}

/**
 * Grouped the way the work is grouped. Every screen has exactly one entry: a
 * filtered view (available vehicles, riders out now) is chosen on the screen
 * itself, not given a second menu item. A group with a single screen is a plain
 * link rather than a folder.
 */
const NAV: NavGroup[] = [
  {
    key: 'fleet',
    label: 'Fleet',
    icon: Car,
    feature: FeatureKey.FLEET,
    items: [{ href: '/fleet', label: 'Fleet' }],
  },
  {
    key: 'riders',
    label: 'Riders',
    icon: Users,
    feature: FeatureKey.RIDERS,
    items: [{ href: '/riders', label: 'Riders' }],
  },
  {
    key: 'assignments',
    label: 'Assignments',
    icon: ClipboardList,
    feature: FeatureKey.ASSIGNMENTS,
    items: [{ href: '/operations/assignments', label: 'Assignments' }],
  },
  {
    key: 'maintenance',
    label: 'Maintenance',
    icon: Wrench,
    feature: FeatureKey.MAINTENANCE,
    items: [
      { href: '/maintenance', label: 'Service history' },
      { href: '/maintenance/oil', label: 'Oil changes' },
    ],
  },
  {
    key: 'incidents',
    label: 'Incidents',
    icon: TriangleAlert,
    feature: FeatureKey.INCIDENTS,
    items: [
      { href: '/incidents/accidents', label: 'Accidents' },
      { href: '/incidents/damage', label: 'Damage' },
    ],
  },
  {
    key: 'fuel',
    label: 'Fuel',
    icon: Fuel,
    feature: FeatureKey.FUEL_CARDS,
    items: [
      { href: '/fuel/cards', label: 'Fuel cards', roles: ['ADMIN', 'FLEET_MANAGER', 'ACCOUNTS', 'VIEWER'] },
      { href: '/fuel/transactions', label: 'Fuel purchases', feature: FeatureKey.FUEL_TRANSACTIONS },
    ],
  },
  {
    key: 'rentals',
    label: 'Rentals',
    icon: Receipt,
    feature: FeatureKey.RENTALS,
    items: [{ href: '/finance/rentals', label: 'Rentals', roles: ['ADMIN', 'ACCOUNTS', 'FLEET_MANAGER', 'VIEWER'] }],
  },
  {
    key: 'records',
    label: 'Records',
    icon: ScrollText,
    items: [
      { href: '/reports', label: 'Reports', feature: FeatureKey.REPORTS, roles: ['ADMIN', 'FLEET_MANAGER', 'ACCOUNTS', 'VIEWER'] },
      { href: '/audit', label: 'Audit log', feature: FeatureKey.AUDIT, roles: ['ADMIN', 'ACCOUNTS', 'VIEWER'] },
    ],
  },
];

/** The menu entry a page belongs to: the longest one its path starts with. */
function activeHref(pathname: string): string | null {
  let best: string | null = null;
  for (const item of NAV.flatMap((group) => group.items)) {
    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (matches && (!best || item.href.length > best.length)) best = item.href;
  }
  return best;
}

const OPEN_GROUPS_KEY = 'easytrip:open-nav-groups:v2';

function initials(name: string | undefined): string {
  return (name ?? '?')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { enabled } = useFeatures();
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const [restored, setRestored] = useState(false);

  const role = (user?.role ?? 'VIEWER') as Role;
  const current = activeHref(pathname);

  const groups = NAV.filter((group) => !group.feature || enabled[group.feature])
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          (!item.roles || role === 'ADMIN' || item.roles.includes(role)) &&
          (!item.feature || enabled[item.feature]),
      ),
    }))
    .filter((group) => group.items.length > 0);

  // Groups start collapsed and remember whether they were opened; the one you
  // are in opens itself.
  useEffect(() => {
    let stored: string[] | null = null;
    try {
      const raw = window.localStorage.getItem(OPEN_GROUPS_KEY);
      if (raw) stored = JSON.parse(raw);
    } catch {
      stored = null;
    }
    setOpenGroups(stored ?? []);
    setRestored(true);
  }, []);

  useEffect(() => {
    const active = NAV.find((group) => group.items.some((item) => item.href === activeHref(pathname)));
    if (active) {
      setOpenGroups((current) => (current.includes(active.key) ? current : [...current, active.key]));
    }
  }, [pathname]);

  useEffect(() => {
    if (!restored) return;
    try {
      window.localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(openGroups));
    } catch {
      // Not worth interrupting anyone over.
    }
  }, [openGroups, restored]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname, params]);

  const nav = (
    <nav className="flex h-full flex-col">
      <div className="px-5 pb-5 pt-5">
        <Link href="/dashboard" aria-label="easytrip home" className="inline-block">
          <Logo priority className="h-7" />
        </Link>
      </div>

      {enabled[FeatureKey.ASSIGNMENTS] && (role === 'ADMIN' || role === 'FLEET_MANAGER') ? (
        <div className="px-3 pb-3">
          <Button className="w-full justify-start" onClick={() => router.push('/operations/assign')}>
            <Plus size={16} strokeWidth={2.5} />
            Assign a vehicle
          </Button>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <Link
          href="/dashboard"
          className={cn('rail-item mb-1 font-semibold text-ink', pathname === '/dashboard' && 'rail-item-active')}
        >
          <LayoutDashboard size={16} className="shrink-0 text-faint" />
          Dashboard
        </Link>

        <Accordion type="multiple" value={openGroups} onValueChange={setOpenGroups}>
          {groups.map((group) => {
            const Icon = group.icon;
            if (group.items.length === 1) {
              const item = group.items[0];
              return (
                <Link
                  key={group.key}
                  href={item.href}
                  className={cn('rail-item my-px font-semibold text-ink', current === item.href && 'rail-item-active')}
                >
                  <Icon size={16} className="shrink-0 text-faint" />
                  {item.label}
                </Link>
              );
            }
            return (
              <AccordionItem key={group.key} value={group.key}>
                <AccordionTrigger>
                  <Icon size={16} className="shrink-0 text-faint" />
                  <span className="flex-1 text-left">{group.label}</span>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="ml-[1.45rem] space-y-px border-l border-line pl-3">
                    {group.items.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn('rail-item py-[5px] text-[13px]', current === item.href && 'rail-item-active')}
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>

    </nav>
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="min-h-screen lg:flex">
        <aside className="hidden w-[15rem] shrink-0 border-r border-line bg-surface lg:sticky lg:top-0 lg:block lg:h-screen">
          {nav}
        </aside>

        {drawerOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-navy-deep/50" onClick={() => setDrawerOpen(false)} aria-hidden />
            <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface shadow-pop">
              <button
                type="button"
                className="absolute right-2 top-3 rounded-md p-1.5 text-muted hover:bg-canvas hover:text-navy"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
              {nav}
            </div>
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/85 backdrop-blur">
            <div className="flex h-14 items-center gap-3 px-4 lg:px-8">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Open menu"
                onClick={() => setDrawerOpen(true)}
              >
                <Menu size={18} />
              </Button>
              <Link href="/dashboard" className="lg:hidden" aria-label="easytrip home">
                <LogoMark />
              </Link>
              <div className="min-w-0 flex-1">
                <GlobalSearch />
              </div>
              {enabled[FeatureKey.ALERTS] ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <NotificationBell />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Alerts</TooltipContent>
                </Tooltip>
              ) : null}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-md py-1 pl-1 pr-1.5 text-left transition-colors hover:bg-sunken/70"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-navy text-2xs font-bold text-white">
                      {initials(user?.name)}
                    </span>
                    <span className="hidden text-sm font-semibold text-navy sm:block">
                      {user?.name?.split(' ')[0]}
                    </span>
                    <ChevronDown size={14} className="hidden text-faint sm:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuLabel>
                    <span className="block truncate">{user?.name}</span>
                    <span className="block truncate text-xs font-normal text-muted">{user?.email}</span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => router.push('/settings')}>
                    <Settings2 size={15} />
                    Settings
                  </DropdownMenuItem>
                  {role === 'ADMIN' ? (
                    <>
                      <DropdownMenuItem onSelect={() => router.push('/users')}>
                        <UserCog size={15} />
                        Users
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => router.push('/settings#features')}>
                        <ShieldCheck size={15} />
                        Features
                      </DropdownMenuItem>
                    </>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => void signOut()}
                    className="text-status-accident focus:text-status-accident"
                  >
                    <LogOut size={15} />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-8 lg:py-7">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
