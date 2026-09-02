import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";

const app: Application = express();

app.use(helmet());

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);


app.use(express.json());

app.get("/api/v1/health", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "API is running",
    data: {
      status: "ok",
    },
  });
});

export default app;