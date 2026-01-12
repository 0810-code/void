/**
 * Game state management with Zustand
 */

import { create } from 'zustand';
import { emptyBoard } from '@/lib/bitboard';
import {
  StateTree,
  createInitialTree,
  getCurrentNode,
  applyPlaceMove,
  applyEditCellMove,
  applySetHandMove,
  undo as treeUndo,
  redo as treeRedo,
  checkout as treeCheckout,
  canUndo as treeCanUndo,
  canRedo as treeCanRedo,
  getUnusedPieceIds,
  getUnusedHandIndices,
  NodeId,
} from '@/lib/state-tree';
import { Solution, findBestSolution, solvePartial } from '@/lib/solver';
import { getLegalPlacementsForPiece } from '@/lib/game-logic';
import { Placement } from '@/lib/pieces';

export interface GameStore {
  // State tree
  stateTree: StateTree;

  // UI state
  selectedPieceIndex: number | null;
  hoverPosition: { x: number; y: number } | null;
  isEditing: boolean;
  isSolving: boolean;

  // Solution
  currentSolution: Solution | null;

  // Derived state getters
  getBoard: () => bigint;
  getHand: () => number[];
  getHandUsed: () => boolean[];
  getLegalPlacements: () => Placement[];

  // Actions
  initializeGame: (board?: bigint, hand?: number[]) => void;
  selectPiece: (index: number | null) => void;
  setHoverPosition: (pos: { x: number; y: number } | null) => void;
  placePiece: (x: number, y: number) => boolean;
  toggleCell: (x: number, y: number) => void;
  setHand: (hand: number[]) => void;
  setHandSlot: (index: number, pieceId: number) => void;
  undo: () => void;
  redo: () => void;
  checkout: (nodeId: NodeId) => void;
  toggleEditMode: () => void;
  solve: () => void;
  applySolutionStep: (stepIndex: number) => void;
  applyFullSolution: () => void;
  clearSolution: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearBoard: () => void;
}

// Default hand with 3 common pieces
const DEFAULT_HAND = [4, 3, 2]; // 1x1, 2x1, 3x1

export const useGameStore = create<GameStore>((set, get) => ({
  // Initial state
  stateTree: createInitialTree(emptyBoard(), DEFAULT_HAND),
  selectedPieceIndex: null,
  hoverPosition: null,
  isEditing: false,
  isSolving: false,
  currentSolution: null,

  // Derived state getters
  getBoard: () => {
    const state = get();
    return getCurrentNode(state.stateTree).board;
  },

  getHand: () => {
    const state = get();
    return getCurrentNode(state.stateTree).hand;
  },

  getHandUsed: () => {
    const state = get();
    return getCurrentNode(state.stateTree).handUsed;
  },

  getLegalPlacements: () => {
    const state = get();
    const { selectedPieceIndex, stateTree } = state;

    if (selectedPieceIndex === null) return [];

    const currentNode = getCurrentNode(stateTree);
    if (currentNode.handUsed[selectedPieceIndex]) return [];

    const pieceId = currentNode.hand[selectedPieceIndex];
    return getLegalPlacementsForPiece(currentNode.board, pieceId);
  },

  // Actions
  initializeGame: (board = emptyBoard(), hand = DEFAULT_HAND) => {
    set({
      stateTree: createInitialTree(board, hand),
      selectedPieceIndex: null,
      hoverPosition: null,
      isEditing: false,
      isSolving: false,
      currentSolution: null,
    });
  },

  selectPiece: (index) => {
    const state = get();
    const currentNode = getCurrentNode(state.stateTree);

    // Don't select if already used
    if (index !== null && currentNode.handUsed[index]) {
      return;
    }

    set({ selectedPieceIndex: index, hoverPosition: null });
  },

  setHoverPosition: (pos) => {
    set({ hoverPosition: pos });
  },

  placePiece: (x, y) => {
    const state = get();
    const { selectedPieceIndex, stateTree } = state;

    if (selectedPieceIndex === null) return false;

    const currentNode = getCurrentNode(stateTree);
    if (currentNode.handUsed[selectedPieceIndex]) return false;

    const pieceId = currentNode.hand[selectedPieceIndex];

    try {
      const newTree = applyPlaceMove(stateTree, pieceId, selectedPieceIndex, x, y);

      set({
        stateTree: newTree,
        selectedPieceIndex: null,
        hoverPosition: null,
        currentSolution: null,
      });

      return true;
    } catch {
      return false;
    }
  },

  toggleCell: (x, y) => {
    const state = get();

    if (!state.isEditing) return;

    try {
      const newTree = applyEditCellMove(state.stateTree, x, y);
      set({
        stateTree: newTree,
        currentSolution: null,
      });
    } catch {
      // Ignore errors
    }
  },

  setHand: (hand) => {
    const state = get();

    try {
      const newTree = applySetHandMove(state.stateTree, hand);
      set({
        stateTree: newTree,
        selectedPieceIndex: null,
        currentSolution: null,
      });
    } catch {
      // Ignore errors
    }
  },

  setHandSlot: (index, pieceId) => {
    const state = get();
    const currentNode = getCurrentNode(state.stateTree);

    const newHand = [...currentNode.hand];
    newHand[index] = pieceId;

    state.setHand(newHand);
  },

  undo: () => {
    const state = get();

    if (!treeCanUndo(state.stateTree)) return;

    const newTree = treeUndo(state.stateTree);
    set({
      stateTree: newTree,
      selectedPieceIndex: null,
      hoverPosition: null,
      currentSolution: null,
    });
  },

  redo: () => {
    const state = get();

    if (!treeCanRedo(state.stateTree)) return;

    const newTree = treeRedo(state.stateTree);
    set({
      stateTree: newTree,
      selectedPieceIndex: null,
      hoverPosition: null,
      currentSolution: null,
    });
  },

  checkout: (nodeId) => {
    const state = get();

    try {
      const newTree = treeCheckout(state.stateTree, nodeId);
      set({
        stateTree: newTree,
        selectedPieceIndex: null,
        hoverPosition: null,
        currentSolution: null,
      });
    } catch {
      // Ignore errors
    }
  },

  toggleEditMode: () => {
    set((state) => ({
      isEditing: !state.isEditing,
      selectedPieceIndex: null,
      hoverPosition: null,
    }));
  },

  solve: () => {
    const state = get();
    const currentNode = getCurrentNode(state.stateTree);

    set({ isSolving: true, currentSolution: null });

    // Use setTimeout to allow UI to update
    setTimeout(() => {
      const unusedPieceIds = getUnusedPieceIds(state.stateTree);
      const unusedIndices = getUnusedHandIndices(state.stateTree);

      let solution: Solution | null = null;

      if (unusedPieceIds.length === 3) {
        // Full solve
        solution = findBestSolution(currentNode.board, unusedPieceIds);
      } else if (unusedPieceIds.length > 0) {
        // Partial solve
        solution = solvePartial(currentNode.board, unusedPieceIds, unusedIndices);
      }

      set({
        isSolving: false,
        currentSolution: solution,
      });
    }, 10);
  },

  applySolutionStep: (stepIndex) => {
    const state = get();
    const { currentSolution, stateTree } = state;

    if (!currentSolution || stepIndex >= currentSolution.steps.length) return;

    const step = currentSolution.steps[stepIndex];

    try {
      const newTree = applyPlaceMove(
        stateTree,
        step.pieceId,
        step.handIndex,
        step.x,
        step.y
      );

      // Update solution to remove applied step
      const remainingSteps = currentSolution.steps.slice(stepIndex + 1);

      set({
        stateTree: newTree,
        currentSolution:
          remainingSteps.length > 0
            ? { ...currentSolution, steps: remainingSteps }
            : null,
        selectedPieceIndex: null,
        hoverPosition: null,
      });
    } catch {
      // Reset solution if step fails
      set({ currentSolution: null });
    }
  },

  applyFullSolution: () => {
    const state = get();
    const { currentSolution } = state;

    if (!currentSolution) return;

    let currentTree = state.stateTree;

    for (const step of currentSolution.steps) {
      try {
        currentTree = applyPlaceMove(
          currentTree,
          step.pieceId,
          step.handIndex,
          step.x,
          step.y
        );
      } catch {
        // Stop on error
        break;
      }
    }

    set({
      stateTree: currentTree,
      currentSolution: null,
      selectedPieceIndex: null,
      hoverPosition: null,
    });
  },

  clearSolution: () => {
    set({ currentSolution: null });
  },

  canUndo: () => {
    const state = get();
    return treeCanUndo(state.stateTree);
  },

  canRedo: () => {
    const state = get();
    return treeCanRedo(state.stateTree);
  },

  clearBoard: () => {
    const state = get();
    const currentNode = getCurrentNode(state.stateTree);

    // Create new tree with empty board but same hand
    set({
      stateTree: createInitialTree(emptyBoard(), currentNode.hand),
      selectedPieceIndex: null,
      hoverPosition: null,
      currentSolution: null,
    });
  },
}));
