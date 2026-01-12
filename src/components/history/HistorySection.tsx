'use client';

import { useGameStore } from '@/store/game-store';
import { getCurrentPath, countNodes } from '@/lib/state-tree';

export default function HistorySection() {
  const {
    stateTree,
    isEditing,
    undo,
    redo,
    toggleEditMode,
    clearBoard,
    canUndo,
    canRedo,
  } = useGameStore();

  const path = getCurrentPath(stateTree);
  const totalNodes = countNodes(stateTree);
  const currentDepth = path.length - 1;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-slate-400">Controls</h2>

      {/* Undo/Redo Buttons */}
      <div className="flex gap-2">
        <button
          onClick={undo}
          disabled={!canUndo()}
          className={`
            flex-1 py-2 px-3 rounded-lg font-medium text-sm
            flex items-center justify-center gap-1
            transition-colors
            ${
              canUndo()
                ? 'bg-slate-700 hover:bg-slate-600 text-white'
                : 'bg-slate-800 text-slate-600 cursor-not-allowed'
            }
          `}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
            />
          </svg>
          Undo
        </button>

        <button
          onClick={redo}
          disabled={!canRedo()}
          className={`
            flex-1 py-2 px-3 rounded-lg font-medium text-sm
            flex items-center justify-center gap-1
            transition-colors
            ${
              canRedo()
                ? 'bg-slate-700 hover:bg-slate-600 text-white'
                : 'bg-slate-800 text-slate-600 cursor-not-allowed'
            }
          `}
        >
          Redo
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"
            />
          </svg>
        </button>
      </div>

      {/* Edit Mode Toggle */}
      <button
        onClick={toggleEditMode}
        className={`
          w-full py-2 px-3 rounded-lg font-medium text-sm
          flex items-center justify-center gap-2
          transition-colors
          ${
            isEditing
              ? 'bg-yellow-600 hover:bg-yellow-500 text-white'
              : 'bg-slate-700 hover:bg-slate-600 text-white'
          }
        `}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
          />
        </svg>
        {isEditing ? 'Exit Edit Mode' : 'Edit Board'}
      </button>

      {/* Clear Board */}
      <button
        onClick={clearBoard}
        className="w-full py-2 px-3 rounded-lg font-medium text-sm
          bg-red-600/20 hover:bg-red-600/30 text-red-400
          flex items-center justify-center gap-2
          transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
        Clear Board
      </button>

      {/* History Info */}
      <div className="text-xs text-slate-500 space-y-1">
        <div className="flex justify-between">
          <span>Depth:</span>
          <span>{currentDepth}</span>
        </div>
        <div className="flex justify-between">
          <span>Total states:</span>
          <span>{totalNodes}</span>
        </div>
      </div>

      {/* Edit Mode Instructions */}
      {isEditing && (
        <div className="p-2 bg-yellow-600/20 rounded text-yellow-300 text-xs">
          Click cells to toggle them on/off
        </div>
      )}
    </div>
  );
}
