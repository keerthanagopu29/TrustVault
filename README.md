# 🔐 TrustVault
### Secure Document Sharing with a Verifiable Audit Trail

TrustVault is a secure document-sharing platform built to protect sensitive documents through role-based access control, permission management, and an auditable record of security-related actions.

## 🚀 Live Demo

**Frontend:** https://trustvault-frontend-loci.onrender.com

**Backend API:** https://trustvault-gilw.onrender.com

**GitHub Repository:** https://github.com/keerthanagopu29/TrustVault

> Note: The backend is hosted on Render's free service, so the first request may take a little time while the service starts.

## 👤 Demo Login Credentials

Use the dedicated evaluation accounts below to test the application. Replace the placeholders with verified credentials before submitting.

| Role | Email | Password |
|---|---|---|
| Admin | 24jr5a4401@gmail.com | Keerthana@1234 |
| Owner | aruna@gmail.com | Keerthana@1234 |
| Viewer 1 | pavithra@gmail.com | Keerthana@1234 |
| Viewer 2 | 24jr5a4401gdg@gmail.com | Keerthana@1234 |

**Security note:** These must be dedicated demo accounts, not personal accounts. Only publish passwords intended for public evaluation. Never include database credentials, session secrets, or `.env` values.

## ✨ Key Features

- **Authentication:** Account login and session-based authentication.
- **Role-Based Access Control:** Separate permissions for Admin, Owner, and Viewer.
- **Secure Document Upload:** Owners can upload documents to the platform.
- **Permission Management:** Owners can grant and revoke document access.
- **Protected Downloads:** Documents are accessible only to authorized users.
- **Audit Logging:** Records relevant security and document actions.
- **Audit Integrity Verification:** Provides a mechanism to verify the audit log hash chain.
- **User Management:** Admins can review registered users and manage roles.
- **Document Organization:** Supports document categories and search.

## 🧪 Quick Evaluation Guide

### 1. Test the Owner Role
1. Log in using the Owner demo account.
2. Upload a sample document that contains no sensitive information.
3. Grant access to the Viewer demo account.
4. Confirm that the granted user appears in the sharing details.
5. Revoke access and confirm the permission is removed.

### 2. Test the Viewer Role
1. Log in using the Viewer demo account.
2. Confirm that the shared document appears in the document list.
3. Download the document.
4. Verify that documents not shared with this account are inaccessible.

### 3. Test the Admin Role
1. Log in using the Admin demo account.
2. Open the Admin Dashboard.
3. Review registered users and recent audit activity.
4. Run the audit-chain verification feature and inspect the result.

## 🛠️ Technology Stack

**Frontend:** React, Vite, JavaScript, CSS

**Backend:** Node.js, Express.js

**Database:** MongoDB Atlas, Mongoose

**Authentication:** Express Session, MongoDB-backed session storage

**Security:** Role-based authorization, Helmet, CORS configuration, rate limiting, input validation, and audit logging

**Deployment:** Render

## 🏗️ Project Structure

```text
TrustVault/
├── client/             # React frontend
├── server/             # Express backend
├── README.md
├── API.md              # API documentation
├── THREATS.md          # Threat model
├── PROMPTS.md          # AI assistance disclosure, if applicable
└── SUBMISSION_CHECKLIST.md
```

## ⚙️ Local Setup

### Prerequisites
- Node.js and npm
- MongoDB connection string
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/keerthanagopu29/TrustVault.git
cd TrustVault
```

### 2. Configure the Backend

```bash
cd server
npm install
```

Create a local `.env` file using the variable names expected by the backend:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
SESSION_SECRET=your_long_random_session_secret
CLIENT_ORIGIN=http://localhost:5173
```

Use your own local development values. Do not commit `.env`.

### 3. Configure the Frontend

In a separate terminal:

```bash
cd client
npm install
```

Configure the frontend API URL using the environment variable expected by the client:

```env
VITE_API_URL=http://localhost:5000/api
```

### 4. Run the Application

Start the backend using the start script defined in `server/package.json`, or the documented server entry point.

Start the frontend using:

```bash
npm run dev
```

Run each command from its corresponding directory.

## 📚 Documentation

- [API Documentation](API.md)
- [Threat Model](THREATS.md)
- [AI Assistance Disclosure](PROMPTS.md)
- [Submission Checklist](SUBMISSION_CHECKLIST.md)

## 🔒 Security Considerations

- Keep secrets and environment files out of version control.
- Use dedicated evaluation accounts with limited access.
- Do not upload real confidential documents to the public demo.
- Access to documents should be enforced by the backend, not only by the frontend interface.
- Audit logs should be checked using the application's verification functionality.

## 👩‍💻 Project

**TrustVault — Secure Document Sharing with a Verifiable Audit Trail**

Developed as a project submission demonstrating secure document access, role-based authorization, and auditability.
