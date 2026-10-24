# TrustVault Final Submission Checklist

## Code and security

- [ ] Install server and client dependencies from the committed lockfiles.
- [ ] Run `npm run build` and `npm run lint` in `client/`.
- [ ] Run `npm test` in `server/` against a disposable database named with `test` in the name.
- [ ] Manually demonstrate owner/admin/viewer behavior and server-side denied requests.
- [ ] Configure and test production password-reset delivery; do not claim it is working until a real email has arrived and a reset link succeeds.
- [ ] Confirm private uploads persist on the deployed host or use private object storage.
- [ ] Confirm `.env`, credentials, `.git`, `node_modules`, `dist`, private uploads and real personal data are excluded from the public repo.
- [ ] Confirm the audit chain reports valid, then demonstrate that tampering is detected in a disposable test environment only.

## Repository and deployment

- [ ] Use meaningful commits for security fixes, feature work, tests and documentation; do not squash away all history if the challenge asks for meaningful history.
- [ ] Publish the repository and verify a clean clone can follow the root README.
- [ ] Configure production secrets in the hosting dashboard, not source files.
- [ ] Set `VITE_API_URL` to the deployed API `/api` base URL and `CLIENT_ORIGIN` to the exact frontend origin.
- [ ] Verify the deployed health route and all role-specific flows in the live environment.
- [ ] Seed only a separate demo environment with temporary credentials and share those credentials privately with evaluators.

## Five-minute demo outline

1. **0:00–0:30 — Introduction:** explain TrustVault and its confidentiality/authorization goal.
2. **0:30–1:20 — Owner:** upload a non-sensitive sample PDF, search/filter it, edit its name/category, share read access with the viewer, and show the grant.
3. **1:20–2:00 — Viewer:** sign in as viewer, show the shared file and download it; show that unshared documents are not listed.
4. **2:00–2:35 — Revocation/security:** revoke the grant as owner and demonstrate viewer access is denied afterward.
5. **2:35–3:20 — Admin:** change a different user's role, inspect audit events, and verify the audit chain.
6. **3:20–4:05 — Account security:** show change password and, only after delivery is configured, the email-based forgot/reset flow.
7. **4:05–4:40 — Automated test:** show the cross-account authorization test passing against a test database.
8. **4:40–5:00 — Close:** show the public repository, live URL, setup docs and threat model.

Use only sample data and temporary demo accounts in the recording. Do not reveal secrets, real personal files, or production database information.
