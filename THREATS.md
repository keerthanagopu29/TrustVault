# TrustVault Threat Model

## Scope and security goals

TrustVault stores user-uploaded documents and metadata, grants named users read/edit access, and records security-relevant activity. The main goals are confidentiality of private files, integrity of document metadata and permission grants, authenticated role separation, and detection of audit-log tampering.

## Assets

- Uploaded file contents and filenames
- User identity, email address, password hashes and active sessions
- Document ownership, category and sharing grants
- Audit event details, timestamps, previous hashes and record hashes
- MongoDB connection credentials, session secret, and password-reset delivery secret

## Trust boundaries and data flow

1. Browser to React client: all displayed role-based controls are usability only and are not authorization boundaries.
2. Browser to Express API: cookie-authenticated requests cross the primary trust boundary. The API must validate inputs and authorize every protected operation.
3. Express API to MongoDB: database credentials permit access to user, document, session, reset-token and audit records.
4. Express API to private upload directory: file bytes are stored outside the public web root and are only served through an authorized download route.
5. Password-reset delivery webhook: an external, explicitly configured service receives a short-lived reset token and link; it must be trusted and use HTTPS.

## Threats and mitigations

| Threat | Mitigations in this implementation | Residual risk / verification |
|---|---|---|
| Unauthenticated access | Protected routes require a session; login/register are rate-limited; login regenerates the session ID. | Verify cookie behavior and brute-force limits in the deployed environment. |
| Cross-user document disclosure | Listing is scoped to owned/granted records; download/edit routes load the document and check access on the server; sharing and deletion require ownership. | Automated test covers a second account attempting list/download/edit/delete; run it against a dedicated test database. |
| Privilege escalation | Roles are checked by API middleware; only admins can change another user's role; self-role change is rejected. | Initial admin bootstrap must be secured; protect demo seed credentials and never seed production. |
| Malicious upload / type spoofing | Multer allow-list, 10 MB cap, random storage name, and content signature/UTF-8 validation. | Signature checks are not malware scanning or deep format validation. Consider scanning and private object storage for production. |
| Session theft/fixation | HTTP-only cookie, SameSite=Lax, secure flag in production, session regeneration at login, Mongo-backed sessions and 30-minute cookie lifetime. | HTTPS is mandatory. Review deployment domain topology and session revocation behavior. |
| Password compromise/reset abuse | bcrypt cost 12; minimum 12-character password; rate-limited reset request; cryptographically random token stored as SHA-256 hash; 15-minute expiry; one-use semantics by deleting reset records after success; generic reset response. | Production delivery depends on a trusted configured webhook. Validate delivery, link expiry, and monitoring before release. |
| Audit tampering | Sequential audit writes; each entry hashes canonical event fields and the prior hash; admin verification recomputes the chain. | A privileged database operator can potentially rewrite the entire chain. Independent signed checkpoints are needed for stronger non-repudiation. |
| Injection / malformed input | Zod validation on sensitive JSON inputs, Mongoose models, strict document update schema, upload content validation, request body size limit. | Add further schema validation and fuzzing as the API evolves. |
| Cross-origin misuse | CORS allows one configured client origin with credentials; Helmet adds security headers. | Configure exact production origins and HTTPS; do not use wildcard credentialed CORS. |
| Secret leakage through repository | Root `.gitignore` excludes environment files, dependencies, build output and private uploads; example files contain placeholders only. | A secret previously committed remains in Git history. Rotate it and purge history if needed. |

## Abuse cases to test

- Viewer attempts to download, edit, delete or grant access to another user's document.
- User with read-only grant attempts to edit or delete.
- Non-admin requests the admin user list, role-change endpoint or audit endpoints.
- Admin attempts to change their own role.
- Upload sends a disallowed MIME type, a mismatched file signature, an empty file or a file over 10 MB.
- Reset token is expired, incorrect, reused, or paired with the wrong email.
- Audit record is altered and verification reports a broken chain.

## Security acceptance checklist

- [ ] `npm test` passes using a dedicated test database.
- [ ] `npm run build` succeeds.
- [ ] Production uses HTTPS and non-default secrets.
- [ ] Password-reset webhook sends a real email and reset tokens are never returned in production API responses.
- [ ] Cross-user denial cases are demonstrated in the five-minute video.
- [ ] No `.env`, credentials, private uploads, or real personal data exist in the public repository.
