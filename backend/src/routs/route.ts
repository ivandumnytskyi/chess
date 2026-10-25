import { Router } from "express";
import { createNewGame, makeMove, getAllLegalMoves } from "../controllers/GameController";
import { login, logout, signup, exchangeSession } from "../controllers/AuthController";
import { requireAuth } from "../../middleware/requireAuth";



const router = Router();
router.post("/auth/login", login);
router.post("/auth/signup", signup);
router.post("/auth/logout", logout);
router.post("/auth/session", exchangeSession);

router.get("/auth", requireAuth, (req, res) => {
  const user = res.locals.user;

  res.json({
    id: user.id,
    email: user.email,
  });
});

router.post("/game", requireAuth, createNewGame);

router.post("/game/move", requireAuth, makeMove);

router.get("/game/all-legal-moves", requireAuth, getAllLegalMoves);

router.get('/health', (req, res) => {
  res.send('OK');
});
export default router;