'use client';

import { useState } from 'react';
import { playMines } from '../../server/api/client'; // API client

export default function BetForm({ game, userId }: { game: string; userId: string }) {
  const [betAmount, setBetAmount] = useState(10);
  const [params, setParams] = useState({ mines: 3 });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleBet = async () => {
    setLoading(true);
    try {
      const res = await playMines({ userId, betAmount, params });
      setResult(res);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <div className="p-6 border rounded-lg">
      <h2 className="text-xl font-bold mb-4">{game.toUpperCase()} Bet</h2>
      <input
        type="number"
        value={betAmount}
        onChange={(e) => setBetAmount(Number(e.target.value))}
        className="border p-2 mb-4 w-full"
        placeholder="Bet Amount"
      />
      {/* Game-specific params */}
      {game === 'mines' && (
        <input
          type="number"
          value={params.mines}
          onChange={(e) => setParams({ mines: Number(e.target.value) })}
          className="border p-2 mb-4 w-full"
          placeholder="Mines Count"
        />
      )}
      <button
        onClick={handleBet}
        disabled={loading}
        className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Placing Bet...' : 'Place Bet'}
      </button>
      {result && (
        <div className="mt-6 p-4 bg-green-50 rounded">
          <p>Payout: {result.payout}</p>
          <button onClick={() => window.open(`/verify?betId=${result.betId}`)}>Verify</button>
        </div>
      )}
    </div>
  );
}
