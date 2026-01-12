'use client';

import { useState } from 'react';
import { ALL_PIECE_IDS } from '@/lib/pieces';
import { useGameStore } from '@/store/game-store';
import PiecePreview from './PiecePreview';

interface PieceSelectorProps {
  slotIndex: number;
  currentPieceId: number;
  onClose: () => void;
}

export default function PieceSelector({
  slotIndex,
  currentPieceId,
  onClose,
}: PieceSelectorProps) {
  const { setHandSlot } = useGameStore();
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const handleSelect = (pieceId: number) => {
    setHandSlot(slotIndex, pieceId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-slate-800 rounded-lg p-4 max-w-md max-h-[80vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-white">
            Select Piece for Slot {slotIndex + 1}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {ALL_PIECE_IDS.map((pieceId) => (
            <button
              key={pieceId}
              onClick={() => handleSelect(pieceId)}
              onMouseEnter={() => setHoveredId(pieceId)}
              onMouseLeave={() => setHoveredId(null)}
              className={`
                p-2 rounded border-2 flex items-center justify-center
                min-h-[60px] transition-all
                ${
                  pieceId === currentPieceId
                    ? 'border-blue-500 bg-blue-500/20'
                    : pieceId === hoveredId
                    ? 'border-slate-500 bg-slate-700'
                    : 'border-slate-600 bg-slate-800 hover:border-slate-500'
                }
              `}
            >
              <PiecePreview pieceId={pieceId} size="sm" showId />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
