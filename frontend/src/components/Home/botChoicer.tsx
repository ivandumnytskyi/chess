import { useState } from "react";
import { useNavigate } from "react-router";
import { API_URL, authorizedFetch } from "../../lib/authorization";

type BotDifficulty = "easy" | "medium" | "hard";
type PlayerColor = "white" | "black";

const BotChoicer = () => {
    const navigate = useNavigate();
    const [difficulty, setDifficulty] = useState<BotDifficulty>("easy");
    const [playerColor, setPlayerColor] = useState<PlayerColor>("white");
    const [error, setError] = useState<string | null>(null);
    const [starting, setStarting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setStarting(true);
        try {
            const res = await authorizedFetch(`${API_URL}/game`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ botDifficulty: difficulty, playerColor }),
            });
            if (!res.ok) throw new Error("Could not start bot game");
            const data: { gameId: string } = await res.json();
            navigate(`/game/${data.gameId}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not start bot game");
        } finally {
            setStarting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 flex flex-col border border-white p-4 max-w-40 items-center">
            <label htmlFor="bot">Choose a bot:</label>
            <select id="bot" name="bot" className="border border-white p-2 max-w-20" value={difficulty} onChange={(e) => setDifficulty(e.target.value as BotDifficulty)}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
            </select>
            <label htmlFor="botColor">Play as:</label>
            <select id="botColor" name="botColor" className="border border-white p-2 max-w-20" value={playerColor} onChange={(e) => setPlayerColor(e.target.value as PlayerColor)}>
                <option value="white">White</option>
                <option value="black">Black</option>
            </select>
            <button type="submit" disabled={starting} className="border border-white hover:bg-gray-700 bg-black w-24 disabled:opacity-50">Play</button>
            {error && <p className="text-red-400 text-sm">{error}</p>}
        </form>
    );
};

export default BotChoicer;