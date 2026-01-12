/**
 * Piece definitions and utilities for the block puzzle
 *
 * 41 fixed-orientation pieces (no rotation allowed)
 */

import { BOARD_SIZE, setBit, isInBounds } from './bitboard';
import piecesData from '../../public/data/pieces.json';

export interface PieceCell {
  dx: number;
  dy: number;
}

export interface Piece {
  id: number;
  w: number;  // width (bounding box)
  h: number;  // height (bounding box)
  cells: [number, number][];  // [dx, dy] relative to top-left
  hash: string;  // canonical hash for matching
}

export interface Placement {
  x: number;
  y: number;
  mask: bigint;
}

// Load pieces from JSON
const rawPieces = piecesData as Array<{
  id: number;
  w: number;
  h: number;
  cells: [number, number][];
  hash: string;
}>;

// Map from piece ID to piece definition
export const PIECES: Map<number, Piece> = new Map();
for (const p of rawPieces) {
  PIECES.set(p.id, p);
}

// Map from canonical hash to piece ID (for screenshot recognition)
export const PIECE_BY_HASH: Map<string, number> = new Map();
for (const p of rawPieces) {
  PIECE_BY_HASH.set(p.hash, p.id);
}

// All piece IDs (1-41)
export const ALL_PIECE_IDS: number[] = rawPieces.map((p) => p.id);

/**
 * Get piece by ID
 */
export function getPiece(id: number): Piece | undefined {
  return PIECES.get(id);
}

/**
 * Compute canonical hash from cell coordinates
 * Used for matching extracted pieces from screenshots
 */
export function computeCanonicalHash(cells: [number, number][]): string {
  // Normalize: shift so min x and min y are 0
  if (cells.length === 0) return '';

  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));

  const normalized = cells.map(([x, y]) => [x - minX, y - minY] as [number, number]);

  // Sort by x then y
  normalized.sort((a, b) => {
    if (a[0] !== b[0]) return a[0] - b[0];
    return a[1] - b[1];
  });

  // Create hash string
  return normalized.map(([x, y]) => `${x},${y}`).join(';');
}

/**
 * Create a bitmask for a piece placed at position (px, py)
 * Returns 0n if placement would be out of bounds
 */
export function pieceMaskAt(piece: Piece, px: number, py: number): bigint {
  // Check bounds first
  if (px < 0 || py < 0 || px + piece.w > BOARD_SIZE || py + piece.h > BOARD_SIZE) {
    return 0n;
  }

  let mask = 0n;
  for (const [dx, dy] of piece.cells) {
    const x = px + dx;
    const y = py + dy;
    if (!isInBounds(x, y)) {
      return 0n; // Should not happen if bounds check passed
    }
    mask = setBit(mask, x, y);
  }
  return mask;
}

/**
 * Check if a piece can be placed at position (px, py) on the board
 */
export function canPlace(board: bigint, piece: Piece, px: number, py: number): boolean {
  // Check bounds
  if (px < 0 || py < 0 || px + piece.w > BOARD_SIZE || py + piece.h > BOARD_SIZE) {
    return false;
  }

  const mask = pieceMaskAt(piece, px, py);
  if (mask === 0n) return false;

  // Check overlap
  return (board & mask) === 0n;
}

/**
 * Get all legal placements for a piece on the current board
 */
export function getLegalPlacements(board: bigint, pieceId: number): Placement[] {
  const piece = PIECES.get(pieceId);
  if (!piece) return [];

  const placements: Placement[] = [];

  for (let py = 0; py <= BOARD_SIZE - piece.h; py++) {
    for (let px = 0; px <= BOARD_SIZE - piece.w; px++) {
      if (canPlace(board, piece, px, py)) {
        const mask = pieceMaskAt(piece, px, py);
        placements.push({ x: px, y: py, mask });
      }
    }
  }

  return placements;
}

/**
 * Check if a piece has any legal placement on the board
 */
export function hasLegalPlacement(board: bigint, pieceId: number): boolean {
  const piece = PIECES.get(pieceId);
  if (!piece) return false;

  for (let py = 0; py <= BOARD_SIZE - piece.h; py++) {
    for (let px = 0; px <= BOARD_SIZE - piece.w; px++) {
      if (canPlace(board, piece, px, py)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Pre-compute all placements for all pieces (for solver optimization)
 * This is called once at startup
 */
export function precomputeAllPlacements(): Map<number, Placement[]> {
  const result: Map<number, Placement[]> = new Map();

  for (const piece of PIECES.values()) {
    const placements: Placement[] = [];
    for (let py = 0; py <= BOARD_SIZE - piece.h; py++) {
      for (let px = 0; px <= BOARD_SIZE - piece.w; px++) {
        const mask = pieceMaskAt(piece, px, py);
        if (mask !== 0n) {
          placements.push({ x: px, y: py, mask });
        }
      }
    }
    result.set(piece.id, placements);
  }

  return result;
}

// Pre-computed placements for all pieces (used by solver)
export const PRECOMPUTED_PLACEMENTS = precomputeAllPlacements();

/**
 * Get the cells that a piece would occupy at position (px, py)
 */
export function getPieceCells(piece: Piece, px: number, py: number): [number, number][] {
  return piece.cells.map(([dx, dy]) => [px + dx, py + dy] as [number, number]);
}

/**
 * Match extracted cells to a known piece ID
 * Returns piece ID or undefined if no match
 */
export function matchPieceByHash(hash: string): number | undefined {
  return PIECE_BY_HASH.get(hash);
}

/**
 * Match extracted cells to a known piece ID
 */
export function matchPieceByCells(cells: [number, number][]): number | undefined {
  const hash = computeCanonicalHash(cells);
  return PIECE_BY_HASH.get(hash);
}

/**
 * Get piece colors for UI (cycle through a palette)
 */
const PIECE_COLORS = [
  '#FF6B6B', // red
  '#4ECDC4', // teal
  '#45B7D1', // blue
  '#96CEB4', // green
  '#FFEAA7', // yellow
  '#DDA0DD', // plum
  '#98D8C8', // mint
  '#F7DC6F', // gold
  '#BB8FCE', // purple
  '#85C1E9', // light blue
];

export function getPieceColor(pieceId: number): string {
  return PIECE_COLORS[(pieceId - 1) % PIECE_COLORS.length];
}
