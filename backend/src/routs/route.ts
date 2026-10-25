import { Router } from "express";
import { 
  createNewGame, makeMove, getLegalMoves, 
  getGameStatus 
} from "../controllers/GameController";
import { requireAuth } from "../../middleware/requireAuth";



const router = Router();
router.get("/auth", requireAuth, (req, res) => {
  const user = res.locals.user;

  res.json({
    id: user.id,
    email: user.email,
  });
});

router.get("/game", requireAuth, getGameStatus);
router.post("/game", requireAuth, createNewGame);

router.post("/game/move", requireAuth, makeMove);

router.get("/game/legal-moves", requireAuth, getLegalMoves);

router.get('/health', (req, res) => {
  res.send('OK');
});
export default router;