import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { notFoundHandler } from "./app/common/middleware/not-found.middleware";
import { globalErrorHandler } from "./app/common/middleware/error.middleware";
import authRouter from "./modules/auth/auth.routes";
import recruiterRouter from "./modules/recruiter/recruiter.routes";
import companyRouter from "./modules/company/company.routes";
import problemRouter from "./modules/problem/problem.routes";
import assessmentRouter from "./modules/assessment/assessment.routes";

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

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/recruiters", recruiterRouter);
app.use("/api/v1/companies", companyRouter);
app.use("/api/v1/problems", problemRouter);
app.use("/api/v1/assessments",assessmentRouter);

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