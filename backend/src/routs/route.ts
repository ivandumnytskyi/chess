import { Router } from "express";
import { 
  createNewGame, makeMove, getLegalMoves, 
  getGameStatus 
} from "../controllers/GameController";

const router = Router();
router.get("/game", getGameStatus);
router.post("/game", createNewGame);

router.post("/game/move", makeMove);

router.get("/game/legal-moves", getLegalMoves);

router.get('/health', (req, res) => {
  res.send('OK');
});
export default router;