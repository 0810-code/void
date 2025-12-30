'use client';

import { memo } from 'react';

export interface CellProps {
  x: number;
  y: number;
  occupied: boolean;
  isPreview: boolean;
  isHighlighted: boolean;
  isClearing: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function Cell({
  occupied,
  isPreview,
  isHighlighted,
  isClearing,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: CellProps) {
  // Determine cell color based on state
  let bgColor = 'bg-slate-800'; // empty
  let borderColor = 'border-slate-700';

  if (occupied) {
    bgColor = 'bg-blue-500';
    borderColor = 'border-blue-400';
  }

  if (isPreview) {
    bgColor = occupied ? 'bg-red-500' : 'bg-green-400';
    borderColor = occupied ? 'border-red-400' : 'border-green-300';
  }

  if (isHighlighted && !isPreview) {
    bgColor = 'bg-slate-700';
    borderColor = 'border-slate-500';
  }

  if (isClearing) {
    bgColor = 'bg-yellow-400';
    borderColor = 'border-yellow-300';
  }

  return (
    <div
      className={`
        aspect-square w-full
        ${bgColor} ${borderColor}
        border rounded-sm
        cursor-pointer
        transition-colors duration-100
        hover:opacity-90
        active:opacity-80
      `}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick();
        }
      }}
    />
  );
}

export default memo(Cell);
