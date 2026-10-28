import { Router } from "express";
import {
  createNewGame,
  makeMove,
  timeoutGame,
  getAllLegalMoves,
  getGame,
  resignGame,
  offerDraw,
  acceptDraw,
  declineDraw,
} from "../controllers/GameController";
import { login, logout, signup, exchangeSession } from "../controllers/AuthController";
import { getProfile, changeUsername } from "../controllers/ProfileController";
import { listGames } from "../controllers/GameHistoryController";
import { sendInvite, listInvites, acceptInvite, declineInvite, cancelInvite } from "../controllers/InviteController";
import { requireAuth } from "../../middleware/requireAuth";
import { ACCESS_COOKIE } from "../../lib/sessionCookies";



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

router.get("/profile", requireAuth, getProfile);

router.patch("/profile/username", requireAuth, changeUsername);

router.get("/games", requireAuth, listGames);

router.post("/invites", requireAuth, sendInvite);

router.get("/invites", requireAuth, listInvites);

router.post("/invites/:id/accept", requireAuth, acceptInvite);

router.post("/invites/:id/decline", requireAuth, declineInvite);

router.post("/invites/:id/cancel", requireAuth, cancelInvite);

router.post("/game/move", requireAuth, makeMove);

router.post("/game/timeout", requireAuth, timeoutGame);

router.get("/game/all-legal-moves", requireAuth, getAllLegalMoves);

router.get("/game/:id", requireAuth, getGame);

router.post("/game/resign", requireAuth, resignGame);

router.post("/game/draw/offer", requireAuth, offerDraw);

router.post("/game/draw/accept", requireAuth, acceptDraw);

router.post("/game/draw/decline", requireAuth, declineDraw);

router.get("/auth/realtime-token", requireAuth, (req, res) => {
  const token = req.cookies[ACCESS_COOKIE];
  if (typeof token !== "string") return res.status(401).json({ error: "Not signed in" });
  res.json({ accessToken: token });
});

router.get('/health', (req, res) => {
  res.send('OK');
});
export default router;