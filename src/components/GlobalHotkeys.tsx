'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useChordHotkeys } from '@/hooks/useGlobalHotkeys';

export default function GlobalHotkeys() {
  const router = useRouter();

  const chordMap = useMemo(() => ({
    d: () => router.push('/'),
    m: () => router.push('/process'),
    s: () => router.push('/shutdown'),
    i: () => router.push('/inbox'),
    a: () => router.push('/actions'),
    p: () => router.push('/projects'),
    c: () => router.push('/ideal-calendar'),
    l: () => router.push('/disciplines'),
    j: () => router.push('/journal'),
    h: () => router.push('/horizons'),
    f: () => router.push('/reference'),
    r: () => router.push('/review'),
    t: () => router.push('/ai'),
    e: () => router.push('/settings'),
  }), [router]);

  const shiftMap = useMemo(() => ({
    M: () => router.push('/process'),
    S: () => router.push('/shutdown'),
    R: () => router.push('/review'),
  }), [router]);

  useChordHotkeys(chordMap, shiftMap);

  return null;
}
