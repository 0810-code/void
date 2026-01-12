'use client';

import { memo, useMemo } from 'react';
import { PIECES, getPieceColor } from '@/lib/pieces';

interface PiecePreviewProps {
  pieceId: number;
  size?: 'sm' | 'md' | 'lg';
  showId?: boolean;
}

function PiecePreview({ pieceId, size = 'md', showId = false }: PiecePreviewProps) {
  const piece = PIECES.get(pieceId);
  const color = getPieceColor(pieceId);

  const cellSize = useMemo(() => {
    switch (size) {
      case 'sm':
        return 8;
      case 'md':
        return 12;
      case 'lg':
        return 16;
    }
  }, [size]);

  if (!piece) {
    return (
      <div className="flex items-center justify-center text-slate-500 text-xs">
        ?
      </div>
    );
  }

  const width = piece.w * cellSize + (piece.w - 1) * 2;
  const height = piece.h * cellSize + (piece.h - 1) * 2;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block"
      >
        {piece.cells.map(([dx, dy], i) => (
          <rect
            key={i}
            x={dx * (cellSize + 2)}
            y={dy * (cellSize + 2)}
            width={cellSize}
            height={cellSize}
            fill={color}
            rx={2}
            ry={2}
          />
        ))}
      </svg>
      {showId && (
        <span className="text-xs text-slate-400">#{pieceId}</span>
      )}
    </div>
  );
}

export default memo(PiecePreview);
