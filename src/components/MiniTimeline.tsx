'use client';

import { timeToMinutes, formatTime } from '@/lib/time-utils';

interface Block {
  id: string;
  start_time: string;
  end_time: string;
  label: string;
  is_non_negotiable: number;
}

interface MiniTimelineProps {
  blocks: Block[];
  currentTime: string; // "HH:MM" format
}

const DAY_START = 5 * 60;  // 5am
const DAY_END = 22 * 60;   // 10pm
const TOTAL_MINUTES = DAY_END - DAY_START;

export default function MiniTimeline({ blocks, currentTime }: MiniTimelineProps) {
  const nowMinutes = timeToMinutes(currentTime);
  const nowPercent = Math.max(0, Math.min(100, ((nowMinutes - DAY_START) / TOTAL_MINUTES) * 100));

  // Hour markers
  const hours = [];
  for (let h = 6; h <= 21; h += 3) {
    const pct = ((h * 60 - DAY_START) / TOTAL_MINUTES) * 100;
    hours.push({ hour: h, pct });
  }

  return (
    <div>
      <div className="relative h-8 bg-background rounded-lg overflow-hidden">
        {/* Hour grid lines */}
        {hours.map(({ hour, pct }) => (
          <div
            key={hour}
            className="absolute top-0 bottom-0 border-l border-border/50"
            style={{ left: `${pct}%` }}
          />
        ))}

        {/* Blocks */}
        {blocks.map(block => {
          const start = timeToMinutes(block.start_time);
          const end = timeToMinutes(block.end_time);
          const left = Math.max(0, ((start - DAY_START) / TOTAL_MINUTES) * 100);
          const width = Math.max(1, ((end - start) / TOTAL_MINUTES) * 100);

          return (
            <div
              key={block.id}
              className={`absolute top-1 bottom-1 rounded ${
                block.is_non_negotiable ? 'bg-primary/80' : 'bg-primary/40'
              }`}
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`${block.label} (${formatTime(block.start_time)} - ${formatTime(block.end_time)})`}
            />
          );
        })}

        {/* Current time indicator */}
        {nowMinutes >= DAY_START && nowMinutes <= DAY_END && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-danger z-10"
            style={{ left: `${nowPercent}%` }}
          >
            <div className="absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full bg-danger" />
          </div>
        )}
      </div>

      {/* Hour labels */}
      <div className="relative h-4 mt-1">
        {hours.map(({ hour, pct }) => (
          <span
            key={hour}
            className="absolute text-[10px] text-muted -translate-x-1/2"
            style={{ left: `${pct}%` }}
          >
            {hour > 12 ? hour - 12 : hour}{hour >= 12 ? 'p' : 'a'}
          </span>
        ))}
      </div>
    </div>
  );
}
