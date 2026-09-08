# Developer Assessment & Coding Platform API

A backend-only REST API for creating, managing, delivering, and evaluating technical assessments. The platform allows recruiters to create assessments, invite candidates, collect timed submissions, evaluate answers, generate reports, and purchase assessment credits through a real payment gateway.

> Backend-only project. No frontend is required. All flows are testable through Postman.

---

## Live Links

| Item | Link |
|---|---|
| Live API URL | `TODO: Add deployed API URL` |
| Repository URL | `TODO: Add repository URL` |
| Postman Collection | `TODO: Add Postman collection link or file path` |
| ERD | [View ERD](#entity-relationship-diagram-erd) |
| Video Walkthrough | `TODO: Add walkthrough video link` |

---

## Demo Credentials

> Replace these with the actual seeded credentials used in your project. Do not use production credentials here.

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.com` | `Password123!` |
| Recruiter | `recruiter@example.com` | `Password123!` |
| Candidate | `candidate@example.com` | `Password123!` |

---

## Tech Stack

- Node.js 20+
- TypeScript
- Express.js
- PostgreSQL
- Prisma ORM
- Zod
- JWT authentication
- bcrypt password hashing
- Stripe Checkout / Stripe Payment Intents
- Helmet
- CORS
- express-rate-limit
- Nodemailer or Resend for emails
- Postman for API testing and documentation
- Render for deployment

---

## Core Features

### Authentication & Authorization

- Register and login users.
- JWT Bearer authentication.
- Refresh-token/session support.
- Role-based access control.
- Resource ownership checks.
- Suspended-user protection.

### User Roles

The platform supports exactly three primary roles:

| Role | Description |
|---|---|
| `ADMIN` | System-level administrator with access to users, statistics, audit logs, and payments. |
| `RECRUITER` | Company user who creates assessments, invites candidates, evaluates submissions, views reports, and purchases credits. |
| `CANDIDATE` | Assessment participant who accepts invitations, starts timed attempts, submits answers, and views results when allowed. |

### Recruiter Assessment Workflow

```text
Recruiter / Company
   -> Create Assessment
   -> Add Problems
   -> Publish Assessment
   -> Invite Candidates
   -> Candidate Starts Timed Attempt
   -> Candidate Submits Answers
   -> Automatic / Manual Evaluation
   -> Score & Result
   -> Recruiter Report
```

### Problem Bank

- MCQ, written, and coding problem types.
- Difficulty levels: `EASY`, `MEDIUM`, `HARD`.
- Points-based scoring.
- Tags, filtering, sorting, search, and pagination.
- Soft delete support.
- Correct MCQ answers are never exposed to candidates during active assessments.

### Assessment Lifecycle

Supported assessment status flow:

```text
DRAFT -> PUBLISHED -> CLOSED -> ARCHIVED
```

Also supported:

```text
DRAFT -> ARCHIVED
```

Rules:

- Problems can be added, removed, and reordered while an assessment is `DRAFT`.
- Publishing requires a valid title, duration, at least one active problem, and positive total points.
- Published assessments cannot be destructively edited in a way that affects existing attempts.
- Closed assessments do not accept new attempts.
- Archived assessments are read-only.

### Invitations & Timed Attempts

- Recruiters invite candidates to published assessments.
- Invitation tokens are cryptographically secure.
- Invitation expiry and revocation are enforced.
- Starting an attempt is transactional.
- The server is the source of truth for timers.
- Candidates cannot edit answers after submission or expiry.

### Evaluation & Results

- MCQ answers are auto-scored.
- Written and coding answers are manually evaluated by recruiters.
- Manual score cannot exceed the problem maximum score.
- Final evaluation calculates total score, percentage, and pass/fail state.
- Candidate result visibility follows assessment policy:
  - `IMMEDIATE`
  - `AFTER_REVIEW`
  - `HIDDEN`

### Payments & Credits

- Recruiters purchase assessment credits for their company.
- One successful candidate invitation consumes one credit.
- Payment success is verified through Stripe webhook signature verification.
- Credit granting is transactional and idempotent.
- Replayed webhooks must not grant credits twice.

### Admin Features

- List and search users.
- Suspend or reactivate users.
- View dashboard statistics.
- View audit logs.
- Inspect platform payments.

### Audit Logging

Audit logs should be recorded for critical actions such as:

- User registration and login.
- User status changes.
- Company creation/update.
- Problem and assessment lifecycle changes.
- Candidate invitations.
- Attempt start/submission.
- Answer evaluation.
- Evaluation finalization.
- Payment success/failure.


---

## Entity Relationship Diagram (ERD)

> This is a conceptual ERD based on the API flows and domain rules described in this README. Keep the final column names and constraints aligned with the actual Prisma schema.

```mermaid
erDiagram
    USER {
        uuid id PK
        string email UK
        string passwordHash
        enum role "ADMIN | RECRUITER | CANDIDATE"
        enum status
        datetime createdAt
        datetime updatedAt
    }

    COMPANY {
        uuid id PK
        uuid ownerId FK
        string name
        int credits
        datetime createdAt
        datetime updatedAt
    }

    PROBLEM {
        uuid id PK
        uuid createdById FK
        string title
        enum type "MCQ | WRITTEN | CODING"
        enum difficulty "EASY | MEDIUM | HARD"
        decimal points
        datetime deletedAt
        datetime createdAt
        datetime updatedAt
    }

    ASSESSMENT {
        uuid id PK
        uuid companyId FK
        uuid createdById FK
        string title
        int durationMinutes
        enum status "DRAFT | PUBLISHED | CLOSED | ARCHIVED"
        enum resultVisibility "IMMEDIATE | AFTER_REVIEW | HIDDEN"
        decimal passPercentage
        datetime createdAt
        datetime updatedAt
    }

    ASSESSMENT_PROBLEM {
        uuid assessmentId PK, FK
        uuid problemId PK, FK
        int orderIndex
    }

    INVITATION {
        uuid id PK
        uuid assessmentId FK
        uuid candidateId FK
        string token UK
        enum status
        datetime expiresAt
        datetime revokedAt
        datetime createdAt
    }

    ATTEMPT {
        uuid id PK
        uuid invitationId FK
        uuid candidateId FK
        enum status
        datetime startedAt
        datetime submittedAt
        datetime expiresAt
        decimal totalScore
        decimal percentage
        boolean passed
    }

    ANSWER {
        uuid id PK
        uuid attemptId FK
        uuid problemId FK
        text response
        decimal awardedScore
        uuid evaluatedById FK
        datetime evaluatedAt
        datetime updatedAt
    }

    PAYMENT {
        uuid id PK
        uuid companyId FK
        uuid recruiterId FK
        string providerReference UK
        enum status
        decimal amount
        int creditsGranted
        datetime createdAt
        datetime completedAt
    }

    REFRESH_SESSION {
        uuid id PK
        uuid userId FK
        string tokenHash
        datetime expiresAt
        datetime revokedAt
        datetime createdAt
    }

    AUDIT_LOG {
        uuid id PK
        uuid actorUserId FK
        string action
        string entityType
        uuid entityId
        json metadata
        datetime createdAt
    }

    USER ||--o| COMPANY : owns
    USER ||--o{ PROBLEM : creates
    USER ||--o{ ASSESSMENT : creates
    COMPANY ||--o{ ASSESSMENT : contains

    ASSESSMENT ||--o{ ASSESSMENT_PROBLEM : includes
    PROBLEM ||--o{ ASSESSMENT_PROBLEM : appears_in

    ASSESSMENT ||--o{ INVITATION : has
    USER ||--o{ INVITATION : receives
    INVITATION ||--o| ATTEMPT : starts
    USER ||--o{ ATTEMPT : takes

    ATTEMPT ||--o{ ANSWER : contains
    PROBLEM ||--o{ ANSWER : answered_by
    USER ||--o{ ANSWER : evaluates

    COMPANY ||--o{ PAYMENT : purchases
    USER ||--o{ PAYMENT : initiates

    USER ||--o{ REFRESH_SESSION : has
    USER ||--o{ AUDIT_LOG : performs
```

### Relationship Summary

- A recruiter-owned `COMPANY` can have many assessments and payments.
- A recruiter can create many `PROBLEM` and `ASSESSMENT` records.
- `ASSESSMENT` and `PROBLEM` use `ASSESSMENT_PROBLEM` as a many-to-many join table so problems can be ordered inside an assessment.
- An `ASSESSMENT` can generate many candidate `INVITATION` records.
- An invitation can create at most one `ATTEMPT`, matching the single-start behavior described for the MVP.
- An attempt contains many `ANSWER` records, with each answer linked to its problem.
- Recruiters can manually evaluate written/coding answers, while MCQ scoring can be performed automatically by the application.
- Successful `PAYMENT` processing grants credits to the related company, with webhook processing kept idempotent.
- `REFRESH_SESSION` supports refresh-token/session revocation, and `AUDIT_LOG` records critical platform actions.

---

## API Base URL

```text
/api/v1
```

Example local base URL:

```text
http://localhost:5000/api/v1
```

---

## Standard API Response Format

### Success Response

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

### Error Response

```json
{
  "success": false,
  "message": "Something went wrong",
  "errors": []
}
```

### Paginated Response

```json
{
  "success": true,
  "message": "Data retrieved successfully",
  "data": {
    "items": [],
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 52,
      "totalPages": 6
    }
  }
}
```

---

## Important API Endpoints

### Authentication

| Method | Endpoint | Access |
|---|---|---|
| POST | `/auth/register` | Public |
| POST | `/auth/login` | Public |
| POST | `/auth/refresh-token` | Public |
| POST | `/auth/logout` | Authenticated |

### Profile

| Method | Endpoint | Access |
|---|---|---|
| GET | `/users/me` | Authenticated |
| PATCH | `/users/me` | Authenticated |

### Company

| Method | Endpoint | Access |
|---|---|---|
| POST | `/companies` | Recruiter |
| GET | `/companies/me` | Recruiter |
| PATCH | `/companies/me` | Recruiter |

### Problems

| Method | Endpoint | Access |
|---|---|---|
| POST | `/problems` | Recruiter |
| GET | `/problems` | Recruiter |
| GET | `/problems/:id` | Recruiter Owner |
| PATCH | `/problems/:id` | Recruiter Owner |
| DELETE | `/problems/:id` | Recruiter Owner |

### Assessments

| Method | Endpoint | Access |
|---|---|---|
| POST | `/assessments` | Recruiter |
| GET | `/assessments` | Recruiter |
| GET | `/assessments/:id` | Recruiter Owner / Admin |
| PATCH | `/assessments/:id` | Recruiter Owner |
| DELETE | `/assessments/:id` | Recruiter Owner |
| POST | `/assessments/:id/problems` | Recruiter Owner |
| DELETE | `/assessments/:id/problems/:problemId` | Recruiter Owner |
| PATCH | `/assessments/:id/problems/reorder` | Recruiter Owner |
| POST | `/assessments/:id/publish` | Recruiter Owner |
| POST | `/assessments/:id/close` | Recruiter Owner |
| POST | `/assessments/:id/archive` | Recruiter Owner |

### Invitations

| Method | Endpoint | Access |
|---|---|---|
| POST | `/assessments/:id/invitations` | Recruiter Owner |
| GET | `/assessments/:id/invitations` | Recruiter Owner |
| POST | `/invitations/:id/revoke` | Recruiter Owner |
| GET | `/invitations/me` | Candidate |
| GET | `/invitations/:token` | Candidate |

### Attempts & Answers

| Method | Endpoint | Access |
|---|---|---|
| POST | `/invitations/:token/start` | Candidate |
| GET | `/attempts/:id` | Candidate Owner / Recruiter Owner |
| PUT | `/attempts/:id/answers/:problemId` | Candidate Owner |
| POST | `/attempts/:id/submit` | Candidate Owner |
| GET | `/attempts/me` | Candidate |

### Evaluation & Reports

| Method | Endpoint | Access |
|---|---|---|
| GET | `/assessments/:id/submissions` | Recruiter Owner |
| GET | `/attempts/:id/evaluation` | Recruiter Owner |
| PATCH | `/attempts/:id/answers/:answerId/evaluate` | Recruiter Owner |
| POST | `/attempts/:id/finalize-evaluation` | Recruiter Owner |
| GET | `/attempts/:id/result` | Candidate Owner / Recruiter Owner |
| GET | `/assessments/:id/report` | Recruiter Owner |

### Payments

| Method | Endpoint | Access |
|---|---|---|
| POST | `/payments/checkout` | Recruiter |
| POST | `/payments/webhook` | Stripe |
| GET | `/payments` | Recruiter |
| GET | `/payments/:id` | Recruiter Owner / Admin |

### Admin

| Method | Endpoint | Access |
|---|---|---|
| GET | `/admin/users` | Admin |
| PATCH | `/admin/users/:id/status` | Admin |
| GET | `/admin/dashboard-stats` | Admin |
| GET | `/admin/audit-logs` | Admin |
| GET | `/admin/payments` | Admin |

---

## Local Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd <project-folder>
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create Environment File

```bash
cp .env.example .env
```

Then update `.env` with your local values.

### 4. Run Prisma Migration

```bash
npx prisma migrate dev
```

### 5. Seed the Database

```bash
npx prisma db seed
```

### 6. Start Development Server

```bash
npm run dev
```

### 7. Build for Production

```bash
npm run build
```

### 8. Start Production Server

```bash
npm start
```

---

## Environment Variables

Create a `.env` file using the following structure:

```env
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME

JWT_ACCESS_SECRET=replace_me
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=replace_me
JWT_REFRESH_EXPIRES_IN=7d

BCRYPT_SALT_ROUNDS=12

CORS_ORIGIN=http://localhost:3000

STRIPE_SECRET_KEY=replace_me
STRIPE_WEBHOOK_SECRET=replace_me
STRIPE_SUCCESS_URL=http://localhost:3000/payment/success
STRIPE_CANCEL_URL=http://localhost:3000/payment/cancel

EMAIL_FROM=no-reply@example.com
RESEND_API_KEY=replace_me
```

Never commit `.env` to version control.

---

## Prisma Commands

Generate Prisma client:

```bash
npx prisma generate
```

Create and apply a migration:

```bash
npx prisma migrate dev --name init
```

Apply production migrations:

```bash
npx prisma migrate deploy
```

Open Prisma Studio:

```bash
npx prisma studio
```

Seed database:

```bash
npx prisma db seed
```

---

## Postman Testing Guide

The Postman collection should be organized by module:

```text
Developer Assessment Platform
  Auth
  Users
  Company
  Problems
  Assessments
  Invitations
  Attempts
  Evaluation
  Payments
  Admin
```

Recommended Postman environment variables:

```text
baseUrl
adminAccessToken
recruiterAccessToken
candidateAccessToken
assessmentId
problemId
invitationToken
attemptId
paymentId
```

Recommended manual test sequence:

1. Login as recruiter.
2. Create company profile.
3. Create MCQ, written, and coding problems.
4. Create assessment.
5. Attach problems to assessment.
6. Publish assessment.
7. Purchase credits using Stripe test mode.
8. Invite candidate.
9. Login as candidate.
10. Start attempt from invitation.
11. Save answers.
12. Submit attempt.
13. Login as recruiter.
14. Manually evaluate written/coding answers.
15. Finalize evaluation.
16. View candidate result and assessment report.
17. Login as admin.
18. View users, dashboard stats, audit logs, and payments.

---

## Stripe Test Mode Instructions

> Stripe payment success must come from webhook verification, not from a normal client request.

### Start Stripe CLI Listener

```bash
stripe listen --forward-to localhost:5000/api/v1/payments/webhook
```

Copy the webhook signing secret and set it in `.env`:

```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

### Create Checkout Session

```http
POST /api/v1/payments/checkout
Authorization: Bearer <recruiterAccessToken>
Content-Type: application/json
```

```json
{
  "packageCode": "STARTER"
}
```

### Test Payment Card

Use Stripe test card:

```text
4242 4242 4242 4242
```

Use any valid future expiry date, any CVC, and any postal code.

### Expected Result

- Payment status becomes `SUCCEEDED`.
- Company credits are incremented exactly once.
- Replaying the same webhook does not grant duplicate credits.

---

## Security Notes

This project should enforce:

- Helmet security headers.
- Production CORS allowlist.
- Global rate limiting.
- Stricter rate limiting for auth routes.
- bcrypt password hashing.
- JWT secrets from environment variables.
- Stripe secrets from environment variables.
- Centralized error handling.
- Zod validation for untrusted input.
- Role-based and ownership-based authorization.
- Server-authoritative attempt timers.
- No password hash leakage.
- No refresh-token leakage.
- No Stripe secret leakage.
- No invitation-token leakage beyond intended flows.
- No MCQ correct-answer leakage to candidates.
- No unsafe candidate code execution in the MVP.

---

## Testing Checklist

### Authentication

- [ ] Register recruiter.
- [ ] Register candidate.
- [ ] Reject duplicate email.
- [ ] Reject invalid password.
- [ ] Login works.
- [ ] Wrong password is rejected.
- [ ] Refresh token works.
- [ ] Logout/revocation works.

### RBAC & Ownership

- [ ] Candidate cannot create assessment.
- [ ] Recruiter cannot access admin users.
- [ ] Recruiter A cannot access Recruiter B assessment.
- [ ] Candidate A cannot access Candidate B attempt.

### Assessment

- [ ] Cannot publish empty assessment.
- [ ] Can add problem to draft assessment.
- [ ] Can publish valid assessment.
- [ ] Cannot destructively edit published assessment.
- [ ] Can close assessment.

### Invitation

- [ ] Cannot invite without credit.
- [ ] Invite consumes exactly one credit.
- [ ] Duplicate active invitation is handled safely.
- [ ] Expired/revoked invitation cannot start attempt.

### Attempt

- [ ] Candidate can start only once.
- [ ] Duplicate start is rejected.
- [ ] Candidate can save answers before expiry.
- [ ] Candidate cannot edit after submission.
- [ ] Server enforces timer.

### Evaluation

- [ ] MCQ is auto-scored correctly.
- [ ] Recruiter can score written/coding answer.
- [ ] Score above max is rejected.
- [ ] Finalization is rejected until manual scores are complete.
- [ ] Final percentage/pass state is correct.

### Payment

- [ ] Checkout endpoint creates real Stripe test-mode session or intent.
- [ ] Invalid webhook signature is rejected.
- [ ] Successful webhook grants credits.
- [ ] Replayed webhook does not grant credits twice.

---

## Deployment Notes

Recommended deployment platform: Render.

Production checklist:

- [ ] Set all environment variables in hosting provider.
- [ ] Use production PostgreSQL database.
- [ ] Run `npx prisma migrate deploy`.
- [ ] Verify health endpoint.
- [ ] Verify auth flow.
- [ ] Verify protected routes require Bearer token.
- [ ] Verify Stripe webhook URL is configured in Stripe dashboard.
- [ ] Run smoke test for recruiter and candidate workflow.

---

## Definition of Done

- [ ] Exactly three roles exist: `ADMIN`, `RECRUITER`, `CANDIDATE`.
- [ ] 20+ meaningful endpoints are implemented.
- [ ] Protected endpoints require Bearer authentication.
- [ ] Role and resource ownership checks are enforced.
- [ ] Passwords are hashed.
- [ ] Zod validates applicable inputs.
- [ ] Global structured success/error response format is used.
- [ ] Pagination, filtering, sorting, and search are implemented.
- [ ] Soft delete is implemented where appropriate.
- [ ] Audit logs exist for critical operations.
- [ ] Assessment lifecycle rules are enforced.
- [ ] Candidate invitations work.
- [ ] Server-authoritative timed attempts work.
- [ ] Candidate submissions work.
- [ ] MCQ automatic scoring works.
- [ ] Written/coding manual scoring works.
- [ ] Result/report generation works.
- [ ] Real Stripe test-mode payment integration works.
- [ ] Webhook verification is implemented.
- [ ] Payment webhook is idempotent.
- [ ] Company credits are granted transactionally.
- [ ] Prisma transactions are used for race-sensitive flows.
- [ ] Useful database indexes exist.
- [ ] Helmet, CORS, and rate limiting are enabled.
- [ ] Postman collection documents the API.
- [ ] Backend is deployed.
- [ ] README is complete.
- [ ] Git history contains meaningful commits.

---

## Future Improvements

The following are intentionally out of MVP scope but can be added later:

- Full frontend dashboard.
- Live collaborative coding.
- Video proctoring.
- Browser-lockdown system.
- AI plagiarism detection.
- Production-grade compiler/judge infrastructure.
- Multi-recruiter company membership.
- Subscription billing.
- Multiple assessment attempts per invitation.
- Real-time WebSocket monitoring.

---

## Walkthrough Script

Use this outline for a 3–5 minute demo video:

1. Introduce the project and three roles.
2. Show the API base URL and Postman collection.
3. Login as recruiter.
4. Create problem and assessment.
5. Publish assessment.
6. Purchase credits through Stripe test mode.
7. Invite candidate.
8. Login as candidate and start attempt.
9. Submit answers.
10. Login as recruiter and finalize evaluation.
11. Show candidate result/report.
12. Login as admin and show dashboard stats, users, audit logs, and payments.
13. Summarize security, transactions, and webhook idempotency.

---

## License

This project is prepared as a backend assignment/demo project. Add your preferred license before publishing publicly.
