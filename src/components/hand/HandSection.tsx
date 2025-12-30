'use client';

import { useGameStore } from '@/store/game-store';
import { getCurrentNode } from '@/lib/state-tree';
import PieceCard from './PieceCard';

export default function HandSection() {
  const {
    stateTree,
    selectedPieceIndex,
    isEditing,
    selectPiece,
  } = useGameStore();

  const currentNode = getCurrentNode(stateTree);
  const { hand, handUsed } = currentNode;

  const handleSelect = (index: number) => {
    if (isEditing) return;

    // Toggle selection
    if (selectedPieceIndex === index) {
      selectPiece(null);
    } else {
      selectPiece(index);
    }
  };

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium text-slate-400">Hand</h2>
      <div className="flex gap-2">
        {hand.map((pieceId, index) => (
          <PieceCard
            key={index}
            pieceId={pieceId}
            index={index}
            isUsed={handUsed[index]}
            isSelected={selectedPieceIndex === index}
            onSelect={() => handleSelect(index)}
          />
        ))}
      </div>
      {selectedPieceIndex !== null && (
        <p className="text-xs text-slate-500">
          Click on the board to place the selected piece
        </p>
      )}
    </div>
  );
}
