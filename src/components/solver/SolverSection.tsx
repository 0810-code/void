'use client';

import { useGameStore } from '@/store/game-store';
import { getCurrentNode } from '@/lib/state-tree';
import PiecePreview from '@/components/hand/PiecePreview';

export default function SolverSection() {
  const {
    stateTree,
    isSolving,
    currentSolution,
    solve,
    applySolutionStep,
    applyFullSolution,
    clearSolution,
  } = useGameStore();

  const currentNode = getCurrentNode(stateTree);
  const allUsed = currentNode.handUsed.every((used) => used);

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-slate-400">Solver</h2>

      {/* Solve Button */}
      <button
        onClick={solve}
        disabled={isSolving || allUsed}
        className={`
          w-full py-2 px-4 rounded-lg font-medium
          transition-colors
          ${
            isSolving || allUsed
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          }
        `}
      >
        {isSolving ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="animate-spin h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Solving...
          </span>
        ) : allUsed ? (
          'All pieces placed'
        ) : (
          'Find Solution'
        )}
      </button>

      {/* Solution Display */}
      {currentSolution && (
        <div className="bg-slate-800 rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-green-400">
              Solution Found!
            </h3>
            <button
              onClick={clearSolution}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              Clear
            </button>
          </div>

          {/* Steps */}
          <div className="space-y-2">
            {currentSolution.steps.map((step, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-2 bg-slate-700 rounded"
              >
                <div className="text-sm text-slate-400 w-6">
                  {index + 1}.
                </div>
                <div className="flex-shrink-0">
                  <PiecePreview pieceId={step.pieceId} size="sm" />
                </div>
                <div className="flex-1 text-sm text-slate-300">
                  ({step.x}, {step.y})
                  {(step.clearedRows.length > 0 ||
                    step.clearedCols.length > 0) && (
                    <span className="ml-2 text-yellow-400 text-xs">
                      Clear:{' '}
                      {step.clearedRows.length > 0 &&
                        `R${step.clearedRows.join(',')}`}
                      {step.clearedRows.length > 0 &&
                        step.clearedCols.length > 0 &&
                        ' '}
                      {step.clearedCols.length > 0 &&
                        `C${step.clearedCols.join(',')}`}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => applySolutionStep(index)}
                  className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded text-white"
                >
                  Apply
                </button>
              </div>
            ))}
          </div>

          {/* Apply All Button */}
          {currentSolution.steps.length > 1 && (
            <button
              onClick={applyFullSolution}
              className="w-full py-2 px-4 rounded bg-green-600 hover:bg-green-500 text-white text-sm font-medium"
            >
              Apply All Steps
            </button>
          )}

          {/* Mobility Score */}
          <div className="text-xs text-slate-500">
            Final mobility: {currentSolution.mobility}
          </div>
        </div>
      )}

      {/* No Solution */}
      {!isSolving && currentSolution === null && allUsed === false && (
        <p className="text-xs text-slate-500 text-center">
          Click &quot;Find Solution&quot; to find the best placement sequence
        </p>
      )}
    </div>
  );
}
