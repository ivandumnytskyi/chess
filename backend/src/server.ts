import express, { type Express, type Request, type Response } from 'express';
import cors from "cors";
import router from "./routs/route"

const app: Express = express();
app.use(cors({
  origin: "http://localhost:5173",
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on port ${process.env.PORT || 3000}`);
});