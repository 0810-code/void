/**
 * State Tree for game state management
 *
 * Git-like branching model for undo/redo and exploring different moves
 */

import { placePiece } from './game-logic';
import { pieceMaskAt, PIECES } from './pieces';
import { toggleBit } from './bitboard';

export type NodeId = string;

export interface PlaceMove {
  type: 'PLACE';
  pieceId: number;
  handIndex: number;
  x: number;
  y: number;
  clearedRows: number[];
  clearedCols: number[];
}

export interface EditCellMove {
  type: 'EDIT_CELL';
  x: number;
  y: number;
  wasOccupied: boolean;
}

export interface SetHandMove {
  type: 'SET_HAND';
  previousHand: number[];
  newHand: number[];
}

export type Move = PlaceMove | EditCellMove | SetHandMove;

export interface GameNode {
  id: NodeId;
  parentId: NodeId | null;
  childrenIds: NodeId[];
  board: bigint;
  hand: number[];        // [pieceId, pieceId, pieceId]
  handUsed: boolean[];   // [used, used, used]
  lastMove: Move | null;
  createdAt: number;
  note?: string;
}

export interface StateTree {
  nodes: Map<NodeId, GameNode>;
  currentNodeId: NodeId;
  rootNodeId: NodeId;
}

/**
 * Generate a unique node ID
 */
function generateNodeId(): NodeId {
  return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create the initial state tree with empty board and given hand
 */
export function createInitialTree(board: bigint, hand: number[]): StateTree {
  const rootId = generateNodeId();
  const rootNode: GameNode = {
    id: rootId,
    parentId: null,
    childrenIds: [],
    board,
    hand,
    handUsed: hand.map(() => false),
    lastMove: null,
    createdAt: Date.now(),
  };

  const nodes = new Map<NodeId, GameNode>();
  nodes.set(rootId, rootNode);

  return {
    nodes,
    currentNodeId: rootId,
    rootNodeId: rootId,
  };
}

/**
 * Get the current node
 */
export function getCurrentNode(tree: StateTree): GameNode {
  const node = tree.nodes.get(tree.currentNodeId);
  if (!node) {
    throw new Error(`Current node not found: ${tree.currentNodeId}`);
  }
  return node;
}

/**
 * Get a node by ID
 */
export function getNode(tree: StateTree, nodeId: NodeId): GameNode | undefined {
  return tree.nodes.get(nodeId);
}

/**
 * Apply a PLACE move to the current state
 */
export function applyPlaceMove(
  tree: StateTree,
  pieceId: number,
  handIndex: number,
  x: number,
  y: number
): StateTree {
  const currentNode = getCurrentNode(tree);

  // Validate
  if (handIndex < 0 || handIndex >= currentNode.hand.length) {
    throw new Error(`Invalid hand index: ${handIndex}`);
  }
  if (currentNode.handUsed[handIndex]) {
    throw new Error(`Piece at hand index ${handIndex} already used`);
  }
  if (currentNode.hand[handIndex] !== pieceId) {
    throw new Error(`Piece ID mismatch: expected ${currentNode.hand[handIndex]}, got ${pieceId}`);
  }

  const piece = PIECES.get(pieceId);
  if (!piece) {
    throw new Error(`Unknown piece ID: ${pieceId}`);
  }

  const mask = pieceMaskAt(piece, x, y);
  if (mask === 0n) {
    throw new Error(`Cannot place piece ${pieceId} at (${x}, ${y})`);
  }

  // Check overlap
  if ((currentNode.board & mask) !== 0n) {
    throw new Error(`Overlap at (${x}, ${y})`);
  }

  // Place the piece
  const result = placePiece(currentNode.board, mask);

  // Create new hand state
  const newHandUsed = [...currentNode.handUsed];
  newHandUsed[handIndex] = true;

  // Create the move
  const move: PlaceMove = {
    type: 'PLACE',
    pieceId,
    handIndex,
    x,
    y,
    clearedRows: result.clearedRows,
    clearedCols: result.clearedCols,
  };

  // Create new node
  const newNodeId = generateNodeId();
  const newNode: GameNode = {
    id: newNodeId,
    parentId: currentNode.id,
    childrenIds: [],
    board: result.newBoard,
    hand: currentNode.hand,
    handUsed: newHandUsed,
    lastMove: move,
    createdAt: Date.now(),
  };

  // Update the tree
  const newNodes = new Map(tree.nodes);

  // Update parent's children
  const updatedParent: GameNode = {
    ...currentNode,
    childrenIds: [...currentNode.childrenIds, newNodeId],
  };
  newNodes.set(currentNode.id, updatedParent);
  newNodes.set(newNodeId, newNode);

  return {
    ...tree,
    nodes: newNodes,
    currentNodeId: newNodeId,
  };
}

/**
 * Apply an EDIT_CELL move (toggle cell)
 */
export function applyEditCellMove(
  tree: StateTree,
  x: number,
  y: number
): StateTree {
  const currentNode = getCurrentNode(tree);

  // Toggle the cell
  const wasOccupied = ((currentNode.board >> BigInt(y * 8 + x)) & 1n) === 1n;
  const newBoard = toggleBit(currentNode.board, x, y);

  // Create the move
  const move: EditCellMove = {
    type: 'EDIT_CELL',
    x,
    y,
    wasOccupied,
  };

  // Create new node
  const newNodeId = generateNodeId();
  const newNode: GameNode = {
    id: newNodeId,
    parentId: currentNode.id,
    childrenIds: [],
    board: newBoard,
    hand: currentNode.hand,
    handUsed: currentNode.handUsed,
    lastMove: move,
    createdAt: Date.now(),
  };

  // Update the tree
  const newNodes = new Map(tree.nodes);

  // Update parent's children
  const updatedParent: GameNode = {
    ...currentNode,
    childrenIds: [...currentNode.childrenIds, newNodeId],
  };
  newNodes.set(currentNode.id, updatedParent);
  newNodes.set(newNodeId, newNode);

  return {
    ...tree,
    nodes: newNodes,
    currentNodeId: newNodeId,
  };
}

/**
 * Apply a SET_HAND move
 */
export function applySetHandMove(
  tree: StateTree,
  newHand: number[]
): StateTree {
  const currentNode = getCurrentNode(tree);

  // Create the move
  const move: SetHandMove = {
    type: 'SET_HAND',
    previousHand: currentNode.hand,
    newHand,
  };

  // Create new node
  const newNodeId = generateNodeId();
  const newNode: GameNode = {
    id: newNodeId,
    parentId: currentNode.id,
    childrenIds: [],
    board: currentNode.board,
    hand: newHand,
    handUsed: newHand.map(() => false), // Reset used state
    lastMove: move,
    createdAt: Date.now(),
  };

  // Update the tree
  const newNodes = new Map(tree.nodes);

  // Update parent's children
  const updatedParent: GameNode = {
    ...currentNode,
    childrenIds: [...currentNode.childrenIds, newNodeId],
  };
  newNodes.set(currentNode.id, updatedParent);
  newNodes.set(newNodeId, newNode);

  return {
    ...tree,
    nodes: newNodes,
    currentNodeId: newNodeId,
  };
}

/**
 * Checkout (switch to) a specific node
 */
export function checkout(tree: StateTree, nodeId: NodeId): StateTree {
  if (!tree.nodes.has(nodeId)) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  return {
    ...tree,
    currentNodeId: nodeId,
  };
}

/**
 * Check if undo is possible
 */
export function canUndo(tree: StateTree): boolean {
  const currentNode = getCurrentNode(tree);
  return currentNode.parentId !== null;
}

/**
 * Undo: go back to parent node
 */
export function undo(tree: StateTree): StateTree {
  const currentNode = getCurrentNode(tree);

  if (currentNode.parentId === null) {
    return tree; // Already at root
  }

  return checkout(tree, currentNode.parentId);
}

/**
 * Check if redo is possible (has children)
 */
export function canRedo(tree: StateTree): boolean {
  const currentNode = getCurrentNode(tree);
  return currentNode.childrenIds.length > 0;
}

/**
 * Redo: go to the most recent child
 */
export function redo(tree: StateTree): StateTree {
  const currentNode = getCurrentNode(tree);

  if (currentNode.childrenIds.length === 0) {
    return tree; // No children
  }

  // Go to the last (most recent) child
  const lastChildId = currentNode.childrenIds[currentNode.childrenIds.length - 1];
  return checkout(tree, lastChildId);
}

/**
 * Get the path from root to a node
 */
export function getPathToNode(tree: StateTree, nodeId: NodeId): GameNode[] {
  const path: GameNode[] = [];
  let currentId: NodeId | null = nodeId;

  while (currentId !== null) {
    const node = tree.nodes.get(currentId);
    if (!node) break;
    path.unshift(node);
    currentId = node.parentId;
  }

  return path;
}

/**
 * Get the path from root to current node
 */
export function getCurrentPath(tree: StateTree): GameNode[] {
  return getPathToNode(tree, tree.currentNodeId);
}

/**
 * Get all leaf nodes (nodes with no children)
 */
export function getLeafNodes(tree: StateTree): GameNode[] {
  const leaves: GameNode[] = [];
  for (const node of tree.nodes.values()) {
    if (node.childrenIds.length === 0) {
      leaves.push(node);
    }
  }
  return leaves;
}

/**
 * Get the depth of a node (distance from root)
 */
export function getNodeDepth(tree: StateTree, nodeId: NodeId): number {
  let depth = 0;
  let currentId: NodeId | null = nodeId;

  while (currentId !== null) {
    const node = tree.nodes.get(currentId);
    if (!node || node.parentId === null) break;
    depth++;
    currentId = node.parentId;
  }

  return depth;
}

/**
 * Delete a branch (node and all descendants)
 * Cannot delete the root or current node
 */
export function deleteBranch(tree: StateTree, nodeId: NodeId): StateTree {
  if (nodeId === tree.rootNodeId) {
    throw new Error('Cannot delete root node');
  }
  if (nodeId === tree.currentNodeId) {
    throw new Error('Cannot delete current node');
  }

  const nodeToDelete = tree.nodes.get(nodeId);
  if (!nodeToDelete) {
    return tree;
  }

  // Collect all descendant IDs
  const toDelete = new Set<NodeId>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    toDelete.add(id);
    const node = tree.nodes.get(id);
    if (node) {
      queue.push(...node.childrenIds);
    }
  }

  // Create new nodes map without deleted nodes
  const newNodes = new Map(tree.nodes);
  for (const id of toDelete) {
    newNodes.delete(id);
  }

  // Update parent's children
  if (nodeToDelete.parentId) {
    const parent = newNodes.get(nodeToDelete.parentId);
    if (parent) {
      const updatedParent: GameNode = {
        ...parent,
        childrenIds: parent.childrenIds.filter((id) => id !== nodeId),
      };
      newNodes.set(nodeToDelete.parentId, updatedParent);
    }
  }

  return {
    ...tree,
    nodes: newNodes,
  };
}

/**
 * Set a note on a node
 */
export function setNodeNote(tree: StateTree, nodeId: NodeId, note: string): StateTree {
  const node = tree.nodes.get(nodeId);
  if (!node) {
    return tree;
  }

  const newNodes = new Map(tree.nodes);
  newNodes.set(nodeId, { ...node, note });

  return {
    ...tree,
    nodes: newNodes,
  };
}

/**
 * Count total nodes in tree
 */
export function countNodes(tree: StateTree): number {
  return tree.nodes.size;
}

/**
 * Check if all hand pieces are used
 */
export function isHandComplete(tree: StateTree): boolean {
  const currentNode = getCurrentNode(tree);
  return currentNode.handUsed.every((used) => used);
}

/**
 * Get unused piece IDs from hand
 */
export function getUnusedPieceIds(tree: StateTree): number[] {
  const currentNode = getCurrentNode(tree);
  const unused: number[] = [];
  for (let i = 0; i < currentNode.hand.length; i++) {
    if (!currentNode.handUsed[i]) {
      unused.push(currentNode.hand[i]);
    }
  }
  return unused;
}

/**
 * Get unused hand indices
 */
export function getUnusedHandIndices(tree: StateTree): number[] {
  const currentNode = getCurrentNode(tree);
  const unused: number[] = [];
  for (let i = 0; i < currentNode.handUsed.length; i++) {
    if (!currentNode.handUsed[i]) {
      unused.push(i);
    }
  }
  return unused;
}
