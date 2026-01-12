/**
 * Core game logic for the block puzzle
 *
 * Handles:
 * - Piece placement
 * - Line clearing (rows and columns)
 * - Mobility calculation
 */

import {
  BOARD_SIZE,
  ROW_MASKS,
  COL_MASKS,
  getFilledRows,
  getFilledCols,
  clearLines as clearBitboardLines,
  countBits,
} from './bitboard';
import { PIECES, PRECOMPUTED_PLACEMENTS, Placement } from './pieces';

export interface PlacementResult {
  /** Board state after placement and line clearing */
  newBoard: bigint;
  /** Board state immediately after placement (before clearing) */
  boardBeforeClear: bigint;
  /** Rows that were cleared (0-7) */
  clearedRows: number[];
  /** Columns that were cleared (0-7) */
  clearedCols: number[];
  /** Total cells cleared */
  cellsCleared: number;
}

/**
 * Place a piece on the board and process line clearing
 *
 * @param board Current board state
 * @param pieceMask Bitmask of the piece to place
 * @returns Result including new board and cleared lines
 */
export function placePiece(board: bigint, pieceMask: bigint): PlacementResult {
  // Place the piece
  const boardBeforeClear = board | pieceMask;

  // Find filled rows and columns
  const clearedRows = getFilledRows(boardBeforeClear);
  const clearedCols = getFilledCols(boardBeforeClear);

  // Clear the lines
  const newBoard = clearBitboardLines(boardBeforeClear, clearedRows, clearedCols);

  // Calculate cells cleared (union of rows and cols, not double-counting intersections)
  let cellsCleared = 0;
  if (clearedRows.length > 0 || clearedCols.length > 0) {
    // Each row clears 8 cells, each col clears 8 cells
    // Intersections are counted once (row*col intersections)
    cellsCleared =
      clearedRows.length * BOARD_SIZE +
      clearedCols.length * BOARD_SIZE -
      clearedRows.length * clearedCols.length;
  }

  return {
    newBoard,
    boardBeforeClear,
    clearedRows,
    clearedCols,
    cellsCleared,
  };
}

/**
 * Find all filled lines on the board
 */
export function findFilledLines(board: bigint): { rows: number[]; cols: number[] } {
  return {
    rows: getFilledRows(board),
    cols: getFilledCols(board),
  };
}

/**
 * Calculate the mobility score for a board state
 *
 * Mobility = total number of legal placements across all 41 pieces
 * Higher mobility means more flexibility for future moves
 */
export function computeMobility(board: bigint): number {
  let total = 0;

  for (const [pieceId, placements] of PRECOMPUTED_PLACEMENTS) {
    for (const p of placements) {
      // Check if placement is legal (no overlap)
      if ((board & p.mask) === 0n) {
        total++;
      }
    }
  }

  return total;
}

/**
 * Count legal placements for a specific piece
 */
export function countLegalPlacements(board: bigint, pieceId: number): number {
  const placements = PRECOMPUTED_PLACEMENTS.get(pieceId);
  if (!placements) return 0;

  let count = 0;
  for (const p of placements) {
    if ((board & p.mask) === 0n) {
      count++;
    }
  }
  return count;
}

/**
 * Get all legal placements for a piece on current board
 */
export function getLegalPlacementsForPiece(
  board: bigint,
  pieceId: number
): Placement[] {
  const precomputed = PRECOMPUTED_PLACEMENTS.get(pieceId);
  if (!precomputed) return [];

  return precomputed.filter((p) => (board & p.mask) === 0n);
}

/**
 * Check if any piece from the hand can be placed
 */
export function canPlaceAnyPiece(board: bigint, hand: number[]): boolean {
  for (const pieceId of hand) {
    const placements = PRECOMPUTED_PLACEMENTS.get(pieceId);
    if (!placements) continue;

    for (const p of placements) {
      if ((board & p.mask) === 0n) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Check if all pieces in hand can be placed (individually, not considering order)
 */
export function canPlaceAllPieces(board: bigint, hand: number[]): boolean {
  for (const pieceId of hand) {
    let canPlace = false;
    const placements = PRECOMPUTED_PLACEMENTS.get(pieceId);
    if (!placements) return false;

    for (const p of placements) {
      if ((board & p.mask) === 0n) {
        canPlace = true;
        break;
      }
    }

    if (!canPlace) return false;
  }
  return true;
}

/**
 * Evaluate board state for solver (higher is better)
 *
 * Primary: Mobility (more placement options)
 * Secondary: Fewer occupied cells
 */
export function evaluateBoard(board: bigint): number {
  const mobility = computeMobility(board);
  const occupied = countBits(board);

  // Mobility is primary factor, occupied cells as tiebreaker
  // Scale mobility by 100 to make it dominant
  return mobility * 100 - occupied;
}

/**
 * Get potential score for clearing lines
 * Used for heuristic evaluation
 */
export function getLineClearPotential(board: bigint): {
  nearlyFullRows: number;
  nearlyFullCols: number;
} {
  let nearlyFullRows = 0;
  let nearlyFullCols = 0;

  for (let y = 0; y < BOARD_SIZE; y++) {
    const rowBits = countBits(board & ROW_MASKS[y]);
    if (rowBits >= 6) nearlyFullRows++;
  }

  for (let x = 0; x < BOARD_SIZE; x++) {
    const colBits = countBits(board & COL_MASKS[x]);
    if (colBits >= 6) nearlyFullCols++;
  }

  return { nearlyFullRows, nearlyFullCols };
}

/**
 * Simulate placing a piece and return the result without modifying original board
 */
export function simulatePlacement(
  board: bigint,
  pieceId: number,
  x: number,
  y: number
): PlacementResult | null {
  const piece = PIECES.get(pieceId);
  if (!piece) return null;

  // Check bounds
  if (x < 0 || y < 0 || x + piece.w > BOARD_SIZE || y + piece.h > BOARD_SIZE) {
    return null;
  }

  // Calculate mask
  let mask = 0n;
  for (const [dx, dy] of piece.cells) {
    const cellX = x + dx;
    const cellY = y + dy;
    const idx = cellY * BOARD_SIZE + cellX;
    mask |= 1n << BigInt(idx);
  }

  // Check overlap
  if ((board & mask) !== 0n) {
    return null;
  }

  return placePiece(board, mask);
}
