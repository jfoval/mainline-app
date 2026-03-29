'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';

interface CompletionCelebrationProps {
  /** Headline text, e.g. "You're ready!" or "Shutdown Complete" */
  title: string;
  /** Subtitle text shown below the title */
  subtitle: string;
  /** Delay in ms before auto-redirecting to dashboard (default 2400) */
  redirectDelay?: number;
}

export default function CompletionCelebration({
  title,
  subtitle,
  redirectDelay = 2400,
}: CompletionCelebrationProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<'circle' | 'check' | 'text'>('circle');

  useEffect(() => {
    // Phase timings: circle draws (600ms) → check appears → text fades in
    const t1 = setTimeout(() => setPhase('check'), 600);
    const t2 = setTimeout(() => setPhase('text'), 1100);
    const t3 = setTimeout(() => router.push('/'), redirectDelay);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [router, redirectDelay]);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center">
      {/* Animated circle + check */}
      <div className="relative w-24 h-24 mb-8">
        {/* SVG circle that draws itself */}
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
          <circle
            cx="48"
            cy="48"
            r="44"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-border"
          />
          <circle
            cx="48"
            cy="48"
            r="44"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className="text-primary"
            style={{
              strokeDasharray: `${2 * Math.PI * 44}`,
              strokeDashoffset: phase === 'circle' ? `${2 * Math.PI * 44}` : '0',
              transition: 'stroke-dashoffset 0.6s ease-out',
            }}
          />
        </svg>

        {/* Checkmark */}
        <div
          className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
            phase === 'circle'
              ? 'opacity-0 scale-50'
              : 'opacity-100 scale-100'
          }`}
        >
          <Check size={40} className="text-primary" strokeWidth={2.5} />
        </div>
      </div>

      {/* Text */}
      <div
        className={`text-center transition-all duration-500 ${
          phase === 'text'
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4'
        }`}
      >
        <h2 className="text-2xl font-bold text-foreground">{title}</h2>
        <p className="text-muted mt-2">{subtitle}</p>
      </div>
    </div>
  );
}
