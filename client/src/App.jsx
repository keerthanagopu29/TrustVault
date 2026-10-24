import { useCallback, useEffect, useState } from "react";
import "./App.css";

const API = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || `Request failed (${response.status})`);
  return data;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState(() => (window.location.hash.startsWith("#reset?") || new URLSearchParams(window.location.search).has("resetToken")) ? "reset" : "login");
  const [email, setEmail] = useState(() => {
    const params = new URLSearchParams(window.location.hash.startsWith("#reset?") ? window.location.hash.slice(7) : window.location.search);
    return params.get("email") || "";
  });
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [documents, setDocuments] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [file, setFile] = useState(null);
  const [docName, setDocName] = useState("");
  const [docCategory, setDocCategory] = useState("General");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState("documents");
  const [adminUsers, setAdminUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditVerification, setAuditVerification] = useState(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [shareDocument, setShareDocument] = useState(null);
  const [shareEmail, setShareEmail] = useState("");
  const [sharePermission, setSharePermission] = useState("read");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState(() => {
    const params = new URLSearchParams(window.location.hash.startsWith("#reset?") ? window.location.hash.slice(7) : window.location.search);
    return params.get("resetToken") || "";
  });
  const [theme, setTheme] = useState(() => localStorage.getItem("trustvault-theme") || "light");
  const [compactMode, setCompactMode] = useState(() => localStorage.getItem("trustvault-compact") === "true");

  const loadDocuments = useCallback(async () => {
    try {
      const params = new URLSearchParams({ q: search, category, from: fromDate, to: toDate });
      const result = await request(`/documents?${params.toString()}`);
      setDocuments(Array.isArray(result) ? result : result.documents || []);
    } catch (error) { setMessage(error.message); }
  }, [search, category, fromDate, toDate]);

  useEffect(() => {
    request("/auth/me").then((result) => setUser(result.user || result)).catch(() => setUser(null));
  }, []);

  useEffect(() => { if (user) void loadDocuments(); }, [user, loadDocuments]);

  async function authenticate(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    if (mode === "register") {
      const strong = password.length >= 12 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password);
      if (!strong) {
        setMessage("Use at least 12 characters with uppercase, lowercase, a number, and a special character.");
        setBusy(false);
        return;
      }
    }
    try {
      const result = await request(mode === "login" ? "/auth/login" : "/auth/register", {
        method: "POST",
        body: JSON.stringify(mode === "login" ? { email, password } : { name, email, password }),
      });
      if (mode === "register") {
        setMode("login");
        setPassword("");
        setMessage("Account created. Please log in.");
      } else {
        setUser(result.user || result);
        setPassword("");
        setCurrentPage("documents");
        setMessage("Welcome to TrustVault.");
      }
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  async function loadAdminData() {
    if (user?.role !== "admin") return;
    setAdminLoading(true);
    setMessage("");
    try {
      const [usersResult, auditResult] = await Promise.all([
        request("/admin/users"),
        request("/admin/audit"),
      ]);
      setAdminUsers(usersResult.users || []);
      setAuditLogs(auditResult.audit || []);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setAdminLoading(false);
    }
  }

  async function verifyAuditLog() {
    setAdminLoading(true);
    setMessage("");
    try {
      const result = await request("/admin/audit/verify");
      setAuditVerification(result);
    } catch (error) {
      setAuditVerification({ valid: false, reason: error.message });
    } finally {
      setAdminLoading(false);
    }
  }

  async function updateUserRole(targetUser, newRole) {
    if (!newRole || newRole === targetUser.role) return;
    const confirmed = window.confirm(`Change ${targetUser.email}'s role from ${targetUser.role} to ${newRole}?`);
    if (!confirmed) return;
    setAdminLoading(true);
    setMessage("");
    try {
      await request(`/admin/users/${targetUser._id || targetUser.id}/role`, {
        method: "PATCH", body: JSON.stringify({ role: newRole }),
      });
      setMessage(`Updated role for ${targetUser.email}.`);
      await loadAdminData();
    } catch (error) {
      setMessage(error.message);
      await loadAdminData();
    } finally {
      setAdminLoading(false);
    }
  }

  async function logout() {
    try { await request("/auth/logout", { method: "POST" }); }
    catch (error) { setMessage(error.message); }
    finally {
      setUser(null); setDocuments([]); setProfileMenuOpen(false);
      setCurrentPage("documents"); setPassword(""); setMessage("You have been logged out.");
    }
  }

  async function uploadDocument(event) {
    event.preventDefault();
    if (!file) { setMessage("Please select a file first."); return; }
    const form = new FormData();
    form.append("file", file);
    form.append("name", docName.trim() || file.name);
    form.append("category", docCategory);
    setBusy(true); setMessage("");
    try {
      await request("/documents", { method: "POST", body: form });
      setFile(null); setDocName(""); event.target.reset();
      setMessage("Document uploaded successfully.");
      await loadDocuments();
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  async function downloadDocument(doc) {
    try {
      const response = await fetch(`${API}/documents/${doc._id || doc.id}/download`, { credentials: "include" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || data.error || "Download failed.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url; link.download = doc.name || "document";
      document.body.appendChild(link); link.click(); link.remove();
      URL.revokeObjectURL(url);
      setMessage("Download started.");
    } catch (error) { setMessage(error.message); }
  }

  async function editDocument(doc) {
    const newName = window.prompt("Document name:", doc.name);
    if (newName === null || !newName.trim()) return;
    const newCategory = window.prompt("Category (e.g. Work, Finance, Personal):", doc.category || "General");
    if (newCategory === null || !newCategory.trim()) return;
    if (newName.trim() === doc.name && newCategory.trim() === (doc.category || "General")) return;
    try {
      await request(`/documents/${doc._id || doc.id}`, {
        method: "PATCH", body: JSON.stringify({ name: newName.trim(), category: newCategory.trim() }),
      });
      setMessage("Document details updated successfully.");
      await loadDocuments();
    } catch (error) { setMessage(error.message); }
  }

  async function requestPasswordReset(event) {
    event.preventDefault(); setBusy(true); setMessage(""); setResetToken("");
    try {
      const result = await request("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
      if (result.developmentResetToken) {
        setResetToken(result.developmentResetToken);
        setMode("reset");
        setMessage("Development reset token generated. Use it below; production sends instructions through the configured delivery webhook.");
      } else {
        setMessage(result.message || "If an account exists, reset instructions will be sent.");
      }
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  async function resetPassword(event) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      await request("/auth/reset-password", { method: "POST", body: JSON.stringify({ email, token: resetToken, newPassword: password }) });
      setMode("login"); setPassword(""); setResetToken("");
      window.history.replaceState({}, "", window.location.pathname);
      setMessage("Password reset successfully. Please log in with your new password.");
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  async function changePassword(event) {
    event.preventDefault(); setMessage("");
    if (newPassword !== confirmPassword) { setMessage("New password and confirmation do not match."); return; }
    if (newPassword.length < 12 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      setMessage("Use at least 12 characters with uppercase, lowercase, a number, and a special character."); return;
    }
    setBusy(true);
    try {
      await request("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setMessage("Password changed successfully.");
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  async function shareDocumentAccess(event) {
    event.preventDefault(); if (!shareDocument) return;
    setBusy(true); setMessage("");
    try {
      await request(`/documents/${shareDocument.id || shareDocument._id}/grants`, { method: "POST", body: JSON.stringify({ email: shareEmail.trim(), permission: sharePermission }) });
      setMessage(`Access granted to ${shareEmail.trim()}.`); setShareEmail(""); setShareDocument(null); await loadDocuments();
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  async function revokeAccess(doc, grant) {
    if (!window.confirm(`Revoke ${grant.permission} access for ${grant.email}?`)) return;
    try {
      await request(`/documents/${doc.id || doc._id}/grants/${grant.userId}`, { method: "DELETE" });
      setMessage(`Access revoked for ${grant.email}.`); await loadDocuments();
    } catch (error) { setMessage(error.message); }
  }

  async function deleteDocument(doc) {
    if (!window.confirm(`Permanently delete “${doc.name}” and its stored file? This cannot be undone.`)) return;
    try {
      await request(`/documents/${doc.id || doc._id}`, { method: "DELETE" });
      setMessage(`Deleted ${doc.name}.`); await loadDocuments();
    } catch (error) { setMessage(error.message); }
  }

  function savePreferences(nextTheme = theme, nextCompact = compactMode) {
    setTheme(nextTheme); setCompactMode(nextCompact);
    localStorage.setItem("trustvault-theme", nextTheme);
    localStorage.setItem("trustvault-compact", String(nextCompact));
  }

  if (!user) return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-mark">T</div>
        <p className="eyebrow">PRIVATE DOCUMENT SECURITY</p>
        <h1>TrustVault</h1>
        <p className="muted">Your documents. Your permissions. Your control.</p>
        {mode !== "forgot" && mode !== "reset" && <div className="auth-tabs">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setMessage(""); }}>Log in</button>
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setMessage(""); }}>Create account</button>
        </div>}
        {mode === "forgot" ? <form onSubmit={requestPasswordReset}>
          <h2 className="auth-subtitle">Reset your password</h2><p className="muted auth-help">Enter your account email to request a secure reset.</p>
          <label>Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} autoComplete="email" placeholder="you@example.com" /></label>
          <button className="primary full" disabled={busy}>{busy ? "Please wait…" : "Request reset"}</button>
          <button type="button" className="text-button" onClick={() => { setMode("login"); setMessage(""); }}>Back to login</button>
        </form> : mode === "reset" ? <form onSubmit={resetPassword}>
          <h2 className="auth-subtitle">Choose a new password</h2>
          <label>Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} /></label>
          <label>Reset token<input value={resetToken} onChange={(e) => setResetToken(e.target.value)} required minLength={32} placeholder="Paste the reset token" /></label>
          <label>New password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" placeholder="Create a strong password" /></label>
          <button className="primary full" disabled={busy}>{busy ? "Please wait…" : "Reset password"}</button>
          <button type="button" className="text-button" onClick={() => { setMode("login"); setMessage(""); setResetToken(""); }}>Back to login</button>
        </form> : <form onSubmit={authenticate}>
          {mode === "register" && <label>Full name<input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={100} autoComplete="name" placeholder="Your name" /></label>}
          <label>Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} autoComplete="email" placeholder="you@example.com" /></label>
          <label>Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode === "register" ? 12 : 1} maxLength={128} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder={mode === "login" ? "Enter your password" : "Create a strong password"} />
            {mode === "register" && <div className="password-guidance"><p>Your password must contain:</p><ul>
              <li className={password.length >= 12 ? "rule-met" : ""}>At least 12 characters</li>
              <li className={/[A-Z]/.test(password) ? "rule-met" : ""}>One uppercase letter (A–Z)</li>
              <li className={/[a-z]/.test(password) ? "rule-met" : ""}>One lowercase letter (a–z)</li>
              <li className={/[0-9]/.test(password) ? "rule-met" : ""}>One number (0–9)</li>
              <li className={/[^A-Za-z0-9]/.test(password) ? "rule-met" : ""}>One special character (e.g. !@#$%)</li>
            </ul></div>}
          </label>
          <button className="primary full" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Log in securely" : "Create account"}</button>
          {mode === "login" && <button type="button" className="text-button" onClick={() => { setMode("forgot"); setMessage(""); }}>Forgot password?</button>}
        </form>}
        {message && <p className="notice">{message}</p>}
        <p className="security-note">🔒 Access is checked by the server for every protected action.</p>
      </section>
    </main>
  );

  const role = user.role || "user";
  const displayName = user.name || user.email || "TrustVault user";

  return (
    <main className={`app-shell ${theme === "dark" ? "theme-dark" : ""} ${compactMode ? "compact-mode" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-brand"><span className="brand-mark small">T</span><span>TrustVault</span></div>
        <p className="side-label">WORKSPACE</p>
        <button type="button" className={`side-link ${currentPage === "documents" ? "selected" : ""}`} onClick={() => { setCurrentPage("documents"); setProfileMenuOpen(false); }}>▦ <span>Documents</span></button>
        <button type="button" className={`side-link ${currentPage === "profile" ? "selected" : ""}`} onClick={() => { setCurrentPage("profile"); setProfileMenuOpen(false); }}>♙ <span>My Profile</span></button>
        <button type="button" className={`side-link ${currentPage === "settings" ? "selected" : ""}`} onClick={() => { setCurrentPage("settings"); setProfileMenuOpen(false); }}>⚙ <span>Settings & Security</span></button>
        {role === "admin" && <button type="button" className={`side-link ${currentPage === "admin" ? "selected" : ""}`} onClick={() => { setCurrentPage("admin"); setProfileMenuOpen(false); loadAdminData(); }}>⚙ <span>Admin Dashboard</span></button>}
        <div className="sidebar-bottom">
          <div className="avatar">{displayName.charAt(0).toUpperCase()}</div>
          <div className="user-info"><strong>{displayName}</strong><small>{role}</small></div>
          <button type="button" className="logout" onClick={() => setProfileMenuOpen((open) => !open)} title="Open profile menu" aria-label="Open profile menu" aria-expanded={profileMenuOpen}>⋯</button>
          {profileMenuOpen && <div className="profile-menu">
            <div className="profile-menu-header"><strong>{displayName}</strong><small>{user.email}</small><span className="role-badge">{role.charAt(0).toUpperCase() + role.slice(1)}</span></div>
            <button type="button" className="profile-menu-item" onClick={() => { setCurrentPage("profile"); setProfileMenuOpen(false); }}>My Profile</button>
            <button type="button" className="profile-menu-item logout-item" onClick={logout}>Log out</button>
          </div>}
        </div>
      </aside>

      <section className="main-content">
        {message && <div className="notice dashboard-notice"><span>{message}</span><button type="button" aria-label="Dismiss message" onClick={() => setMessage("")}>×</button></div>}
        {currentPage === "admin" && role === "admin" ? <>
          <header className="topbar"><div><span className="eyebrow">ADMINISTRATION</span><h1>Admin Dashboard</h1></div><span className="secure-pill"><span /> Admin access</span></header>
          <section className="stats-grid admin-stats">
            <article className="stat-card"><span className="stat-icon">♙</span><p>Registered users</p><h2>{adminUsers.length}</h2><small>Accounts in TrustVault</small></article>
            <article className="stat-card"><span className="stat-icon purple">◷</span><p>Audit events loaded</p><h2>{auditLogs.length}</h2><small>Latest events returned by the API</small></article>
            <article className="stat-card"><span className="stat-icon green">✓</span><p>Audit chain</p><h2 className="role-value">{auditVerification ? (auditVerification.valid ? "Valid" : "Check failed") : "Not checked"}</h2><small>Run verification below</small></article>
          </section>
          <section className="panel admin-panel">
            <div className="section-heading"><div><h2>User management</h2><p>Review accounts and update roles. Your own role cannot be changed here.</p></div><button type="button" className="secondary" disabled={adminLoading} onClick={loadAdminData}>↻ Refresh</button></div>
            {adminLoading && <p className="admin-muted">Loading admin data…</p>}
            <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Current role</th><th>Change role</th></tr></thead><tbody>
              {adminUsers.map((person) => <tr key={person._id || person.id}><td>{person.name}</td><td>{person.email}</td><td><span className={`admin-role role-${person.role}`}>{person.role}</span></td><td>{String(person._id || person.id) === String(user.id || user._id) ? <span className="admin-muted">Your account</span> : <select aria-label={`Change role for ${person.email}`} value={person.role} disabled={adminLoading} onChange={(e) => updateUserRole(person, e.target.value)}><option value="viewer">Viewer</option><option value="owner">Owner</option><option value="admin">Admin</option></select>}</td></tr>)}
              {!adminUsers.length && !adminLoading && <tr><td colSpan="4" className="admin-empty">No users found, or the user list has not loaded.</td></tr>}
            </tbody></table></div>
          </section>
          <section className="panel admin-panel">
            <div className="section-heading"><div><h2>Audit log integrity</h2><p>Verify that the audit records form a valid hash chain.</p></div><button type="button" className="primary" disabled={adminLoading} onClick={verifyAuditLog}>✓ Verify audit chain</button></div>
            {auditVerification && <div className={`verification-result ${auditVerification.valid ? "verification-good" : "verification-bad"}`}><strong>{auditVerification.valid ? "Audit chain verified" : "Audit verification failed"}</strong><span>{auditVerification.valid ? `${auditVerification.entriesChecked} entries checked out of ${auditVerification.totalEntries}.` : `${auditVerification.reason || "Verification failed"}${auditVerification.invalidEntryId ? ` · Entry: ${auditVerification.invalidEntryId}` : ""}`}</span></div>}
          </section>
          <section className="panel admin-panel">
            <div className="section-heading"><div><h2>Recent audit activity</h2><p>Most recent security and document events.</p></div><button type="button" className="secondary" disabled={adminLoading} onClick={loadAdminData}>↻ Refresh logs</button></div>
            <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Time</th><th>Action</th><th>Actor ID</th><th>Document ID</th></tr></thead><tbody>
              {auditLogs.slice(0, 100).map((log) => <tr key={log._id}><td>{log.timestamp ? new Date(log.timestamp).toLocaleString() : "—"}</td><td><span className="audit-action">{log.action}</span></td><td className="id-cell">{log.actorId || "System"}</td><td className="id-cell">{log.documentId || "—"}</td></tr>)}
              {!auditLogs.length && !adminLoading && <tr><td colSpan="4" className="admin-empty">No audit events found.</td></tr>}
            </tbody></table></div>
            {auditLogs.length > 100 && <p className="admin-muted">Showing the 100 most recent events from the {auditLogs.length} loaded records.</p>}
          </section>
        </> : currentPage === "profile" ? <>
          <header className="topbar"><div><span className="eyebrow">ACCOUNT SETTINGS</span><h1>My Profile</h1></div><span className="secure-pill"><span /> Protected session</span></header>
          <section className="panel profile-panel">
            <div className="profile-hero"><div className="profile-avatar">{displayName.charAt(0).toUpperCase()}</div><div><h2>{displayName}</h2><p>Your TrustVault account information</p></div></div>
            <div className="profile-details">
              <div className="profile-detail"><span>Full name</span><strong>{user.name || "Not provided"}</strong></div>
              <div className="profile-detail"><span>Email address</span><strong>{user.email || "Not provided"}</strong></div>
              <div className="profile-detail"><span>Account role</span><strong className="capitalize">{role}</strong></div>
              <div className="profile-detail"><span>Security status</span><strong className="status-text">Protected</strong></div>
            </div>
            <div className="profile-actions"><button type="button" className="secondary" onClick={() => setCurrentPage("settings")}>⚙ Settings & Security</button><button type="button" className="primary" onClick={logout}>Log out</button></div>
            <p className="profile-note">Your role and permissions are managed by TrustVault's server.</p>
          </section>
        </> : currentPage === "settings" ? <>
          <header className="topbar"><div><span className="eyebrow">PREFERENCES & SECURITY</span><h1>Settings</h1></div><span className="secure-pill"><span /> Account protected</span></header>
          <section className="panel settings-panel">
            <div className="section-heading"><div><h2>Appearance</h2><p>Make TrustVault comfortable to use on this device.</p></div></div>
            <div className="setting-row"><div><strong>Color theme</strong><p>Choose the workspace appearance.</p></div><select value={theme} onChange={(e) => savePreferences(e.target.value, compactMode)}><option value="light">Light</option><option value="dark">Dark</option></select></div>
            <div className="setting-row"><div><strong>Compact document list</strong><p>Use tighter spacing to see more files at once.</p></div><input type="checkbox" checked={compactMode} onChange={(e) => savePreferences(theme, e.target.checked)} aria-label="Compact document list" /></div>
          </section>
          <section className="panel settings-panel">
            <div className="section-heading"><div><h2>Change password</h2><p>Use a unique password with at least 12 characters.</p></div><span className="panel-icon">⌑</span></div>
            <form className="security-form" onSubmit={changePassword}>
              <label>Current password<input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" /></label>
              <label>New password<input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" /></label>
              <label>Confirm new password<input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" /></label>
              <p className="form-hint">Must include uppercase, lowercase, a number and a special character.</p>
              <button type="submit" className="primary" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
            </form>
          </section>
          <section className="panel settings-panel">
            <div className="section-heading"><div><h2>Session & account</h2><p>Your session is stored in an HTTP-only cookie. Role permissions are enforced by the server.</p></div></div>
            <div className="setting-row"><div><strong>Signed in as</strong><p>{user.email}</p></div><span className="role-badge">{role}</span></div>
            <div className="profile-actions"><button type="button" className="secondary" onClick={() => setCurrentPage("documents")}>← Back to documents</button><button type="button" className="primary" onClick={logout}>Log out</button></div>
          </section>
        </> : <>
          <header className="topbar"><div><span className="eyebrow">SECURE WORKSPACE</span><h1>My documents</h1></div><span className="secure-pill"><span /> Protected session</span></header>
          <section className="stats-grid">
            <article className="stat-card"><span className="stat-icon">▤</span><p>Accessible documents</p><h2>{documents.length}</h2><small>Documents available to your account</small></article>
            <article className="stat-card"><span className="stat-icon purple">♙</span><p>Your role</p><h2 className="role-value">{role}</h2><small>Enforced by the API</small></article>
            <article className="stat-card"><span className="stat-icon green">✓</span><p>Security status</p><h2 className="role-value">Protected</h2><small>Private file storage</small></article>
          </section>
          {role !== "viewer" && <section className="panel upload-panel">
            <div className="section-heading"><div><h2>Upload a document</h2><p>Add a file to your secure workspace.</p></div><span className="panel-icon">↑</span></div>
            <form className="upload-form" onSubmit={uploadDocument}>
              <label>Document name<input value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="e.g. Project proposal" /></label>
              <label>Category<select value={docCategory} onChange={(e) => setDocCategory(e.target.value)}><option>General</option><option>Work</option><option>Finance</option><option>Personal</option><option>Legal</option><option>Education</option></select></label>
              <label className="file-field">Choose file<input type="file" accept=".pdf,.png,.jpg,.jpeg,.txt" required onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
              <button className="primary" disabled={busy}>{busy ? "Working…" : "↑ Upload file"}</button>
            </form>
            <p className="form-hint">Accepted formats: PDF, PNG, JPG, TXT · Maximum 10 MB</p>
          </section>}
          <section className="panel documents-panel">
            <div className="section-heading"><div><h2>Your documents</h2><p>Only documents your account is allowed to access are shown.</p></div><button type="button" className="secondary" onClick={loadDocuments}>↻ Refresh</button></div>
            <div className="filters"><div className="search-box">⌕<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by document, owner, or category…" /></div>
              <select value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option><option>General</option><option>Work</option><option>Finance</option><option>Personal</option><option>Legal</option><option>Education</option></select>
              <label className="date-filter">From<input type="date" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} /></label>
              <label className="date-filter">To<input type="date" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} /></label>
              {(fromDate || toDate || category || search) && <button type="button" className="secondary clear-filters" onClick={() => { setSearch(""); setCategory(""); setFromDate(""); setToDate(""); }}>Clear filters</button>}
            </div>
            {documents.length === 0 ? <div className="empty-state"><div className="empty-icon">▤</div><h3>No documents found</h3><p>Upload a document or adjust your search.</p></div> :
              <div className="document-list">{documents.map((doc) => {
                const isOwner = doc.ownerEmail?.toLowerCase() === user.email?.toLowerCase();
                const canEdit = isOwner || doc.permission === "edit";
                return <article className="document-row" key={doc._id || doc.id}>
                  <div className="file-icon">FILE</div>
                  <div className="document-details"><strong>{doc.name}</strong><span>{doc.category || "General"} · {doc.size ? `${(doc.size / 1024).toFixed(1)} KB` : "Document"}</span></div>
                  <span className="document-date">{doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : ""}</span>
                  {canEdit && <button type="button" className="secondary" onClick={() => editDocument(doc)}>✎ Edit</button>}
                  {isOwner && <button type="button" className="secondary" onClick={() => { setShareDocument(doc); setShareEmail(""); setSharePermission("read"); }}>↗ Share</button>}
                  <button type="button" className="secondary" onClick={() => downloadDocument(doc)}>↓ Download</button>
                  {isOwner && <button type="button" className="danger-button" onClick={() => deleteDocument(doc)}>Delete</button>}
                  {isOwner && doc.grants?.length > 0 && <div className="document-grants"><strong>Shared with</strong>{doc.grants.map((grant) => <div className="grant-row" key={grant.userId}><span>{grant.name} <small>{grant.email}</small></span><span className="permission-label">{grant.permission}</span><button type="button" className="text-button danger-text" onClick={() => revokeAccess(doc, grant)}>Revoke</button></div>)}</div>}
                </article>;
              })}</div>}
          </section>
          <footer>TrustVault · Secure document access · Built with server-enforced permissions</footer>
        </>}
        {shareDocument && <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setShareDocument(null); }}><section className="share-modal" role="dialog" aria-modal="true" aria-labelledby="share-title"><button type="button" className="modal-close" aria-label="Close share dialog" onClick={() => setShareDocument(null)}>×</button><span className="eyebrow">DOCUMENT ACCESS</span><h2 id="share-title">Share “{shareDocument.name}”</h2><p className="muted">Grant access to a registered TrustVault user. You can revoke it at any time.</p><form onSubmit={shareDocumentAccess}><label>User email<input type="email" value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} required maxLength={254} placeholder="colleague@example.com" /></label><label>Permission<select value={sharePermission} onChange={(e) => setSharePermission(e.target.value)}><option value="read">Read only — view and download</option><option value="edit">Can edit — rename and update category</option></select></label><div className="modal-actions"><button type="button" className="secondary" onClick={() => setShareDocument(null)}>Cancel</button><button type="submit" className="primary" disabled={busy}>{busy ? "Sharing…" : "Grant access"}</button></div></form></section></div>}
      </section>
    </main>
  );
}
