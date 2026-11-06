import { useState } from "react";
import { useNavigate } from "react-router";
import { API_URL, authorizedFetch } from "../../lib/authorization";
import OptionPicker from "../Sheared/OptionPicker";
import { COLOR_OPTIONS, type ColorOptionId } from "../../constants/colorOptions";

type BotDifficulty = "easy" | "medium" | "hard";

const DIFFICULTY_OPTIONS = [
    { id: "easy", label: "Easy" },
    { id: "medium", label: "Medium" },
    { id: "hard", label: "Hard" },
] as const;

const BotChoicer = () => {
    const navigate = useNavigate();
    const [difficulty, setDifficulty] = useState<BotDifficulty>("easy");
    const [playerColor, setPlayerColor] = useState<ColorOptionId>("random");
    const [error, setError] = useState<string | null>(null);
    const [starting, setStarting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setStarting(true);
        // The bot endpoint takes a fixed color, so "random" is resolved here.
        const resolvedColor = playerColor === "random" ? (Math.random() < 0.5 ? "white" : "black") : playerColor;
        try {
            const res = await authorizedFetch(`${API_URL}/game`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ botDifficulty: difficulty, playerColor: resolvedColor }),
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
        <form onSubmit={handleSubmit} className="flex flex-col items-center gap-6 text-white">
            <OptionPicker
                name="difficulty"
                legend="Choose a bot"
                options={DIFFICULTY_OPTIONS}
                value={difficulty}
                onChange={setDifficulty}
            />
            <OptionPicker
                name="color"
                legend="Choose color"
                options={COLOR_OPTIONS}
                value={playerColor}
                onChange={setPlayerColor}
            />
            <button type="submit" disabled={starting} className="px-6 py-2 bg-ruby text-white rounded disabled:opacity-50">Play</button>
            {error && <p className="text-red-400 text-sm">{error}</p>}
        </form>
    );
};

export default BotChoicer;
