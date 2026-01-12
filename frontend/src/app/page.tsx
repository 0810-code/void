'use client';

import BoardGrid from '@/components/board/BoardGrid';
import HandSection from '@/components/hand/HandSection';
import SolverSection from '@/components/solver/SolverSection';
import HistorySection from '@/components/history/HistorySection';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="border-b border-slate-800 py-4 px-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Block Puzzle Solver</h1>
          <span className="text-xs text-slate-500">8x8 / 41 pieces</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Board */}
          <div className="lg:col-span-2 space-y-6">
            {/* Board */}
            <section className="bg-slate-850 rounded-xl p-4">
              <div className="flex justify-center">
                <div className="relative pl-6 pt-6">
                  <BoardGrid />
                </div>
              </div>
            </section>

            {/* Hand */}
            <section className="bg-slate-800 rounded-xl p-4">
              <HandSection />
            </section>
          </div>

          {/* Right Column - Controls */}
          <div className="space-y-6">
            {/* Solver */}
            <section className="bg-slate-800 rounded-xl p-4">
              <SolverSection />
            </section>

            {/* History/Controls */}
            <section className="bg-slate-800 rounded-xl p-4">
              <HistorySection />
            </section>
          </div>
        </div>

        {/* Instructions */}
        <section className="mt-8 text-center text-sm text-slate-500 space-y-1">
          <p>1. Select a piece from your hand</p>
          <p>2. Click on the board to place it</p>
          <p>3. Use &quot;Find Solution&quot; to get optimal placement</p>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-4 px-4 mt-8">
        <div className="max-w-4xl mx-auto text-center text-xs text-slate-600">
          Block Puzzle Solver - Finds optimal 3-piece placement strategies
        </div>
      </footer>
    </div>
  );
}
