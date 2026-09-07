# Developer Assessment & Coding Platform

A backend-focused assessment and coding platform for companies, recruiters, evaluators, and candidates. The platform allows companies to create assessments, manage problem banks, invite candidates, conduct timed assessments, evaluate submissions, and generate candidate reports.

## Project Category

**Education / Recruitment**

## Project Overview

The Developer Assessment & Coding Platform helps companies evaluate candidates through structured online assessments.

Companies can create assessments by selecting problems from a problem bank, invite candidates, monitor assessment attempts, evaluate submissions, and view candidate scores and reports.

Candidates can access invited assessments, answer MCQ, written, and coding questions, submit their attempts, and view their results when evaluation is completed.

## Core Workflow

```text
Company
   │
   ▼
Create Assessment
   │
   ▼
Add Problems
   │
   ▼
Invite Candidates
   │
   ▼
Candidate Attempts
   │
   ▼
Submission
   │
   ▼
Evaluation
   │
   ▼
Score
   │
   ▼
Company Report
Possible Users

Candidate

Company

Recruiter

Assessment Creator

Evaluator

Admin

Main Features
Authentication and Authorization

User registration and login

JWT-based authentication

Role-based authorization

Candidate, company, evaluator, and admin permissions

Password management

Protected routes

Company Management

Create and update company profiles

View company information

Manage company members

Assign assessment creators and evaluators

View company assessment history

Candidate Management

Create candidate profiles

Update candidate information

View candidate assessment history

View completed assessment results

Track candidate performance

Problem Bank

Create problems

Update problems

Delete or archive problems

View problem details

Filter problems by type and difficulty

Add problem tags

Manage MCQ options

Mark correct MCQ options

Support different problem types

Supported problem types may include:

Multiple-choice questions

Written questions

Coding questions

Assessment Management

Create assessments

Update assessment details

Add or remove problems

Configure assessment duration

Configure passing score

Publish or deactivate assessments

View assessment details

Manage assessment lifecycle

Candidate Invitations

Invite candidates to assessments

Generate unique invitation records

Set invitation status

Track invitation expiry

Accept or reject invitations

Prevent unauthorized assessment access

Timed Attempts

Start an assessment attempt

Track start time

Track expiry time

Save answers

Update previously saved answers

Prevent editing after submission

Automatically expire attempts

Submit completed attempts

Submission

Submit MCQ answers

Submit written answers

Submit coding answers

Validate attempt ownership

Prevent duplicate submissions

Store submission time

Lock an attempt after submission

Evaluation

Automatically evaluate MCQ answers

Manually evaluate written answers

Support coding evaluation

Store evaluator scores

Add evaluator feedback

Track evaluation status

Recalculate final scores

Results

View candidate results

Display total score

Display percentage

Display pass or fail status

Display evaluator feedback

Hide correct answers before submission

Show evaluated results after evaluation

Company Reports

View assessment performance

View candidate scores

Compare candidates

Filter candidates by result

View passed and failed candidates

View assessment history

Export reports in the future

Subscription and Payment

Payment is an optional business feature for companies that want to use premium assessment functionality.

Possible features include:

View subscription plans

Subscribe to a plan

Upgrade or downgrade a plan

Track subscription status

View payment history

Handle successful and failed payments

Generate invoices

Limit assessments based on subscription

Limit the number of candidates

Enable premium features

The payment workflow may follow this structure:

Company
   │
   ▼
Choose Subscription Plan
   │
   ▼
Create Payment Session
   │
   ▼
Payment Gateway
   │
   ▼
Payment Verification
   │
   ▼
Activate Subscription
   │
   ▼
Access Paid Features
Anti-Cheating Features

Possible future features:

Disable copy and paste

Detect tab switching

Track suspicious activity

Prevent multiple active attempts

Record assessment activity

Detect unusual submission behavior

Restrict assessment access by time

Monitor candidate session information

Analytics

Assessment completion rate

Candidate pass rate

Average score

Problem success rate

Candidate performance history

Assessment participation statistics

Company-level analytics

Backend Challenges

This project includes several important backend engineering challenges:

Assessment lifecycle management

Secure candidate invitation handling

Role-based permission management

Candidate ownership validation

Timed attempt management

Automatic attempt expiry

Secure answer submission

Idempotent answer updates

Automatic and manual evaluation

Score calculation

Transaction management

Payment verification

Subscription access control

Rate limiting

Secure coding execution

Report generation

Data consistency

Recommended Modules
src
├── app
│   ├── config
│   ├── common
│   ├── middleware
│   └── routes
│
├── modules
│   ├── auth
│   ├── users
│   ├── companies
│   ├── candidates
│   ├── problems
│   ├── assessments
│   ├── invitations
│   ├── attempts
│   ├── submissions
│   ├── evaluations
│   ├── results
│   ├── reports
│   ├── subscriptions
│   └── payments
│
├── prisma
│   └── schema.prisma
│
└── server.ts
Assessment Lifecycle
DRAFT
   ↓
PUBLISHED
   ↓
IN_PROGRESS
   ↓
SUBMITTED
   ↓
EVALUATED
   ↓
COMPLETED

An assessment may also be:

DRAFT → CANCELLED
PUBLISHED → ARCHIVED
Attempt Lifecycle
IN_PROGRESS
     │
     ├── Candidate submits
     │       ↓
     │   SUBMITTED
     │       ↓
     │   EVALUATED
     │
     └── Time expires
             ↓
          EXPIRED
Evaluation Workflow
Candidate submits attempt
          │
          ▼
System evaluates MCQ answers
          │
          ▼
Written and coding answers require evaluation
          │
          ▼
Evaluator reviews answers
          │
          ▼
Evaluator assigns scores
          │
          ▼
System calculates final result
          │
          ▼
Candidate and company can view results
Suggested Technology Stack
Backend

Node.js

Express.js

TypeScript

Prisma ORM

PostgreSQL

Authentication

JSON Web Token

Password hashing with bcrypt or Argon2

Role-based authorization

Validation

Zod

API Documentation

Swagger/OpenAPI

Testing

Jest

Supertest

Code Quality

ESLint

Prettier

Husky

lint-staged

Development Tools

Git

GitHub

Postman

DBeaver

Docker

Database Entities

The project may contain the following main entities:

User
Company
Problem
ProblemOption
Assessment
AssessmentProblem
Invitation
Attempt
Answer
Evaluation
Result
Plan
Subscription
Payment
Example Entity Relationship
Company
   │
   ├── Problems
   ├── Assessments
   └── Subscriptions

Assessment
   │
   ├── Assessment Problems
   ├── Invitations
   └── Attempts

Invitation
   │
   └── Attempt

Attempt
   │
   ├── Answers
   └── Evaluation

Problem
   │
   ├── Problem Options
   └── Answers
API Modules

Example API route structure:

/api/v1/auth
/api/v1/users
/api/v1/companies
/api/v1/problems
/api/v1/assessments
/api/v1/invitations
/api/v1/attempts
/api/v1/submissions
/api/v1/evaluations
/api/v1/results
/api/v1/reports
/api/v1/subscriptions
/api/v1/payments
Example Attempt Endpoints
GET /api/v1/attempts/me

Returns all attempts belonging to the authenticated candidate.

GET /api/v1/attempts/:id

Returns a specific candidate attempt.

PUT /api/v1/attempts/:id/answers/:problemId

Creates or updates an answer for a specific problem.

POST /api/v1/attempts/:id/submit

Submits an assessment attempt.

GET /api/v1/attempts/:id/result

Returns the evaluated result of an attempt.

Security Requirements

Authenticate all protected routes

Apply role-based authorization

Verify candidate ownership of attempts

Do not expose correct MCQ answers to candidates

Do not allow answers after submission

Validate all request parameters and bodies

Use database transactions for critical operations

Verify payment gateway webhooks

Apply rate limiting to sensitive endpoints

Avoid storing plain-text passwords

Sanitize user-generated content

Restrict access to company data

Log important security events

Payment Security

If payment functionality is implemented:

Never trust payment status from the frontend

Verify payment status on the backend

Validate payment gateway webhook signatures

Store unique transaction IDs

Prevent duplicate payment processing

Use database transactions when activating subscriptions

Keep payment records immutable where possible

Do not store raw card details

Use a trusted payment provider

Future Coding Execution

If coding execution is implemented, submitted code should not run directly inside the main application server.

A safer architecture is:

Candidate submits code
        │
        ▼
Backend creates execution job
        │
        ▼
Isolated execution environment
        │
        ▼
Run code against test cases
        │
        ▼
Collect output and execution status
        │
        ▼
Calculate coding score

Possible isolation technologies may include:

Docker containers

Sandboxed workers

Separate execution services

Resource and time limits

Project Goals

The main goals of this project are to:

Build a real-world recruitment platform

Practice modular backend architecture

Implement secure authentication and authorization

Work with relational database design

Implement assessment and attempt lifecycles

Handle timed submissions

Build automatic and manual evaluation workflows

Generate reports and results

Learn transaction management

Implement subscription and payment workflows

Improve API testing and backend security

Development Roadmap
Phase 1: Project Setup

Initialize Node.js and TypeScript

Configure Express

Configure Prisma

Connect PostgreSQL

Add environment variables

Configure error handling

Configure request validation

Phase 2: Authentication

User registration

User login

JWT authentication

Role-based authorization

Password hashing

Phase 3: Company and Candidate Management

Company profile

Candidate profile

Company member management

User permissions

Phase 4: Problem Bank

Create problems

Update problems

Delete or archive problems

Manage MCQ options

Filter and search problems

Phase 5: Assessment Management

Create assessments

Add problems

Configure duration

Configure passing score

Publish assessments

Phase 6: Invitations

Invite candidates

Accept invitations

Track invitation status

Handle invitation expiry

Phase 7: Attempts and Submission

Start attempts

Save answers

Validate ownership

Handle expiry

Submit attempts

Phase 8: Evaluation

Automatic MCQ evaluation

Manual written evaluation

Coding evaluation

Final score calculation

Phase 9: Results and Reports

Candidate results

Company reports

Assessment history

Performance analytics

Phase 10: Subscription and Payment

Create plans

Subscribe to plans

Integrate payment gateway

Verify payments

Activate subscriptions

Apply usage limits

Phase 11: Advanced Features

Anti-cheating

Coding execution

Advanced analytics

Exportable reports

Notifications

Email integration

Environment Variables

Create a .env file:

NODE_ENV=development
PORT=5000

DATABASE_URL="postgresql://username:password@localhost:5432/assessment_db"

JWT_SECRET="your_jwt_secret"
JWT_EXPIRES_IN="7d"

BCRYPT_SALT_ROUNDS=12

FRONTEND_URL="http://localhost:3000"

PAYMENT_PROVIDER_SECRET=""
PAYMENT_WEBHOOK_SECRET=""
Installation

Clone the repository:

git clone https://github.com/your-username/developer-assessment-platform.git

Move into the project directory:

cd developer-assessment-platform

Install dependencies:

npm install

Create the environment file:

cp .env.example .env

Run Prisma migrations:

npx prisma migrate dev

Generate Prisma Client:

npx prisma generate

Start the development server:

npm run dev
Available Scripts
npm run dev

Starts the development server.

npm run build

Builds the TypeScript project.

npm start

Starts the production server.

npm run lint

Runs ESLint.

npm run format

Formats the project using Prettier.

npm test

Runs the test suite.

Project Status

The project is currently under development.

Completed

Project setup

Database configuration

Authentication foundation

Problem management foundation

Assessment management foundation

Attempt management foundation

In Progress

Evaluation workflow

Result management

Company reports

Subscription and payment

Planned

Coding execution

Anti-cheating features

Analytics

Notifications

Advanced reporting

Contribution

Contributions are welcome.

Fork the repository.

Create a new branch.

git checkout -b feature/your-feature

Make your changes.

Run tests and lint checks.

Commit your changes.

git commit -m "feat: add your feature"

Push the branch.

git push origin feature/your-feature

Create a pull request.

License

This project is created for educational and portfolio purposes.

Author

Developed as a backend project to practice real-world assessment platform architecture, secure API development, database design, evaluation workflows, and subscription-based features.