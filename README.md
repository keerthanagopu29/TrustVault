# TrustVault — Secure Document Access

TrustVault is a role-aware document-sharing application built with React, Express, and MongoDB. It is designed to help users share documents with explicit permissions and maintain an audit trail of access-related activity.

## Features

The following features are implemented in the project code and must be verified against the running application before being claimed as fully working:

- **Authentication:** registration, login/logout, session cookies, and password hashing.
- **Roles:** administrator, document owner, and viewer, with server-side authorization.
- **Document management:** private document storage, search and filtering, and upload validation.
- **Sharing:** read/edit permissions and owner-controlled access revocation.
- **Administration:** user management and audit-record inspection.
- **Audit trail:** hash-linked audit records and chain verification.
- **Security testing:** automated cross-account authorization test coverage.

Check the actual application and tests before submission to confirm each feature and its current behavior.

## Technology Stack

- Frontend: React and Vite
- Backend: Node.js and Express
- Database: MongoDB with Mongoose
- Authentication: server-side sessions and password hashing

## Requirements

- Node.js 20 or later
- npm
- A local MongoDB instance or MongoDB Atlas database

## Local Setup

### 1. Configure the backend

From the project root, create your local environment file:

```cmd
copy server\.env.example server\.env
```

Edit `server/.env` and configure the required database connection and session secret.

### 2. Install and start the backend

```cmd
cd server
npm install
npm run dev
```

Keep this terminal running while you use the application.

### 3. Start the frontend

Open a second terminal at the project root and run:

```cmd
cd client
npm install
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`.

### 4. Create test accounts

Register accounts through the application. Confirm the default role assigned to new accounts by checking the current backend implementation. Use an isolated test environment for any administrator or owner accounts.

## Environment Variables and Secrets

See `server/.env.example` and `client/.env.example` for the environment variables supported by the project.

Never commit:

- `.env` files containing actual credentials
- Database connection strings with passwords
- Session secrets, API keys, or password-reset tokens
- Real private documents or uploaded user files

For deployment, configure the frontend origin, API URL, database connection, session secret, and any external integrations through the hosting provider's environment settings.

## Password Reset

Password-reset delivery depends on the implementation and configuration in the current backend. If delivery uses an external webhook, configure the required endpoint and secret in the deployment environment and test the complete flow before claiming production support.

Do not expose reset tokens in production responses or publish real reset tokens in logs, documentation, or source control.

## Demo Accounts

Use a dedicated demo database and non-sensitive sample documents.

If the seed script is used, inspect its current requirements and safeguards before running it:

```bash
cd server
npm run
```

Use only the seed command listed in `server/package.json`. Keep demo credentials out of source control and provide them to evaluators only through the challenge's permitted submission channel.

## Automated Authorization Tests

Inspect `server/package.json` to confirm the available test command. If the test script is configured as `npm test`, run it from the server directory:

```bash
cd server
npm test
```

Configure a dedicated test database if required by the tests. Never point test configuration at a production database or a database containing important user data.

Record the actual test results for the final submission. A passing test suite does not, by itself, prove that every route or attack scenario has been covered.

## Frontend Build and Lint

Run these commands from the client directory:

```bash
cd client
npm run build
npm run lint
```

Run only scripts that are present in `client/package.json`. Record any failures and resolve them before submission.

## Deployment Checklist

Before deploying:

- Configure production database credentials and a strong session secret.
- Set the correct frontend origin and API URL.
- Enable HTTPS and restrict cross-origin requests to the intended frontend.
- Confirm the hosting environment supports the application's session configuration.
- Ensure uploaded documents are stored on persistent private storage. Local files may be lost when a host restarts or redeploys if its filesystem is ephemeral.
- Configure and verify any required password-reset delivery integration.
- Keep demo seed credentials and real user documents out of the public repository.
- Test login/logout, all roles, document permissions, revocation, refused access, upload validation, and audit verification.
- Verify deployment instructions from a clean clone of the repository.

**Live deployment:** Add the real URL after deployment is complete.

**Public repository:** Add the actual repository URL after it has been created.

## Project Documentation

- `API.md` — API routes and authorization reference.
- `THREATS.md` — threat model, mitigations, and residual risks.
- `PROMPTS.md` — AI assistance disclosure and validation log.
- `SUBMISSION_CHECKLIST.md` — submission preparation checklist.

## Known Limitations and Security Considerations

- External password-reset delivery must be configured and tested if the feature depends on a webhook.
- Local file storage requires persistent private storage in production; multi-instance deployments may need private object storage.
- A hash-linked audit chain can help detect changes, but an attacker who can rewrite the entire chain may be able to reconstruct it. Independent signed checkpoints or an append-only external store provide stronger tamper evidence.
- Elevated roles should be granted only through a trusted, authorized process.
- Features, tests, deployment status, and security claims must be confirmed against the actual running application before final submission.
