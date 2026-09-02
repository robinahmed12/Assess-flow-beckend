import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { notFoundHandler } from "./app/common/middleware/not-found.middleware";
import { globalErrorHandler } from "./app/common/middleware/error.middleware";


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


/*
|--------------------------------------------------------------------------
| 404 Handler
|--------------------------------------------------------------------------
*/

app.use(notFoundHandler);

/*
|--------------------------------------------------------------------------
| Global Error Handler
|--------------------------------------------------------------------------
*/

app.use(globalErrorHandler);

export default app;