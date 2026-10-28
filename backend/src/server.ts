import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import cors from "cors";
import cookieParser from "cookie-parser";
import router from "./routs/route"

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";;

const app: Express = express();
app.use(cors({
  origin: FRONTEND_ORIGIN,
  credentials: true,
}));

// Cookies are sent automatically by browsers, so reject state-changing requests from other sites.
app.use((req: Request, res: Response, next: NextFunction) => {
  const safeMethod = req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS";
  const origin = req.headers.origin;
  if (!safeMethod && origin && origin !== FRONTEND_ORIGIN) {
    res.status(403).json({ error: "Cross-origin request blocked" });
    return;
  }
  next();
});

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on port ${process.env.PORT || 3000}`);
});