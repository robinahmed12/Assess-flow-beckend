# Developer Assessment & Coding Platform — Backend Project Specification

> **Purpose:** This document is the single source of truth for building the backend assignment with an AI coding assistant step by step.
>
> **Project type:** Backend-only REST API
>
> **Primary stack:** Node.js + TypeScript + Express.js + PostgreSQL + Prisma + Zod + JWT + Stripe

---

## 1. Project Summary

Build a backend platform where companies/recruiters can create technical assessments, add coding/MCQ/written problems, invite candidates, receive timed attempts and submissions, evaluate answers, generate results/reports, and purchase assessment credits through a real payment gateway.

Main workflow:

```text
Recruiter/Company
   -> Create Assessment
   -> Add Problems
   -> Publish Assessment
   -> Invite Candidates
   -> Candidate Starts Timed Attempt
   -> Candidate Submits Answers
   -> Automatic/Manual Evaluation
   -> Score & Result
   -> Recruiter Report
```

This is a backend-only assignment. No frontend is required. Every flow must be testable through Postman.

---

## 2. Fixed Primary Roles

The assignment requires exactly **3 primary roles**.

### 2.1 ADMIN

System-level administrator.

Permissions:
- View and manage all users.
- Suspend/reactivate users.
- View all companies and assessments.
- View platform statistics.
- View audit logs.
- Inspect payments.
- Override problematic records only when explicitly supported.

### 2.2 RECRUITER

Represents a company/recruiter/assessment creator/evaluator.

Permissions:
- Create and update their company profile.
- Create and manage problem-bank questions.
- Create, edit, publish, close, and archive assessments.
- Attach problems to assessments.
- Invite candidates.
- View candidate attempts and submissions for their assessments.
- Manually evaluate written/coding answers when required.
- View results and reports.
- Purchase assessment credits.

### 2.3 CANDIDATE

Assessment participant.

Permissions:
- Manage personal profile.
- View their invitations.
- Accept valid invitations.
- Start an assessment attempt.
- Save/update answers while an attempt is active.
- Submit an assessment before expiry.
- View own result only when the assessment policy allows it.

### Role design note

Do **not** create separate `COMPANY`, `ASSESSMENT_CREATOR`, or `EVALUATOR` primary roles. Their responsibilities belong to the `RECRUITER` role so the project stays compliant with the exactly-three-role rule.

---

## 3. Recommended Technology Decisions

Use the following unless there is a strong reason to change them:

- Node.js 20+
- TypeScript
- Express.js
- PostgreSQL
- Prisma ORM
- Zod validation
- JWT access + refresh tokens
- bcrypt for password hashing
- Stripe Checkout or Stripe Payment Intents for mandatory real payment integration
- express-rate-limit
- helmet
- cors
- cookie-parser only if refresh tokens are stored in HTTP-only cookies
- Redis optional; recommended for rate limiting/cache but not required for MVP
- Nodemailer or Resend optional for invitation emails
- Postman for API documentation/testing
- Render for deployment

### Important scope decision

For the 5-day assignment, **do not execute arbitrary candidate code on the API server**. Coding questions may accept source-code text and be evaluated manually. If code execution is added later, it must run in an isolated sandbox/container and must never use `eval`, `exec`, or direct child-process execution on the main API server.

---

## 4. Mandatory Assignment Requirements Mapping

| Assignment requirement | Project implementation |
|---|---|
| Exactly 3 roles | ADMIN, RECRUITER, CANDIDATE |
| 20+ meaningful APIs | This specification defines 40+ useful endpoints |
| Authentication | Register, login, refresh, logout |
| Bearer authentication | JWT access token in `Authorization: Bearer <token>` |
| Role-based middleware | `authorize(ADMIN)`, `authorize(RECRUITER)`, etc. |
| Validation | Zod schemas for body/query/params |
| Pagination | Problem bank, assessments, invitations, users, logs |
| Filtering/sorting | Assessment/problem/user/report list APIs |
| Search | Problem-bank and admin-user search |
| Soft delete | Users, problems, assessments where appropriate |
| Audit logging | Critical create/update/status/payment/evaluation actions |
| Business logic | Assessment lifecycle, invitation lifecycle, timed attempt, scoring |
| Transactions | Attempt start, final submission, evaluation/result generation, payment credit grant |
| Rate limiting | Auth routes and global/API limits |
| Security headers | Helmet + safe CORS configuration |
| Database indexes | Email, token IDs, status, foreign keys, invitation token, timestamps |
| Real payment | Stripe creation + webhook verification + status tracking |
| Documentation | Postman collection + README |
| Deployment | Render + production PostgreSQL |

---

## 5. Core Domain Entities

Use UUIDs for primary keys unless the implementation intentionally standardizes on CUIDs.

### 5.1 User

Fields:
- `id`
- `name`
- `email` unique
- `passwordHash`
- `role`: `ADMIN | RECRUITER | CANDIDATE`
- `status`: `ACTIVE | SUSPENDED`
- `avatarUrl?`
- `phone?`
- `deletedAt?`
- `createdAt`
- `updatedAt`

### 5.2 RefreshToken / Session

Fields:
- `id`
- `userId`
- `tokenHash` or `jti`
- `expiresAt`
- `revokedAt?`
- `createdAt`

Never store raw long-lived refresh tokens if avoidable.

### 5.3 Company

Fields:
- `id`
- `ownerId` -> User(RECRUITER)
- `name`
- `slug` unique
- `description?`
- `website?`
- `logoUrl?`
- `assessmentCredits` default 0
- `deletedAt?`
- `createdAt`
- `updatedAt`

For assignment scope, each recruiter owns one company profile. Supporting multiple recruiters per company is optional and should not be added unless there is enough time.

### 5.4 Problem

Fields:
- `id`
- `companyId`
- `createdById`
- `title`
- `description`
- `type`: `MCQ | WRITTEN | CODING`
- `difficulty`: `EASY | MEDIUM | HARD`
- `points`
- `tags` (string array or normalized table)
- `isActive`
- `deletedAt?`
- `createdAt`
- `updatedAt`

Type-specific data:
- MCQ: options and correct answer.
- WRITTEN: optional evaluation guideline/model answer.
- CODING: starter code, language hints, evaluation notes; automatic execution is out of MVP scope.

### 5.5 ProblemOption

For MCQ problems.

Fields:
- `id`
- `problemId`
- `text`
- `isCorrect`

Never return `isCorrect` to candidates during an active assessment.

### 5.6 Assessment

Fields:
- `id`
- `companyId`
- `createdById`
- `title`
- `description?`
- `instructions?`
- `durationMinutes`
- `passingScorePercent?`
- `status`: `DRAFT | PUBLISHED | CLOSED | ARCHIVED`
- `resultVisibility`: `IMMEDIATE | AFTER_REVIEW | HIDDEN`
- `startsAt?`
- `endsAt?`
- `deletedAt?`
- `createdAt`
- `updatedAt`

### 5.7 AssessmentProblem

Join table between assessment and problem.

Fields:
- `id`
- `assessmentId`
- `problemId`
- `order`
- `pointsOverride?`

Constraints:
- Unique `(assessmentId, problemId)`
- Unique `(assessmentId, order)` if practical

### 5.8 Invitation

Fields:
- `id`
- `assessmentId`
- `candidateId?`
- `candidateEmail`
- `invitedById`
- `token` unique or secure token hash
- `status`: `PENDING | ACCEPTED | EXPIRED | REVOKED`
- `expiresAt`
- `acceptedAt?`
- `createdAt`

### 5.9 Attempt

Fields:
- `id`
- `assessmentId`
- `candidateId`
- `invitationId`
- `status`: `IN_PROGRESS | SUBMITTED | EXPIRED | EVALUATED`
- `startedAt`
- `expiresAt`
- `submittedAt?`
- `totalScore?`
- `percentage?`
- `passed?`
- `createdAt`
- `updatedAt`

Important constraints:
- One valid attempt per invitation.
- Starting an attempt and consuming the invitation must happen transactionally.

### 5.10 Answer

Fields:
- `id`
- `attemptId`
- `problemId`
- `selectedOptionId?`
- `writtenAnswer?`
- `codeAnswer?`
- `language?`
- `autoScore?`
- `manualScore?`
- `finalScore?`
- `feedback?`
- `evaluatedById?`
- `evaluatedAt?`
- `createdAt`
- `updatedAt`

Constraint:
- Unique `(attemptId, problemId)`

### 5.11 Payment

Fields:
- `id`
- `companyId`
- `recruiterId`
- `provider`: `STRIPE`
- `providerSessionId?`
- `providerPaymentIntentId?`
- `amount`
- `currency`
- `creditsPurchased`
- `status`: `PENDING | SUCCEEDED | FAILED | CANCELED | REFUNDED`
- `paidAt?`
- `createdAt`
- `updatedAt`

### 5.12 AuditLog

Fields:
- `id`
- `actorId?`
- `action`
- `entityType`
- `entityId?`
- `metadata` JSON
- `ipAddress?`
- `userAgent?`
- `createdAt`

---

## 6. Important Enums

```ts
Role = ADMIN | RECRUITER | CANDIDATE
UserStatus = ACTIVE | SUSPENDED
ProblemType = MCQ | WRITTEN | CODING
Difficulty = EASY | MEDIUM | HARD
AssessmentStatus = DRAFT | PUBLISHED | CLOSED | ARCHIVED
ResultVisibility = IMMEDIATE | AFTER_REVIEW | HIDDEN
InvitationStatus = PENDING | ACCEPTED | EXPIRED | REVOKED
AttemptStatus = IN_PROGRESS | SUBMITTED | EXPIRED | EVALUATED
PaymentStatus = PENDING | SUCCEEDED | FAILED | CANCELED | REFUNDED
```

---

## 7. Assessment Lifecycle Rules

Allowed transitions:

```text
DRAFT -> PUBLISHED -> CLOSED -> ARCHIVED
```

Also allow:

```text
DRAFT -> ARCHIVED
```

Rules:

1. Only a recruiter who owns the assessment's company can modify it.
2. Problems can be freely added/removed/reordered while assessment is `DRAFT`.
3. Publishing requires:
   - title
   - duration > 0
   - at least 1 active problem
   - total available points > 0
4. Once `PUBLISHED`, do not allow destructive edits that could make existing candidate attempts inconsistent.
5. A `CLOSED` assessment accepts no new attempts.
6. An `ARCHIVED` assessment is read-only.
7. Soft-deleted assessments are not visible in normal queries.

---

## 8. Invitation and Attempt Rules

### Invitation

- Only a recruiter may invite a candidate.
- Assessment must be `PUBLISHED`.
- Candidate email must be valid.
- Duplicate active invitation for the same email + assessment should be rejected or reused according to one consistent policy.
- Invitation token must be cryptographically secure.
- Expired/revoked invitations cannot start attempts.

### Attempt start

Starting an attempt is a critical transactional operation.

Transaction must:
1. Lock/re-check invitation state.
2. Verify invitation belongs to the authenticated candidate/email.
3. Verify assessment is currently available.
4. Verify no existing attempt exists for the invitation.
5. Create attempt.
6. Set `expiresAt = startedAt + durationMinutes`.
7. Change invitation from `PENDING` to `ACCEPTED`.

### Timer enforcement

The server is authoritative.

For every answer update and final submit:
- Load attempt.
- Verify `status === IN_PROGRESS`.
- Compare current server time with `expiresAt`.
- If expired, mark `EXPIRED` or auto-submit according to the chosen policy.

Recommended simple policy:
- If the first request arrives after expiry, transactionally finalize the attempt as expired/submitted using existing saved answers.
- Reject further edits.

Never trust a client-provided timer.

---

## 9. Evaluation and Scoring Rules

### MCQ

MCQ answers can be auto-scored at final submission.

- Correct selection -> full problem points.
- Incorrect/no selection -> 0.

### WRITTEN

Manual evaluation by recruiter.

- `manualScore` must be between 0 and maximum points.
- Optional feedback can be saved.

### CODING

MVP evaluation is manual.

- Candidate submits source code as text.
- Recruiter assigns score and feedback.
- Automatic code execution is explicitly out of the MVP unless safely sandboxed.

### Final result

An attempt becomes fully evaluated only when every problem has a final score.

```text
totalScore = sum(answer.finalScore)
maxScore = sum(assessment problem points)
percentage = maxScore > 0 ? totalScore / maxScore * 100 : 0
passed = passingScorePercent != null
  ? percentage >= passingScorePercent
  : null
```

Use a database transaction when completing evaluation and writing aggregate result fields.

---

## 10. Payment Business Model

Payment is mandatory for the assignment, so make it part of real project logic.

### Model

Recruiters purchase **assessment credits** for their company.

Example packages:

```text
Starter: 10 credits
Growth: 50 credits
Pro: 100 credits
```

One candidate invitation consumes **1 credit** when the invitation is successfully created.

### Payment flow

```text
Recruiter -> POST /payments/checkout
          -> Stripe Checkout Session
          -> User pays on Stripe
          -> Stripe webhook hits backend
          -> Backend verifies webhook signature
          -> Payment marked SUCCEEDED
          -> Credits added to company exactly once
```

### Critical payment rules

- Never mark payment successful from a normal client request.
- Stripe webhook is the source of truth for success.
- Verify Stripe signature using webhook secret.
- Webhook processing must be idempotent.
- Credit increment + successful payment update must be in one transaction.
- Store provider IDs and enforce uniqueness where useful.
- Do not grant credits twice if the same webhook is delivered multiple times.

---

## 11. API Response Standard

All success responses:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

All error responses:

```json
{
  "success": false,
  "message": "Something went wrong",
  "errors": []
}
```

For paginated responses:

```json
{
  "success": true,
  "message": "Assessments retrieved successfully",
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

## 12. API Endpoints

Base prefix:

```text
/api/v1
```

### 12.1 Authentication

1. `POST /api/v1/auth/register`
   - Public.
   - Register recruiter or candidate.
   - Admin account should normally come from seed data.

2. `POST /api/v1/auth/login`
   - Public.
   - Return access token + refresh token/session.

3. `POST /api/v1/auth/refresh-token`
   - Public with valid refresh token.
   - Rotate token if implemented.

4. `POST /api/v1/auth/logout`
   - Authenticated.
   - Revoke refresh token/session.

### 12.2 Profile

5. `GET /api/v1/users/me`
   - All authenticated roles.

6. `PATCH /api/v1/users/me`
   - All authenticated roles.
   - Update safe fields only.

### 12.3 Company

7. `POST /api/v1/companies`
   - RECRUITER.
   - Create own company profile.

8. `GET /api/v1/companies/me`
   - RECRUITER.

9. `PATCH /api/v1/companies/me`
   - RECRUITER.

### 12.4 Problem Bank

10. `POST /api/v1/problems`
    - RECRUITER.

11. `GET /api/v1/problems`
    - RECRUITER.
    - Pagination/search/filter/sort.
    - Example: `?page=1&limit=10&type=MCQ&difficulty=HARD&q=node&sortBy=createdAt&sortOrder=desc`

12. `GET /api/v1/problems/:id`
    - RECRUITER owner.

13. `PATCH /api/v1/problems/:id`
    - RECRUITER owner.

14. `DELETE /api/v1/problems/:id`
    - RECRUITER owner.
    - Soft delete.

### 12.5 Assessments

15. `POST /api/v1/assessments`
    - RECRUITER.

16. `GET /api/v1/assessments`
    - RECRUITER.
    - Pagination/filter/sort/search.

17. `GET /api/v1/assessments/:id`
    - RECRUITER owner; admin may inspect.

18. `PATCH /api/v1/assessments/:id`
    - RECRUITER owner.
    - Restrict modifications based on status.

19. `DELETE /api/v1/assessments/:id`
    - RECRUITER owner.
    - Soft delete, normally only while DRAFT.

20. `POST /api/v1/assessments/:id/problems`
    - RECRUITER owner.
    - Attach one or more problems.

21. `DELETE /api/v1/assessments/:id/problems/:problemId`
    - RECRUITER owner.
    - DRAFT only.

22. `PATCH /api/v1/assessments/:id/problems/reorder`
    - RECRUITER owner.
    - DRAFT only.

23. `POST /api/v1/assessments/:id/publish`
    - RECRUITER owner.

24. `POST /api/v1/assessments/:id/close`
    - RECRUITER owner.

25. `POST /api/v1/assessments/:id/archive`
    - RECRUITER owner.

### 12.6 Invitations

26. `POST /api/v1/assessments/:id/invitations`
    - RECRUITER owner.
    - Requires at least 1 company credit.
    - Consume credit and create invitation transactionally.

27. `GET /api/v1/assessments/:id/invitations`
    - RECRUITER owner.
    - Pagination/filtering.

28. `POST /api/v1/invitations/:id/revoke`
    - RECRUITER owner.

29. `GET /api/v1/invitations/me`
    - CANDIDATE.
    - Candidate invitation history.

30. `GET /api/v1/invitations/:token`
    - CANDIDATE.
    - Return safe assessment summary when token is valid.

### 12.7 Attempts & Candidate Answers

31. `POST /api/v1/invitations/:token/start`
    - CANDIDATE.
    - Starts attempt transactionally.

32. `GET /api/v1/attempts/:id`
    - Candidate owner or recruiter assessment owner.
    - Candidate version must hide correct answers/evaluation internals while attempt is active.

33. `PUT /api/v1/attempts/:id/answers/:problemId`
    - CANDIDATE owner.
    - Upsert saved answer while attempt is active.

34. `POST /api/v1/attempts/:id/submit`
    - CANDIDATE owner.
    - Finalize atomically.
    - Auto-score MCQ answers.

35. `GET /api/v1/attempts/me`
    - CANDIDATE.
    - Assessment attempt history with pagination.

### 12.8 Evaluation & Results

36. `GET /api/v1/assessments/:id/submissions`
    - RECRUITER owner.
    - Candidate attempts/submission overview.

37. `GET /api/v1/attempts/:id/evaluation`
    - RECRUITER owner.
    - Full answers and scoring state.

38. `PATCH /api/v1/attempts/:id/answers/:answerId/evaluate`
    - RECRUITER owner.
    - Manual score + feedback.

39. `POST /api/v1/attempts/:id/finalize-evaluation`
    - RECRUITER owner.
    - Verify all answers scored, calculate totals, mark EVALUATED.

40. `GET /api/v1/attempts/:id/result`
    - Candidate owner according to result visibility policy; recruiter owner always allowed.

41. `GET /api/v1/assessments/:id/report`
    - RECRUITER owner.
    - Aggregate report: invited, started, submitted, evaluated, average score, pass rate.

### 12.9 Payments

42. `POST /api/v1/payments/checkout`
    - RECRUITER.
    - Create Stripe session/payment intent for a supported credit package.

43. `POST /api/v1/payments/webhook`
    - Public endpoint called by Stripe.
    - Raw body handling if required by Stripe SDK.
    - Verify webhook signature.

44. `GET /api/v1/payments`
    - RECRUITER.
    - Own company payment history.

45. `GET /api/v1/payments/:id`
    - RECRUITER owner or ADMIN.

### 12.10 Admin

46. `GET /api/v1/admin/users`
    - ADMIN.
    - Pagination, role/status filtering, search, sorting.

47. `PATCH /api/v1/admin/users/:id/status`
    - ADMIN.
    - Suspend/reactivate.

48. `GET /api/v1/admin/dashboard-stats`
    - ADMIN.

49. `GET /api/v1/admin/audit-logs`
    - ADMIN.
    - Pagination/filtering by actor/action/entity/date.

50. `GET /api/v1/admin/payments`
    - ADMIN.
    - Platform payment overview.

This provides significantly more than the required 20 meaningful endpoints.

---

## 13. Recommended Request Examples

### Create MCQ problem

```json
{
  "title": "HTTP status for successful creation",
  "description": "Which HTTP status code is most appropriate after creating a resource?",
  "type": "MCQ",
  "difficulty": "EASY",
  "points": 5,
  "tags": ["http", "rest"],
  "options": [
    { "text": "200", "isCorrect": false },
    { "text": "201", "isCorrect": true },
    { "text": "204", "isCorrect": false },
    { "text": "400", "isCorrect": false }
  ]
}
```

### Create assessment

```json
{
  "title": "Junior Backend Engineer Assessment",
  "description": "Backend fundamentals screening",
  "instructions": "Complete all questions without outside assistance.",
  "durationMinutes": 60,
  "passingScorePercent": 70,
  "resultVisibility": "AFTER_REVIEW"
}
```

### Invite candidate

```json
{
  "candidateEmail": "candidate@example.com",
  "expiresAt": "2026-09-10T18:00:00.000Z"
}
```

### Save written answer

```json
{
  "writtenAnswer": "A database transaction ensures a group of operations succeeds or fails atomically."
}
```

### Manual evaluation

```json
{
  "score": 8,
  "feedback": "Good answer, but mention isolation and rollback behavior."
}
```

---

## 14. Validation Rules

Use Zod for all applicable route params, query params, and request bodies.

Examples:

### Auth
- email must be valid.
- password minimum 8 characters.
- password should have reasonable complexity.
- public registration allows only `RECRUITER` or `CANDIDATE`, never `ADMIN`.

### Problem
- title required.
- description required.
- points integer > 0.
- MCQ must contain at least 2 options.
- MCQ should have exactly one correct answer for MVP.
- non-MCQ problems must not contain MCQ options.

### Assessment
- duration between 5 and 300 minutes.
- passing score between 0 and 100 when provided.
- `endsAt > startsAt` when both exist.

### Invitation
- valid email.
- expiry must be in future.

### Evaluation
- score >= 0.
- score <= problem maximum points.

### Pagination

Defaults:

```text
page=1
limit=10
max limit=100
sortOrder=desc
```

---

## 15. Authentication Architecture

### Passwords

- Hash with bcrypt.
- Never store or log raw passwords.
- Never return password hash from Prisma queries.

### Access token

Short-lived JWT, e.g. 15 minutes.

Payload should contain minimal identity information:

```json
{
  "sub": "user-id",
  "role": "RECRUITER"
}
```

### Refresh token

Recommended lifetime: 7–30 days.

Store a hashed token or server-side session identifier so logout/revocation is possible.

### Middleware

Recommended middleware:

```text
authenticate()
authorize(...roles)
validateRequest(schema)
requestId()
rateLimiter()
errorHandler()
```

---

## 16. Authorization / Ownership Rules

RBAC alone is not enough. Also enforce resource ownership.

Examples:

- A recruiter cannot read another company's private problems.
- A recruiter cannot evaluate an attempt from another company's assessment.
- A candidate cannot load another candidate's attempt/result.
- A candidate must never receive MCQ correctness information before submission.
- Admin endpoints are inaccessible to recruiter/candidate roles.

Create reusable service/helper checks such as:

```text
assertCompanyOwner(userId, companyId)
assertAssessmentOwner(userId, assessmentId)
assertAttemptCandidate(userId, attemptId)
assertAttemptAssessmentOwner(userId, attemptId)
```

---

## 17. Transaction Requirements

Use Prisma `$transaction` for these critical flows.

### Required transaction 1: invitation creation

- Verify assessment is published.
- Verify company has credit.
- Decrement one credit.
- Create invitation.
- Create audit log.

No credit should be lost if invitation creation fails.

### Required transaction 2: start attempt

- Verify invitation.
- Prevent duplicate attempt.
- Create attempt.
- Mark invitation accepted.

### Required transaction 3: final submission

- Verify timer/status.
- Freeze attempt.
- Calculate MCQ scores.
- Mark submitted.
- Write audit event if desired.

### Required transaction 4: payment webhook

- Verify payment has not already succeeded.
- Mark payment succeeded.
- Add purchased credits.
- Add audit log.

### Required transaction 5: finalize evaluation

- Verify all answers scored.
- Calculate final score.
- Calculate percentage/pass state.
- Mark attempt evaluated.

---

## 18. Database Indexes

At minimum consider indexes on:

```text
User.email UNIQUE
User.role
User.status
Company.ownerId
Company.slug UNIQUE
Problem.companyId
Problem.type
Problem.difficulty
Problem.deletedAt
Assessment.companyId
Assessment.status
Assessment.createdAt
Invitation.token UNIQUE
Invitation.assessmentId
Invitation.candidateEmail
Invitation.status
Attempt.assessmentId
Attempt.candidateId
Attempt.status
Answer.attemptId
Payment.companyId
Payment.status
Payment.providerSessionId UNIQUE when present
AuditLog.actorId
AuditLog.entityType + entityId
AuditLog.createdAt
```

Use composite unique constraints where specified.

---

## 19. Security Requirements

Mandatory:

1. `helmet()`.
2. Explicit CORS allowlist in production.
3. `express-rate-limit` globally and stricter limit for login/register.
4. Password hashing with bcrypt.
5. JWT secret from environment variable.
6. Stripe keys/webhook secret from environment variables.
7. Never return secrets, hashes, correct MCQ answers, internal payment metadata, or private tokens unnecessarily.
8. Validate all untrusted input.
9. Avoid mass assignment; explicitly select fields to update.
10. Use Prisma parameterized queries; avoid unsafe raw SQL.
11. Central error handler; do not expose stack traces in production.
12. Validate authorization at both role and resource ownership levels.
13. Limit request body size.
14. Use cryptographically strong invitation tokens.
15. Do not trust client-provided attempt timestamps or scores.

Optional hardening:
- Redis-backed rate limiter.
- Refresh-token reuse detection.
- Login audit trail.
- Suspicious attempt activity events.

---

## 20. Anti-Cheating Scope

Implement lightweight backend anti-cheating signals only.

Possible fields/events:
- attempt start IP.
- user agent.
- answer update timestamps.
- number of answer changes.
- submission timestamp.
- attempt expiry enforcement.

Optional endpoint/events can record client-side signals later, but no frontend is required.

Do not overbuild browser monitoring for this assignment.

---

## 21. Audit Log Actions

Suggested actions:

```text
USER_REGISTERED
USER_LOGIN
USER_STATUS_CHANGED
COMPANY_CREATED
COMPANY_UPDATED
PROBLEM_CREATED
PROBLEM_UPDATED
PROBLEM_DELETED
ASSESSMENT_CREATED
ASSESSMENT_UPDATED
ASSESSMENT_PUBLISHED
ASSESSMENT_CLOSED
ASSESSMENT_ARCHIVED
CANDIDATE_INVITED
INVITATION_REVOKED
ATTEMPT_STARTED
ATTEMPT_SUBMITTED
ANSWER_EVALUATED
EVALUATION_FINALIZED
PAYMENT_CREATED
PAYMENT_SUCCEEDED
PAYMENT_FAILED
```

Audit logging should not cause the main operation to expose sensitive data.

---

## 22. Suggested Folder Structure

```text
src/
  app.ts
  server.ts

  config/
    env.ts
    prisma.ts
    stripe.ts

  constants/
    index.ts

  middlewares/
    authenticate.ts
    authorize.ts
    validateRequest.ts
    rateLimit.ts
    notFound.ts
    errorHandler.ts

  modules/
    auth/
      auth.controller.ts
      auth.service.ts
      auth.route.ts
      auth.validation.ts
      auth.types.ts

    user/
      user.controller.ts
      user.service.ts
      user.route.ts
      user.validation.ts

    company/
    problem/
    assessment/
    invitation/
    attempt/
    evaluation/
    payment/
    admin/
    audit/

  routes/
    index.ts

  utils/
    apiResponse.ts
    asyncHandler.ts
    jwt.ts
    password.ts
    pagination.ts
    errors.ts
    invitationToken.ts

  types/
    express.d.ts

prisma/
  schema.prisma
  seed.ts

postman/
  Developer-Assessment-Platform.postman_collection.json
  local.postman_environment.json

.env.example
.gitignore
README.md
package.json
tsconfig.json
```

Use a consistent module pattern:

```text
route -> middleware -> controller -> service -> Prisma
```

Controllers should stay thin. Business rules belong in services.

---

## 23. Error Handling

Create typed application errors.

Suggested classes/codes:

```text
BadRequestError       -> 400
UnauthorizedError     -> 401
ForbiddenError        -> 403
NotFoundError         -> 404
ConflictError         -> 409
TooManyRequests       -> 429
InternalServerError   -> 500
```

Zod errors should become structured field errors.

Example:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email address"
    }
  ]
}
```

---

## 24. Environment Variables

Create `.env.example` with placeholders only.

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

Never commit `.env`.

---

## 25. Seed Data

Seed at least:

- 1 admin user.
- 1 recruiter.
- 1 candidate.
- 1 recruiter company with some development credits.
- 3–5 sample problems.
- 1 draft assessment.

Use obvious non-production demo credentials and document them in README only for evaluator testing.

---

## 26. Testing Strategy

Minimum test through Postman even if automated tests are limited.

### Authentication tests
- Register recruiter.
- Register candidate.
- Duplicate email rejected.
- Invalid password rejected.
- Login works.
- Wrong password rejected.
- Refresh works.
- Logout/revocation works.

### RBAC tests
- Candidate cannot create assessment.
- Recruiter cannot access admin users.
- Recruiter A cannot access Recruiter B assessment.
- Candidate A cannot access Candidate B attempt.

### Assessment tests
- Cannot publish empty assessment.
- Add problem to draft.
- Publish valid assessment.
- Cannot destructively edit published assessment.
- Close assessment.

### Invitation tests
- Cannot invite without credit.
- Invite consumes exactly one credit.
- Duplicate active invitation handled safely.
- Expired/revoked invitation cannot start.

### Attempt tests
- Candidate starts once.
- Duplicate start rejected.
- Candidate can save answers before expiry.
- Candidate cannot edit after submission.
- Timer enforced by server.

### Evaluation tests
- MCQ auto-scored correctly.
- Recruiter can score written/coding answer.
- Score above max rejected.
- Finalization rejected until all required manual scores exist.
- Final percentage/pass state correct.

### Payment tests
- Checkout endpoint creates real Stripe test-mode session/intent.
- Invalid webhook signature rejected.
- Successful webhook grants credits.
- Replayed webhook does not grant credits twice.

### General tests
- Pagination.
- Search.
- Filtering.
- Sorting.
- Soft delete.
- Rate limiting.
- Structured validation errors.
- 404 handler.

---

## 27. Postman Collection Organization

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

Environment variables:

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

Add example success and error responses for important endpoints.

---

## 28. Five-Day Implementation Plan

### Day 1 — Planning, Setup, Database

Deliverables:
- Project initialized.
- TypeScript + Express configured.
- PostgreSQL + Prisma connected.
- Final Prisma schema.
- First migration.
- Seed script.
- Global response/error foundation.
- ERD exported or documented.
- API route list finalized.
- Initial Render service created if possible.

Suggested commits:

```text
chore: initialize typescript express project
chore: configure prisma and environment validation
feat: add initial database schema and migration
feat: add seed data for demo roles
```

### Day 2 — Auth, RBAC, Profiles, Core CRUD

Deliverables:
- Register/login/refresh/logout.
- bcrypt + JWT.
- authentication middleware.
- role authorization middleware.
- profile APIs.
- company APIs.
- problem-bank CRUD.
- assessment basic CRUD.

Suggested commits:

```text
feat: implement jwt authentication flow
feat: add role based authorization middleware
feat: add user profile endpoints
feat: add recruiter company module
feat: add problem bank crud
feat: add assessment crud
```

### Day 3 — Main Business Workflow

Deliverables:
- Attach/reorder assessment problems.
- Publish/close/archive workflow.
- Invitations.
- Credit consumption transaction.
- Candidate attempt start.
- Timed answer saving.
- Submission.
- MCQ auto-scoring.
- Manual evaluation.
- Result and assessment report.
- Pagination/filtering/search/sorting.
- Audit logs.

Suggested commits:

```text
feat: implement assessment lifecycle
feat: add candidate invitation workflow
feat: implement transactional attempt start
feat: add timed answer submission flow
feat: implement evaluation and scoring
feat: add assessment reporting
feat: add audit logging
```

### Day 4 — Payment, Security, Testing, Docs

Deliverables:
- Stripe checkout/payment creation.
- Stripe webhook signature verification.
- Idempotent credit grant.
- Payment history.
- Helmet/CORS/rate limiting.
- Postman collection finalized.
- Edge-case testing.

Suggested commits:

```text
feat: integrate stripe checkout
feat: add secure stripe webhook handling
feat: add company credit purchase flow
security: add helmet cors and rate limiting
fix: handle assessment and attempt edge cases
 docs: complete postman api collection
```

### Day 5 — Deployment and Submission

Deliverables:
- Production env configured.
- Production migration applied.
- Backend deployed.
- Live API smoke-tested.
- README completed.
- Demo credentials created.
- 20+ meaningful commits.
- 3–5 minute walkthrough recorded.

Suggested commits:

```text
chore: configure production deployment
fix: resolve production api issues
docs: finalize project readme
docs: add deployment and testing instructions
```

---

## 29. README Requirements

Final `README.md` should contain:

1. Project title.
2. Short project description.
3. Live API URL.
4. Repository URL.
5. Demo credentials for ADMIN / RECRUITER / CANDIDATE.
6. Tech stack.
7. Core features.
8. Role permissions.
9. ERD image/link.
10. Local installation steps.
11. Environment variables.
12. Prisma migration/seed commands.
13. How to run development server.
14. Postman collection link/file.
15. Payment test instructions.
16. Important API endpoints.
17. Video walkthrough link.

---

## 30. Definition of Done

The project is complete only if all of these are true:

- [ ] Exactly 3 roles exist: ADMIN, RECRUITER, CANDIDATE.
- [ ] 20+ meaningful endpoints are implemented.
- [ ] All protected endpoints require Bearer authentication.
- [ ] Role and resource ownership checks are enforced.
- [ ] Passwords are hashed.
- [ ] Zod validates applicable inputs.
- [ ] Global structured success/error response format is used.
- [ ] At least one list endpoint supports pagination.
- [ ] Filtering and sorting are implemented.
- [ ] Search is implemented.
- [ ] Soft deletes are implemented.
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
- [ ] Helmet is enabled.
- [ ] CORS is configured.
- [ ] Rate limiting is enabled.
- [ ] Postman collection documents the API.
- [ ] Backend is deployed.
- [ ] Live production flows are tested.
- [ ] README is complete.
- [ ] Git history contains 20+ meaningful commits.

---

# 31. Instructions for the AI Coding Assistant

Use the rest of this document as the authoritative project specification.

## AI operating rules

When implementing this project:

1. Work **phase by phase**. Do not generate the entire project blindly in one response.
2. Before each phase, inspect the existing repository/files and do not overwrite working code unnecessarily.
3. Preserve the architecture and naming conventions already established.
4. Use TypeScript strictness; avoid `any` unless absolutely required and explained.
5. Put business logic in service files, not controllers.
6. Use Prisma transactions for the workflows explicitly marked transactional in this document.
7. Use Zod validation for bodies/params/queries.
8. Use a centralized error handler.
9. Use the standard success/error response shape everywhere.
10. Never expose password hashes, refresh tokens, Stripe secrets, invitation internals, or MCQ correct answers to unauthorized clients.
11. Enforce both role permissions and resource ownership.
12. Never trust client-submitted score, start time, expiry time, role, company ID, or payment status.
13. Use real Stripe test mode and webhook signature verification. Never fake payment success.
14. Prefer readable maintainable code over unnecessary abstractions.
15. Do not implement unsafe arbitrary code execution for coding problems in the MVP.
16. After each phase:
    - run TypeScript build/type-check;
    - run lint/format if configured;
    - run relevant tests or provide Postman test steps;
    - list files added/changed;
    - list environment variables added;
    - give the exact next command(s) to run;
    - suggest one meaningful Git commit message.
17. Do not proceed to a later phase if the current phase has unresolved compile/runtime errors.
18. If a requirement conflicts with implementation convenience, follow this specification and assignment requirements.

---

# 32. Step-by-Step AI Build Prompts

Use the following prompts sequentially with an AI coding assistant. Give the AI this full `PROJECT_SPEC.md` first, then use one prompt at a time.

## Prompt 1 — Bootstrap

```text
Read PROJECT_SPEC.md completely and treat it as the source of truth.

Implement only Phase 1A: project bootstrap.

Tasks:
- Initialize/verify Node.js + TypeScript + Express setup.
- Configure strict TypeScript.
- Configure scripts for dev, build, start, lint/format if applicable.
- Add environment validation.
- Create src/app.ts and src/server.ts.
- Add helmet, CORS, JSON parsing, request size limit, global API prefix, health endpoint, not-found handler, and centralized error-handler foundation.
- Create the module/folder structure from the specification.
- Do not implement domain modules yet.

After coding, run type-check/build and report:
1. files changed,
2. commands to run,
3. required env vars,
4. verification steps,
5. one Git commit message.
```

## Prompt 2 — Prisma Schema

```text
Using PROJECT_SPEC.md, implement only Phase 1B: PostgreSQL/Prisma data model.

Tasks:
- Configure Prisma.
- Implement all required models, enums, relations, unique constraints, soft-delete fields, and indexes.
- Keep the schema practical for the MVP.
- Add the first migration.
- Add a seed script containing one admin, one recruiter, one candidate, a company, sample problems, and a draft assessment.
- Never store plain passwords in seed data; hash them.

Run Prisma validation and TypeScript checks. Then explain the ERD in concise text and provide the next commands and one commit message.
```

## Prompt 3 — Auth and RBAC

```text
Implement only authentication and authorization from PROJECT_SPEC.md.

Required APIs:
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh-token
POST /api/v1/auth/logout
GET /api/v1/users/me
PATCH /api/v1/users/me

Requirements:
- bcrypt password hashing.
- JWT access token.
- Revocable/rotatable refresh-token strategy backed by the database.
- Bearer authentication middleware.
- authorize(...roles) middleware.
- Zod validation.
- Standard API response format.
- Public registration must never create ADMIN.
- Suspended users cannot authenticate to protected operations.
- Safe Prisma selects; never return passwordHash.
- Appropriate auth rate limiting.

Test happy paths and failure cases and give Postman examples plus one commit message.
```

## Prompt 4 — Company and Problem Bank

```text
Implement the recruiter company and problem-bank modules from PROJECT_SPEC.md.

Required APIs:
POST /api/v1/companies
GET /api/v1/companies/me
PATCH /api/v1/companies/me
POST /api/v1/problems
GET /api/v1/problems
GET /api/v1/problems/:id
PATCH /api/v1/problems/:id
DELETE /api/v1/problems/:id

Requirements:
- RECRUITER-only company/problem writes.
- Resource ownership checks.
- Soft delete problems.
- MCQ type-specific validation including options and exactly one correct answer.
- Pagination/search/filter/sort on GET /problems.
- Never expose correct MCQ answers through candidate-facing data later; structure services accordingly.
- Add audit logs for important writes.

Run type-check and provide Postman test steps and one commit message.
```

## Prompt 5 — Assessment Lifecycle

```text
Implement assessment management and lifecycle exactly as PROJECT_SPEC.md defines.

Required APIs:
POST /api/v1/assessments
GET /api/v1/assessments
GET /api/v1/assessments/:id
PATCH /api/v1/assessments/:id
DELETE /api/v1/assessments/:id
POST /api/v1/assessments/:id/problems
DELETE /api/v1/assessments/:id/problems/:problemId
PATCH /api/v1/assessments/:id/problems/reorder
POST /api/v1/assessments/:id/publish
POST /api/v1/assessments/:id/close
POST /api/v1/assessments/:id/archive

Requirements:
- Strict ownership enforcement.
- Draft/published/closed/archived state-transition rules.
- Publishing validation: at least one problem, valid duration, positive points.
- Prevent destructive edits after publication.
- Soft delete where specified.
- Pagination/filter/search/sort on assessment list.
- Transactions where a multi-write operation must be atomic.
- Audit lifecycle changes.

Run verification and provide Postman sequence and one commit message.
```

## Prompt 6 — Invitations and Credits

```text
Implement candidate invitation workflow from PROJECT_SPEC.md.

Required APIs:
POST /api/v1/assessments/:id/invitations
GET /api/v1/assessments/:id/invitations
POST /api/v1/invitations/:id/revoke
GET /api/v1/invitations/me
GET /api/v1/invitations/:token

Requirements:
- Only published assessments can invite.
- Generate secure invitation tokens.
- Enforce expiration/revocation.
- Candidate email validation.
- Prevent unsafe duplicate active invitations.
- Creating an invitation consumes exactly 1 company assessment credit.
- Credit decrement + invitation creation + audit log must be transactional.
- Never allow negative credits under concurrent requests.
- Candidate-facing invitation/assessment response must not reveal correct MCQ answers.
- Optional invitation email can be added only after core behavior works.

Create tests for concurrent/duplicate scenarios where practical. Provide Postman test sequence and one commit message.
```

## Prompt 7 — Timed Attempts and Submission

```text
Implement timed candidate attempts and answers from PROJECT_SPEC.md.

Required APIs:
POST /api/v1/invitations/:token/start
GET /api/v1/attempts/:id
PUT /api/v1/attempts/:id/answers/:problemId
POST /api/v1/attempts/:id/submit
GET /api/v1/attempts/me

Requirements:
- Server time is authoritative.
- Starting attempt must be transactional and prevent duplicate attempts.
- expiresAt is calculated on the server from assessment duration.
- Candidate may update only own active attempt.
- Upsert one answer per attempt/problem.
- Reject answers to problems not in the assessment.
- Reject edits after expiration/submission.
- Final submission freezes attempt atomically.
- Auto-score MCQ answers without exposing correct options.
- Written/coding answers remain pending manual review.
- Never execute candidate code on the main server.

Test attempts before/after expiry and duplicate starts. Give Postman steps and one commit message.
```

## Prompt 8 — Evaluation, Result and Reports

```text
Implement recruiter evaluation and reporting from PROJECT_SPEC.md.

Required APIs:
GET /api/v1/assessments/:id/submissions
GET /api/v1/attempts/:id/evaluation
PATCH /api/v1/attempts/:id/answers/:answerId/evaluate
POST /api/v1/attempts/:id/finalize-evaluation
GET /api/v1/attempts/:id/result
GET /api/v1/assessments/:id/report

Requirements:
- Recruiter ownership checks for every assessment/attempt.
- Manual score validation against max points.
- MCQ score cannot be maliciously overwritten unless there is an explicit admin override, which is not required for MVP.
- Finalize only when all answers have final scores.
- Calculate totalScore, percentage, and passed atomically.
- Enforce resultVisibility for candidates.
- Assessment report should include invitation count, started count, submitted/evaluated counts, average score, and pass rate where meaningful.
- Add relevant audit logs.

Run verification and provide Postman workflow and one commit message.
```

## Prompt 9 — Stripe Payment

```text
Implement the mandatory real Stripe test-mode payment integration from PROJECT_SPEC.md.

Required APIs:
POST /api/v1/payments/checkout
POST /api/v1/payments/webhook
GET /api/v1/payments
GET /api/v1/payments/:id

Business model:
- Recruiters buy assessment-credit packages.
- Use a server-controlled allowlist of packages/prices/credit amounts. Never trust an amount or credit count sent by the client.
- Create a Payment row in PENDING state before/while creating the Stripe session as appropriate.
- Stripe webhook is the source of truth for payment success.
- Verify webhook signature.
- Make webhook processing idempotent.
- On first successful event only: mark Payment SUCCEEDED and add purchased credits to Company in one Prisma transaction.
- Replayed webhook must not add credits again.
- Store provider identifiers.

Add exact local webhook testing instructions using Stripe CLI if available, plus Postman/payment verification steps and one commit message.
```

## Prompt 10 — Admin, Audit and Security Pass

```text
Implement admin endpoints and perform the security/performance pass from PROJECT_SPEC.md.

Required APIs:
GET /api/v1/admin/users
PATCH /api/v1/admin/users/:id/status
GET /api/v1/admin/dashboard-stats
GET /api/v1/admin/audit-logs
GET /api/v1/admin/payments

Then verify:
- helmet
- CORS allowlist
- global and auth rate limiting
- body size limit
- no production stack trace leakage
- soft-delete filters
- Prisma indexes
- efficient selects/includes
- no secret/correct-answer leakage
- ownership authorization
- structured errors everywhere
- pagination/filtering/search/sorting

Run lint/build and provide a security checklist with pass/fail findings and one commit message.
```

## Prompt 11 — Postman and Final QA

```text
Perform final QA according to PROJECT_SPEC.md.

Tasks:
- Build/update a complete Postman collection organized by module.
- Add environment variables for baseUrl and the three role tokens.
- Add example requests for all major workflows.
- Verify at least 20 meaningful endpoints manually.
- Test unauthorized, forbidden, validation, conflict, not-found, expired attempt, duplicate invitation, duplicate webhook, and suspended-user cases.
- Fix discovered backend bugs without changing the core specification.
- Run final TypeScript build/lint.

Produce a QA report that lists every endpoint tested, expected result, actual result, and unresolved issue if any. Suggest one commit message.
```

## Prompt 12 — README and Deployment

```text
Prepare this project for submission using PROJECT_SPEC.md.

Tasks:
- Create/finalize README.md with project overview, features, roles, tech stack, API base URL, local setup, environment variables, migration/seed steps, demo credentials, Postman instructions, Stripe test-mode instructions, and deployment details.
- Verify .env is ignored and .env.example contains no real secrets.
- Configure Render deployment and production start/build scripts.
- Explain production Prisma migration procedure.
- Run a final smoke test against the deployed API if deployment access is available.
- Check the repository for accidental secrets and generated junk files.
- Give a final assignment submission checklist and a suggested 3–5 minute walkthrough script.

Do not invent deployment URLs or successful test results. Report only what is actually verified.
```

---

# 33. AI Review Prompt for Any Phase

If a phase is implemented but quality is uncertain, use:

```text
Review the current repository against PROJECT_SPEC.md for the modules already implemented.

Do not rewrite the project from scratch.

Check specifically for:
- authorization bypasses,
- missing ownership checks,
- race conditions,
- missing Prisma transactions,
- incorrect assessment state transitions,
- timer trust issues,
- correct-answer leakage,
- mass assignment,
- poor Zod validation,
- inconsistent response formats,
- soft-delete mistakes,
- unsafe payment logic,
- duplicate webhook credit grants,
- N+1 or unnecessarily large Prisma queries,
- missing indexes,
- TypeScript errors.

Fix confirmed issues, run verification commands, and report each change with its reason.
```

---

# 34. Features Explicitly Out of MVP Scope

Do not spend assignment time on these until all required items are complete:

- Full frontend dashboard.
- Live collaborative coding.
- Video proctoring.
- Browser-lockdown system.
- AI plagiarism detection.
- Production-grade compiler/judge infrastructure.
- Multi-recruiter company membership system.
- Complex subscription billing with recurring invoices.
- Multiple assessment attempts per invitation.
- Real-time WebSocket monitoring.

These may be listed as future improvements.

---

# 35. Final Architecture Principles

Keep the implementation focused on these principles:

1. **Correctness before feature count.**
2. **Three roles only.**
3. **Server-authoritative security and timing.**
4. **Transactions for race-sensitive workflows.**
5. **Webhook-authoritative payment state.**
6. **Strict ownership authorization.**
7. **No correct-answer leakage.**
8. **No unsafe candidate code execution.**
9. **Consistent validation and responses.**
10. **Every important flow demonstrable in Postman.**

If the project implements everything in this specification cleanly, it will satisfy the provided assignment requirements while remaining realistic enough to demonstrate backend architecture, security, relational modeling, transactions, payments, and business logic.
