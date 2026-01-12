'use client';

import React, { useMemo, useCallback } from 'react';
import Cell from './Cell';
import { useGameStore } from '@/store/game-store';
import { getBit, BOARD_SIZE } from '@/lib/bitboard';
import { PIECES, pieceMaskAt } from '@/lib/pieces';
import { getCurrentNode } from '@/lib/state-tree';

export default function BoardGrid() {
  const {
    stateTree,
    selectedPieceIndex,
    hoverPosition,
    isEditing,
    setHoverPosition,
    placePiece,
    toggleCell,
    getLegalPlacements,
  } = useGameStore();

  const currentNode = getCurrentNode(stateTree);
  const board = currentNode.board;
  const legalPlacements = getLegalPlacements();

  // Get the preview mask if a piece is selected and hovering
  const previewMask = useMemo(() => {
    if (selectedPieceIndex === null || hoverPosition === null) return null;
    if (currentNode.handUsed[selectedPieceIndex]) return null;

    const pieceId = currentNode.hand[selectedPieceIndex];
    const piece = PIECES.get(pieceId);
    if (!piece) return null;

    // Check if position is valid
    const { x, y } = hoverPosition;
    if (x < 0 || y < 0 || x + piece.w > BOARD_SIZE || y + piece.h > BOARD_SIZE) {
      return null;
    }

    return pieceMaskAt(piece, x, y);
  }, [selectedPieceIndex, hoverPosition, currentNode]);

  // Check if preview position has overlap
  const previewHasOverlap = useMemo(() => {
    if (!previewMask) return false;
    return (board & previewMask) !== 0n;
  }, [board, previewMask]);

  // Create set of highlighted cells (legal placement positions)
  const highlightedCells = useMemo(() => {
    const set = new Set<string>();
    for (const p of legalPlacements) {
      // Highlight the top-left corner of each legal placement
      set.add(`${p.x},${p.y}`);
    }
    return set;
  }, [legalPlacements]);

  // Handle cell click
  const handleCellClick = useCallback(
    (x: number, y: number) => {
      if (isEditing) {
        toggleCell(x, y);
        return;
      }

      if (selectedPieceIndex !== null && hoverPosition) {
        // Try to place piece at hover position (top-left of piece)
        placePiece(hoverPosition.x, hoverPosition.y);
      }
    },
    [isEditing, selectedPieceIndex, hoverPosition, toggleCell, placePiece]
  );

  // Handle mouse enter for preview
  const handleMouseEnter = useCallback(
    (x: number, y: number) => {
      if (selectedPieceIndex === null) return;
      setHoverPosition({ x, y });
    },
    [selectedPieceIndex, setHoverPosition]
  );

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    setHoverPosition(null);
  }, [setHoverPosition]);

  // Render cells
  const cells = useMemo(() => {
    const result: React.ReactElement[] = [];

    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        const occupied = getBit(board, x, y);
        const isPreview = previewMask ? getBit(previewMask, x, y) : false;
        const isHighlighted = highlightedCells.has(`${x},${y}`);

        result.push(
          <Cell
            key={`${x}-${y}`}
            x={x}
            y={y}
            occupied={occupied}
            isPreview={isPreview && !previewHasOverlap}
            isHighlighted={isHighlighted}
            isClearing={false}
            onClick={() => handleCellClick(x, y)}
            onMouseEnter={() => handleMouseEnter(x, y)}
            onMouseLeave={handleMouseLeave}
          />
        );
      }
    }

    return result;
  }, [
    board,
    previewMask,
    previewHasOverlap,
    highlightedCells,
    handleCellClick,
    handleMouseEnter,
    handleMouseLeave,
  ]);

  return (
    <div className="relative">
      {/* Board grid */}
      <div
        className="grid gap-0.5 p-2 bg-slate-900 rounded-lg"
        style={{
          gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
        }}
      >
        {cells}
      </div>

      {/* Row/Column indicators */}
      <div className="absolute -left-4 top-2 bottom-0 flex flex-col justify-around text-xs text-slate-500">
        {Array.from({ length: BOARD_SIZE }, (_, i) => (
          <div key={i} className="flex items-center justify-center h-full">
            {i}
          </div>
        ))}
      </div>
      <div className="absolute top-0 -top-4 left-2 right-0 flex justify-around text-xs text-slate-500">
        {Array.from({ length: BOARD_SIZE }, (_, i) => (
          <div key={i} className="flex items-center justify-center w-full">
            {i}
          </div>
        ))}
      </div>

      {/* Invalid placement overlay */}
      {previewMask && previewHasOverlap && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="bg-red-500/20 rounded-lg px-2 py-1 text-red-300 text-sm">
            Cannot place here
          </div>
        </div>
      )}
    </div>
  );
}
