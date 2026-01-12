'use client';

import { memo } from 'react';
import PiecePreview from './PiecePreview';

interface PieceCardProps {
  pieceId: number;
  index: number;
  isUsed: boolean;
  isSelected: boolean;
  onSelect: () => void;
}

function PieceCard({
  pieceId,
  index,
  isUsed,
  isSelected,
  onSelect,
}: PieceCardProps) {
  return (
    <button
      onClick={onSelect}
      disabled={isUsed}
      className={`
        relative p-3 rounded-lg border-2
        min-w-[80px] min-h-[80px]
        flex items-center justify-center
        transition-all duration-150
        ${
          isUsed
            ? 'bg-slate-800 border-slate-700 opacity-40 cursor-not-allowed'
            : isSelected
            ? 'bg-slate-700 border-blue-500 ring-2 ring-blue-500/50'
            : 'bg-slate-800 border-slate-600 hover:border-slate-500 hover:bg-slate-750'
        }
      `}
    >
      {/* Index badge */}
      <div className="absolute top-1 left-1 text-xs text-slate-500 font-mono">
        {index + 1}
      </div>

      {/* Used indicator */}
      {isUsed && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-slate-500 text-sm font-medium">Used</div>
        </div>
      )}

      {/* Piece preview */}
      {!isUsed && <PiecePreview pieceId={pieceId} size="md" />}

      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2">
          <div className="w-2 h-2 bg-blue-500 rounded-full" />
        </div>
      )}
    </button>
  );
}

export default memo(PieceCard);
