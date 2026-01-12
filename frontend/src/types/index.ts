/**
 * Type definitions for the block puzzle solver
 */

export type { Piece, PieceCell, Placement } from '@/lib/pieces';
export type { PlacementResult } from '@/lib/game-logic';
export type { Solution, SolutionStep, SolverStats } from '@/lib/solver';
export type {
  NodeId,
  Move,
  PlaceMove,
  EditCellMove,
  SetHandMove,
  GameNode,
  StateTree,
} from '@/lib/state-tree';

// UI specific types
export interface Position {
  x: number;
  y: number;
}

export interface CellState {
  occupied: boolean;
  isPreview: boolean;
  isHighlighted: boolean;
  isClearing: boolean;
  pieceColor?: string;
}

export interface HandPieceState {
  pieceId: number;
  isUsed: boolean;
  isSelected: boolean;
}

// API types for screenshot parsing
export interface ParseScreenshotResponse {
  board: number[][];
  pieceIds: number[];
  meta: {
    confidence: number;
    needsUserFix: boolean;
    attemptId: number;
    boardRoi?: { x: number; y: number; w: number; h: number };
    pieceRois?: Array<{ x: number; y: number; w: number; h: number }>;
  };
  debug?: {
    boardWarpPngBase64?: string;
    boardOverlayPngBase64?: string;
    pieceOverlays?: string[];
  };
}

export interface ApiError {
  error: string;
  needsUserFix?: boolean;
}
