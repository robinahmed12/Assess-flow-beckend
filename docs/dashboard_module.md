# Dashboard Module

Role-specific analytics module using Prisma aggregation and grouping.

## Endpoints

```text
GET /api/v1/dashboard/candidate
GET /api/v1/dashboard/recruiter
GET /api/v1/dashboard/admin
```

All endpoints require JWT authentication. Each endpoint is protected by the matching role.

## Candidate dashboard

Includes:

- Assignment/invitation counts
- Attempt counts by status
- Completion/start/pass rates
- Average score and percentage
- Upcoming assessments
- Recent attempts
- Performance trend
- Result visibility enforcement (`IMMEDIATE`, `AFTER_REVIEW`, `HIDDEN`)

## Recruiter dashboard

Includes:

- Company credits
- Assessments by lifecycle status
- Invitations by status
- Attempts by status
- Pending evaluations
- Candidate start/submission/evaluation rates
- Average evaluated score/percentage
- Pass rate
- Successful payment/credit summary
- Recent submissions
- Top assessment performance

## Admin dashboard

Includes:

- Users by role and status
- Active/inactive users
- Company count and platform credits
- Assessments by status
- Attempts by status
- Evaluated score/pass analytics
- Payment status breakdown
- Successful payment revenue/credits
- Audit-log count
- Recent users
- Recent payments

## Register the router

Use your existing module/router registration style. Example:

```ts
import { dashboardRouter } from "./modules/dashboard";

app.use("/api/v1/dashboard", dashboardRouter);
```

## Schema assumptions

This module follows the field/enum names in the supplied project README and the previously shared invitation/attempt/evaluation modules, including:

- `AssessmentStatus`: `DRAFT`, `PUBLISHED`, `CLOSED`, `ARCHIVED`
- `AttemptStatus`: `IN_PROGRESS`, `SUBMITTED`, `EVALUATED`, `EXPIRED`
- `InvitationStatus`: `PENDING`, `ACCEPTED`, `EXPIRED`, `REVOKED`
- `PaymentStatus.SUCCEEDED`
- `ResultVisibility`: `IMMEDIATE`, `AFTER_REVIEW`, `HIDDEN`
- `Company.credits`
- `Payment.amount`, `Payment.creditsGranted`, `Payment.providerReference`, `Payment.completedAt`

If your actual Prisma schema uses a different payment field/enum name, update only the corresponding payment queries in `dashboard.service.ts`.
