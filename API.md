# TrustVault API Reference

Base path: `/api`. JSON endpoints accept `Content-Type: application/json` unless noted. Login establishes the `trustvault.sid` session cookie; browser requests must include credentials. Errors use `{ "error": "..." }` and validation failures may include `details`.

## Authentication and account

| Method | Route | Authentication | Purpose |
|---|---|---|---|
| POST | `/auth/register` | Public, rate-limited | Register a viewer account (`name`, `email`, `password`). |
| POST | `/auth/login` | Public, rate-limited | Authenticate and create a fresh session. |
| POST | `/auth/logout` | Authenticated | Record logout and destroy session. |
| GET | `/auth/me` | Authenticated | Return current account profile and role. |
| POST | `/auth/change-password` | Authenticated | Verify `currentPassword`, then set `newPassword`. |
| POST | `/auth/forgot-password` | Public, rate-limited | Request a 15-minute reset token; generic response avoids account enumeration. Development returns a demo token; production uses the configured delivery webhook. |
| POST | `/auth/reset-password` | Public, rate-limited | Consume `email`, `token`, and `newPassword`; invalid/expired tokens are rejected. |

Passwords must be at least 12 characters; registration UI also requires uppercase, lowercase, a number and a special character. Server-side validation enforces minimum length; change/reset UI validates the full composition policy.

## Documents

| Method | Route | Access | Purpose |
|---|---|---|---|
| POST | `/documents` | Owner or admin | Upload multipart `file`, optional `name`, optional `category`; max 10 MB. |
| GET | `/documents` | Authenticated, only owned/granted docs | List documents. Optional query: `q`, `category`, `from`, `to`. Search covers name, owner name and category. |
| GET | `/documents/:id/download` | Owner or grant with read/edit | Download private file after server-side access check. |
| PATCH | `/documents/:id` | Owner or edit grant | Update `name` and/or `category`. |
| POST | `/documents/:id/grants` | Owner only | Grant a registered user's `email` `read` or `edit` permission. |
| DELETE | `/documents/:id/grants/:userId` | Owner only | Revoke a grant. |
| DELETE | `/documents/:id` | Owner only | Delete metadata and private file. |

A read grant permits download, but not metadata changes. An edit grant permits download and metadata changes, but does not permit re-sharing or deletion. Ownership is required to manage grants or delete a document. Admin role alone does not bypass document-level authorization.

## Administration

| Method | Route | Access | Purpose |
|---|---|---|---|
| GET | `/admin/users` | Admin | List account names, emails, roles and creation timestamps. |
| PATCH | `/admin/users/:id/role` | Admin | Set role to `admin`, `owner` or `viewer`; self-role change is denied. |
| GET | `/admin/audit` | Admin | Read up to 500 recent audit records. |
| GET | `/admin/audit/verify` | Admin | Verify audit hash chain; returns 200 when valid or 409 when invalid. |

## Status

- GET `/` returns a simple API health response (outside the `/api` prefix).

## Authorization testing

Run `npm test` in `server/` with `TEST_MONGODB_URI` pointing to a disposable database whose name contains `test`. The automated test verifies that a separate account cannot list, download, edit, or delete another owner's document.
