/**
 * 64-bit Bitboard for 8x8 board representation
 *
 * Board layout:
 *   x: 0 1 2 3 4 5 6 7
 * y:
 * 0:  0 1 2 3 4 5 6 7
 * 1:  8 9 ...
 * ...
 * 7: 56 57 ... 63
 *
 * idx = y * 8 + x (0..63)
 */

export const BOARD_SIZE = 8;
export const TOTAL_CELLS = 64;

// Pre-computed row masks (each row has 8 consecutive bits)
export const ROW_MASKS: bigint[] = [];
for (let y = 0; y < BOARD_SIZE; y++) {
  let mask = 0n;
  for (let x = 0; x < BOARD_SIZE; x++) {
    const idx = y * BOARD_SIZE + x;
    mask |= 1n << BigInt(idx);
  }
  ROW_MASKS.push(mask);
}

// Pre-computed column masks (each column has 8 bits, spaced 8 apart)
export const COL_MASKS: bigint[] = [];
for (let x = 0; x < BOARD_SIZE; x++) {
  let mask = 0n;
  for (let y = 0; y < BOARD_SIZE; y++) {
    const idx = y * BOARD_SIZE + x;
    mask |= 1n << BigInt(idx);
  }
  COL_MASKS.push(mask);
}

/**
 * Convert (x, y) coordinates to bit index
 */
export function coordToIndex(x: number, y: number): number {
  return y * BOARD_SIZE + x;
}

/**
 * Convert bit index to (x, y) coordinates
 */
export function indexToCoord(idx: number): [number, number] {
  const x = idx % BOARD_SIZE;
  const y = Math.floor(idx / BOARD_SIZE);
  return [x, y];
}

/**
 * Check if coordinate is within board bounds
 */
export function isInBounds(x: number, y: number): boolean {
  return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
}

/**
 * Get the bit value at (x, y)
 */
export function getBit(board: bigint, x: number, y: number): boolean {
  const idx = coordToIndex(x, y);
  return (board & (1n << BigInt(idx))) !== 0n;
}

/**
 * Set the bit at (x, y) to 1
 */
export function setBit(board: bigint, x: number, y: number): bigint {
  const idx = coordToIndex(x, y);
  return board | (1n << BigInt(idx));
}

/**
 * Clear the bit at (x, y) to 0
 */
export function clearBit(board: bigint, x: number, y: number): bigint {
  const idx = coordToIndex(x, y);
  return board & ~(1n << BigInt(idx));
}

/**
 * Toggle the bit at (x, y)
 */
export function toggleBit(board: bigint, x: number, y: number): bigint {
  const idx = coordToIndex(x, y);
  return board ^ (1n << BigInt(idx));
}

/**
 * Count the number of set bits (popcount)
 */
export function countBits(board: bigint): number {
  let count = 0;
  let b = board;
  while (b !== 0n) {
    count += Number(b & 1n);
    b >>= 1n;
  }
  return count;
}

/**
 * Convert bigint board to 8x8 number array
 * board[y][x] = 0 or 1
 */
export function boardToArray(board: bigint): number[][] {
  const result: number[][] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    const row: number[] = [];
    for (let x = 0; x < BOARD_SIZE; x++) {
      row.push(getBit(board, x, y) ? 1 : 0);
    }
    result.push(row);
  }
  return result;
}

/**
 * Convert 8x8 number array to bigint board
 */
export function arrayToBoard(arr: number[][]): bigint {
  let board = 0n;
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (arr[y]?.[x]) {
        board = setBit(board, x, y);
      }
    }
  }
  return board;
}

/**
 * Create an empty board
 */
export function emptyBoard(): bigint {
  return 0n;
}

/**
 * Create a full board (all cells occupied)
 */
export function fullBoard(): bigint {
  return (1n << 64n) - 1n;
}

/**
 * Check if row y is completely filled
 */
export function isRowFilled(board: bigint, y: number): boolean {
  return (board & ROW_MASKS[y]) === ROW_MASKS[y];
}

/**
 * Check if column x is completely filled
 */
export function isColFilled(board: bigint, x: number): boolean {
  return (board & COL_MASKS[x]) === COL_MASKS[x];
}

/**
 * Get all filled rows
 */
export function getFilledRows(board: bigint): number[] {
  const filled: number[] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    if (isRowFilled(board, y)) {
      filled.push(y);
    }
  }
  return filled;
}

/**
 * Get all filled columns
 */
export function getFilledCols(board: bigint): number[] {
  const filled: number[] = [];
  for (let x = 0; x < BOARD_SIZE; x++) {
    if (isColFilled(board, x)) {
      filled.push(x);
    }
  }
  return filled;
}

/**
 * Clear specified rows and columns from board
 */
export function clearLines(board: bigint, rows: number[], cols: number[]): bigint {
  let clearMask = 0n;
  for (const y of rows) {
    clearMask |= ROW_MASKS[y];
  }
  for (const x of cols) {
    clearMask |= COL_MASKS[x];
  }
  return board & ~clearMask;
}

/**
 * Create a mask from array of cell coordinates
 */
export function cellsToMask(cells: [number, number][]): bigint {
  let mask = 0n;
  for (const [x, y] of cells) {
    mask = setBit(mask, x, y);
  }
  return mask;
}

/**
 * Convert board to visual string for debugging
 */
export function boardToString(board: bigint): string {
  const lines: string[] = [];
  lines.push('  01234567');
  for (let y = 0; y < BOARD_SIZE; y++) {
    let line = `${y} `;
    for (let x = 0; x < BOARD_SIZE; x++) {
      line += getBit(board, x, y) ? '#' : '.';
    }
    lines.push(line);
  }
  return lines.join('\n');
}
