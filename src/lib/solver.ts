/**
 * DFS Solver for 3-piece puzzle
 *
 * Finds solutions that place all 3 pieces from the hand
 * Optionally finds the best solution (highest mobility after placement)
 */

import { placePiece, computeMobility } from './game-logic';
import { PRECOMPUTED_PLACEMENTS, Placement } from './pieces';

export interface SolutionStep {
  pieceId: number;
  handIndex: number;
  x: number;
  y: number;
  clearedRows: number[];
  clearedCols: number[];
  boardAfter: bigint;
}

export interface Solution {
  steps: SolutionStep[];
  finalBoard: bigint;
  mobility: number;
  order: number[]; // Order of pieceIds
}

/**
 * Generate all permutations of an array
 */
function* permutations<T>(arr: T[]): Generator<T[]> {
  if (arr.length <= 1) {
    yield arr;
    return;
  }

  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) {
      yield [arr[i], ...perm];
    }
  }
}

/**
 * Get legal placements for a piece on current board
 */
function getLegalPlacements(board: bigint, pieceId: number): Placement[] {
  const precomputed = PRECOMPUTED_PLACEMENTS.get(pieceId);
  if (!precomputed) return [];

  return precomputed.filter((p) => (board & p.mask) === 0n);
}

/**
 * DFS to find a solution for a given piece order
 */
function dfs(
  board: bigint,
  order: number[],
  handIndices: number[],
  depth: number,
  path: SolutionStep[],
  earlyExit: boolean
): SolutionStep[] | null {
  if (depth === order.length) {
    return path;
  }

  const pieceId = order[depth];
  const handIndex = handIndices[depth];
  const placements = getLegalPlacements(board, pieceId);

  for (const p of placements) {
    const result = placePiece(board, p.mask);

    const step: SolutionStep = {
      pieceId,
      handIndex,
      x: p.x,
      y: p.y,
      clearedRows: result.clearedRows,
      clearedCols: result.clearedCols,
      boardAfter: result.newBoard,
    };

    const res = dfs(
      result.newBoard,
      order,
      handIndices,
      depth + 1,
      [...path, step],
      earlyExit
    );

    if (res !== null) {
      return res;
    }
  }

  return null;
}

/**
 * Find first solution for 3 pieces
 *
 * @param board Current board state
 * @param hand Array of 3 piece IDs
 * @returns Solution or null if no solution exists
 */
export function solveTriple(board: bigint, hand: number[]): Solution | null {
  if (hand.length !== 3) {
    throw new Error('Hand must contain exactly 3 pieces');
  }

  // Try all 6 permutations
  for (const order of permutations([0, 1, 2])) {
    const pieceOrder = order.map((i) => hand[i]);
    const steps = dfs(board, pieceOrder, order, 0, [], true);

    if (steps !== null) {
      const finalBoard = steps[steps.length - 1].boardAfter;
      return {
        steps,
        finalBoard,
        mobility: computeMobility(finalBoard),
        order: pieceOrder,
      };
    }
  }

  return null;
}

/**
 * Find all solutions (up to maxSolutions)
 */
export function findAllSolutions(
  board: bigint,
  hand: number[],
  maxSolutions: number = 200
): Solution[] {
  if (hand.length !== 3) {
    throw new Error('Hand must contain exactly 3 pieces');
  }

  const solutions: Solution[] = [];

  function dfsAll(
    currentBoard: bigint,
    order: number[],
    handIndices: number[],
    depth: number,
    path: SolutionStep[]
  ): void {
    if (solutions.length >= maxSolutions) {
      return;
    }

    if (depth === order.length) {
      const finalBoard = path[path.length - 1].boardAfter;
      solutions.push({
        steps: [...path],
        finalBoard,
        mobility: computeMobility(finalBoard),
        order: order.map((i) => hand[handIndices[i]]),
      });
      return;
    }

    const pieceId = order[depth];
    const handIndex = handIndices[depth];
    const placements = getLegalPlacements(currentBoard, pieceId);

    for (const p of placements) {
      if (solutions.length >= maxSolutions) {
        return;
      }

      const result = placePiece(currentBoard, p.mask);

      const step: SolutionStep = {
        pieceId,
        handIndex,
        x: p.x,
        y: p.y,
        clearedRows: result.clearedRows,
        clearedCols: result.clearedCols,
        boardAfter: result.newBoard,
      };

      dfsAll(result.newBoard, order, handIndices, depth + 1, [...path, step]);
    }
  }

  // Try all 6 permutations
  for (const orderIndices of permutations([0, 1, 2])) {
    if (solutions.length >= maxSolutions) {
      break;
    }
    const pieceOrder = orderIndices.map((i) => hand[i]);
    dfsAll(board, pieceOrder, orderIndices, 0, []);
  }

  return solutions;
}

/**
 * Find the best solution (highest mobility)
 *
 * @param board Current board state
 * @param hand Array of 3 piece IDs
 * @param maxSolutions Maximum solutions to evaluate
 * @returns Best solution or null
 */
export function findBestSolution(
  board: bigint,
  hand: number[],
  maxSolutions: number = 200
): Solution | null {
  const solutions = findAllSolutions(board, hand, maxSolutions);

  if (solutions.length === 0) {
    return null;
  }

  // Sort by mobility (descending)
  solutions.sort((a, b) => b.mobility - a.mobility);

  return solutions[0];
}

/**
 * Check if a solution exists (faster than finding the actual solution)
 */
export function hasSolution(board: bigint, hand: number[]): boolean {
  return solveTriple(board, hand) !== null;
}

/**
 * Solve for partial hand (1-3 pieces)
 * Useful when some pieces are already placed
 */
export function solvePartial(
  board: bigint,
  remainingPieces: number[],
  handIndices: number[]
): Solution | null {
  if (remainingPieces.length === 0) {
    return {
      steps: [],
      finalBoard: board,
      mobility: computeMobility(board),
      order: [],
    };
  }

  // Generate indices for permutations
  const indices = Array.from({ length: remainingPieces.length }, (_, i) => i);

  for (const order of permutations(indices)) {
    const pieceOrder = order.map((i) => remainingPieces[i]);
    const mappedIndices = order.map((i) => handIndices[i]);
    const steps = dfs(board, pieceOrder, mappedIndices, 0, [], true);

    if (steps !== null) {
      const finalBoard =
        steps.length > 0 ? steps[steps.length - 1].boardAfter : board;
      return {
        steps,
        finalBoard,
        mobility: computeMobility(finalBoard),
        order: pieceOrder,
      };
    }
  }

  return null;
}

/**
 * Get solver statistics for debugging
 */
export interface SolverStats {
  totalSolutions: number;
  bestMobility: number;
  worstMobility: number;
  avgMobility: number;
}

export function getSolverStats(
  board: bigint,
  hand: number[],
  maxSolutions: number = 500
): SolverStats | null {
  const solutions = findAllSolutions(board, hand, maxSolutions);

  if (solutions.length === 0) {
    return null;
  }

  const mobilities = solutions.map((s) => s.mobility);
  const sum = mobilities.reduce((a, b) => a + b, 0);

  return {
    totalSolutions: solutions.length,
    bestMobility: Math.max(...mobilities),
    worstMobility: Math.min(...mobilities),
    avgMobility: sum / solutions.length,
  };
}
