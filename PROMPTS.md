# AI Assistance Disclosure and Validation Log

## Overview

TrustVault used AI assistance as a development aid for reviewing code structure, identifying role and authorization inconsistencies, drafting documentation, and proposing tests and UI improvements.

AI-generated suggestions were treated as proposals rather than proof of correctness. Changes must be reviewed and validated through code inspection, application testing, and automated tests.

## Work Areas Assisted by AI

- Reviewing the Express/Mongoose API and React UI against the challenge requirements.
- Identifying potential gaps involving password change/reset, document sharing and revocation, date filters, and frontend/API role consistency.
- Drafting the threat model, setup and deployment documentation, API reference, and demo checklist.
- Proposing a route-level authorization test for cross-account document isolation.
- Reviewing audit-chain verification logic and identifying a duplicated helper definition.

## Prompt and Validation Entries

The following are representative prompts associated with the project. They are not presented as a complete chronological transcript. Add dated records for individual development sessions and link the actual fixing commits before final submission.

### Entry 1 — Challenge and Security Review

**Date:** To be recorded from the actual development session.

**Prompt used:**

> Review the TrustVault source code against the challenge rubric. Identify missing features, security gaps, and inconsistencies between frontend controls and server-side authorization.

**AI/tool output:** A review of the project against the challenge requirements, identifying potential missing features, security gaps, and inconsistencies.

**Limitations or issues:** Recommendations alone do not establish that a vulnerability exists or that a feature is missing. Each finding must be checked against the actual source code and application behavior.

**Change made:** Record the specific finding investigated, the files changed, and the result of validation.

**Validation evidence:** Record the relevant test command, test result, or manual verification.

**Fixing commit:** Add the actual commit hash or GitHub commit URL after the change has been committed.

### Entry 2 — Password Change and Reset

**Date:** To be recorded from the actual development session.

**Prompt used:**

> Implement password change and a short-lived password-reset token flow. Do not expose reset tokens in production responses; make the delivery integration explicit and configurable.

**AI/tool output:** Proposed an implementation approach for password change and password-reset handling.

**Limitations or issues:** A proposed flow is not proof that reset tokens expire correctly, cannot be reused, or are delivered securely. The production delivery integration must be tested separately.

**Change made:** Record the actual implementation changes, or state that the feature remains incomplete if it was not implemented.

**Validation evidence:** Record tests for token expiry, token reuse, password updates, and production response behavior where applicable.

**Fixing commit:** Add the actual commit hash or GitHub commit URL after the change has been committed.

### Entry 3 — Document Sharing and Revocation

**Date:** To be recorded from the actual development session.

**Prompt used:**

> Add owner-facing sharing and revocation controls for registered users with read/edit permissions, while preserving server-side ownership checks.

**AI/tool output:** Proposed owner-facing sharing and revocation controls and related authorization checks.

**Limitations or issues:** Hiding or disabling frontend controls is not sufficient authorization. The backend must enforce permissions on every relevant request, including after access is revoked.

**Change made:** Record the actual UI and API changes made, or document any unfinished work.

**Validation evidence:** Record tests for permitted access, denied access, edit permissions, and access after revocation.

**Fixing commit:** Add the actual commit hash or GitHub commit URL after the change has been committed.

### Entry 4 — Cross-Account Authorization Testing

**Date:** To be recorded from the actual development session.

**Prompt used:**

> Create a route-level automated test proving that one account cannot list, download, edit, or delete another account’s private document.

**AI/tool output:** Proposed an automated test for cross-account document isolation.

**Limitations or issues:** A test can pass without covering every route or attack scenario. The test must run against the actual application and verify both HTTP responses and relevant side effects.

**Change made:** Record the actual test implementation and any authorization fixes made after reviewing its results.

**Validation evidence:** Record the exact test command and its actual result. Include the tested routes and denied operations.

**Fixing commit:** Add the actual commit hash or GitHub commit URL after the change has been committed.

### Entry 5 — Threat Model and Documentation

**Date:** To be recorded from the actual development session.

**Prompt used:**

> Draft a threat model with assets, trust boundaries, abuse cases, mitigations, and residual risks, and document local setup and deployment requirements.

**AI/tool output:** Proposed threat-model content and project setup/deployment documentation.

**Limitations or issues:** Documentation may describe intended behavior rather than verified behavior. Setup instructions, security mitigations, and deployment claims must be checked against the current code and environment.

**Change made:** Record the documentation sections reviewed and corrected, along with any implementation changes resulting from the review.

**Validation evidence:** Record the clean-clone setup checks, deployment checks, or other verification actually completed.

**Fixing commit:** Add the actual commit hash or GitHub commit URL after the change has been committed.

## Human Review and Verification

Before final submission:

- Run the backend automated tests and record their actual results.
- Run the frontend build and lint checks, where configured.
- Manually test administrator, owner, and viewer behavior.
- Verify server-side authorization for read, download, edit, delete, sharing, and revocation operations.
- Verify audit events for permitted and refused access attempts.
- Test password-reset delivery in the actual deployment if the feature is included.
- Verify deployment instructions from a clean clone.
- Confirm that the demo video and README describe only implemented and verified features.
- Replace the date placeholders with accurate dates and add real commit links for the corresponding changes.

AI assistance does not guarantee correctness or security. Unimplemented features, failed tests, and known limitations must be disclosed honestly.
