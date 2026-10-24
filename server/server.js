
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const { z } = require("zod");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;
const PRIVATE_DIR = path.join(__dirname, "private_uploads");

fs.mkdirSync(PRIVATE_DIR, { recursive: true });

if (!process.env.MONGODB_URI || !process.env.SESSION_SECRET) {
  throw new Error("MONGODB_URI and SESSION_SECRET must be configured");
}

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));


const sessionStore = MongoStore.create({
  mongoUrl: process.env.MONGODB_URI,
  collectionName: "sessions",
});

app.use(session({
  name: "trustvault.sid",
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  maxAge: 30 * 60 * 1000,
},
}));


const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["admin", "owner", "viewer"], default: "viewer" },
}, { timestamps: true });

const documentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, default: "General", trim: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User", index: true },
  grants: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    permission: { type: String, enum: ["read", "edit"], required: true },
  }],
  storageName: { type: String, required: true, unique: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
}, { timestamps: true });

documentSchema.index({ name: "text", category: "text" });

const auditSchema = new mongoose.Schema({
  actorId: { type: String, default: null },
  action: { type: String, required: true },
  documentId: { type: String, default: null },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  previousHash: { type: String, default: "GENESIS" },
  timestamp: { type: String, required: true },
  hash: { type: String, required: true },
}, { timestamps: true });

const User = mongoose.model("User", userSchema);
const Document = mongoose.model("Document", documentSchema);
const Audit = mongoose.model("Audit", auditSchema);

const passwordResetSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });
const PasswordReset = mongoose.model("PasswordReset", passwordResetSchema);

const strongPasswordSchema = z.string().min(12).max(128)
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[0-9]/, "Password must include a number")
  .regex(/[^A-Za-z0-9]/, "Password must include a special character");


function auditHash(entry) {
  const payload = {
    actorId: entry.actorId ?? null,
    action: entry.action,
    documentId: entry.documentId ?? null,
    details: entry.details ?? {},
    previousHash: entry.previousHash || "GENESIS",
    timestamp: entry.timestamp,
  };

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}


let auditWriteQueue = Promise.resolve();

async function audit(actorId, action, documentId = null, details = {}) {
  const write = auditWriteQueue.then(async () => {
    // Read the latest record only after the previous audit write finishes.
    const previous = await Audit.findOne()
      .sort({ createdAt: -1, _id: -1 })
      .lean();

    const entry = {
      actorId: actorId ? String(actorId) : null,
      action,
      documentId: documentId ? String(documentId) : null,
      details,
      previousHash: previous?.hash || "GENESIS",
      timestamp: new Date().toISOString(),
    };

    const hash = auditHash(entry);

    await Audit.create({
      ...entry,
      hash,
    });
  });

  // Keep the queue usable even if an individual audit write fails.
  auditWriteQueue = write.catch((error) => {
    console.error("Audit log write failed:", error.message);
  });

  return write;
}





async function verifyAuditChain() {
  const logs = await Audit.find()
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  let expectedPreviousHash = "GENESIS";
  let entriesChecked = 0;

  for (const log of logs) {
    if (!log.timestamp) {
      return {
        valid: false,
        reason: "LEGACY_RECORD_MISSING_TIMESTAMP",
        invalidEntryId: String(log._id),
        entriesChecked,
        totalEntries: logs.length,
      };
    }

    const entry = {
      actorId: log.actorId ?? null,
      action: log.action,
      documentId: log.documentId ?? null,
      details: log.details ?? {},
      previousHash: log.previousHash,
      timestamp: log.timestamp,
    };

    const calculatedHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(entry))
      .digest("hex");

    if (
      log.previousHash !== expectedPreviousHash ||
      log.hash !== calculatedHash
    ) {
      
console.error("AUDIT CHAIN DIAGNOSTIC:", {
  entryId: String(log._id),
  action: log.action,
  previousHashMatches: log.previousHash === expectedPreviousHash,
  expectedPreviousHash,
  storedPreviousHash: log.previousHash,
  storedHash: log.hash,
  calculatedHash,
  hashMatches: log.hash === calculatedHash,
  createdAt: log.createdAt,
  timestamp: log.timestamp,
});

      return {
        valid: false,
        reason: "HASH_CHAIN_MISMATCH",
        invalidEntryId: String(log._id),
        entriesChecked,
        totalEntries: logs.length,
      };
    }

    expectedPreviousHash = log.hash;
    entriesChecked++;
  }

  return {
    valid: true,
    entriesChecked,
    totalEntries: logs.length,
  };
}




function requireAuth(req, res, next) {
  if (!req.session.userId) {
    audit(null, "AUTH_REQUIRED", null, {
      method: req.method,
      path: req.path,
    }).catch(() => {});
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

async function loadUser(req, res, next) {
  try {
    req.user = await User.findById(req.session.userId);
    if (!req.user) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: "Session expired" });
    }
    next();
  } catch (err) {
    next(err);
  }
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      audit(req.user._id, "ROLE_DENIED", null, {
        method: req.method,
        path: req.path,
      }).catch(() => {});
      return res.status(403).json({ error: "Insufficient role" });
    }
    next();
  };
}

function validId(id) {
  return mongoose.isValidObjectId(id);
}

async function findDocument(req, res, next) {
  if (!validId(req.params.id)) {
    return res.status(404).json({ error: "Document not found" });
  }
  req.document = await Document.findById(req.params.id);
  if (!req.document) {
    return res.status(404).json({ error: "Document not found" });
  }
  next();
}

function permissionFor(doc, user) {
  if (String(doc.ownerId) === String(user._id)) return "owner";
  return doc.grants.find(g => String(g.userId) === String(user._id))?.permission || null;
}

function requireDocumentAccess(level) {
  return async (req, res, next) => {
    const permission = permissionFor(req.document, req.user);
    const allowed = permission === "owner" ||
      permission === "edit" ||
      (level === "read" && permission === "read");

    if (!allowed) {
      await audit(req.user._id, "DOCUMENT_ACCESS_DENIED", req.document._id, {
        requestedPermission: level,
        method: req.method,
      }).catch(() => {});
      return res.status(403).json({ error: "You do not have access to this document" });
    }
    next();
  };
}
function validateFileContent(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return false;
  }

  if (mimeType === "application/pdf") {
    return buffer.subarray(0, 5).toString() === "%PDF-";
  }

  if (mimeType === "image/png") {
    return buffer.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    );
  }

  if (mimeType === "image/jpeg") {
    return (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }

  if (mimeType === "text/plain") {
    // Reject binary-looking files containing NUL bytes.
    if (buffer.includes(0)) return false;

    // Reject invalid UTF-8 text.
    const text = new TextDecoder("utf-8", {
      fatal: true,
    });

    try {
      text.decode(buffer);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}
const upload = multer({
  storage: multer.diskStorage({
    destination: PRIVATE_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomUUID()),
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const allowed = new Set([
      "application/pdf",
      "image/png",
      "image/jpeg",
      "text/plain",
    ]);
    if (!allowed.has(file.mimetype)) {
      return cb(new Error("Only PDF, PNG, JPEG and plain text files are allowed"));
    }
    cb(null, true);
  },
});

app.get("/", (req, res) => {
  res.json({ message: "TrustVault API is running", status: "success" });
});

app.post("/api/auth/register",
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 }),
  async (req, res, next) => {
    try {
      const input = z.object({
        name: z.string().trim().min(2).max(100),
        email: z.string().trim().email().max(254),
        password: strongPasswordSchema,
      }).parse(req.body);

      const email = input.email.toLowerCase();
      if (await User.exists({ email })) {
        return res.status(409).json({ error: "Email is already registered" });
      }

      const user = await User.create({
        name: input.name,
        email,
        passwordHash: await bcrypt.hash(input.password, 12),
        role: "viewer",
      });

      await audit(user._id, "USER_REGISTERED");
      res.status(201).json({
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
      });
    } catch (err) {
      next(err);
    }
  }
);

app.post("/api/auth/login",
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 }),
  async (req, res, next) => {
    try {
      const input = z.object({
        email: z.string().email(),
        password: z.string().min(1).max(128),
      }).parse(req.body);

      const user = await User.findOne({
        email: input.email.toLowerCase(),
      }).select("+passwordHash");

      if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
        await audit(null, "LOGIN_FAILED", null, { email: input.email.toLowerCase() });
        return res.status(401).json({ error: "Invalid email or password" });
      }

      await new Promise((resolve, reject) => {
        req.session.regenerate(err => err ? reject(err) : resolve());
      });
      req.session.userId = String(user._id);
await audit(user._id, "LOGIN_SUCCESS");


await new Promise((resolve, reject) => {
  req.session.save(err => err ? reject(err) : resolve());
});
await new Promise((resolve, reject) => {
  req.session.save(err => err ? reject(err) : resolve());
});
res.json({
  user: { id: user._id, name: user.name, email: user.email, role: user.role },
});
    } catch (err) {
      next(err);
    }
  }
);

app.post("/api/auth/change-password", requireAuth, loadUser, async (req, res, next) => {
  try {
    const input = z.object({
      currentPassword: z.string().min(1).max(128),
      newPassword: strongPasswordSchema,
    }).parse(req.body);
    const user = await User.findById(req.user._id).select("+passwordHash");
    if (!user || !(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
      await audit(req.user._id, "PASSWORD_CHANGE_FAILED");
      return res.status(400).json({ error: "Current password is incorrect" });
    }
    if (await bcrypt.compare(input.newPassword, user.passwordHash)) {
      return res.status(400).json({ error: "Choose a new password different from your current password" });
    }
    user.passwordHash = await bcrypt.hash(input.newPassword, 12);
    await user.save();
    await PasswordReset.deleteMany({ userId: user._id });
    await audit(user._id, "PASSWORD_CHANGED");
    res.json({ message: "Password changed successfully" });
  } catch (err) { next(err); }
});

const passwordResetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5 });
app.post("/api/auth/forgot-password", passwordResetLimiter, async (req, res, next) => {
  try {
    const input = z.object({ email: z.string().trim().email().max(254) }).parse(req.body);
    const generic = { message: "If an account exists for that email, password reset instructions are available." };
    const user = await User.findOne({ email: input.email.toLowerCase() });
    if (!user) return res.json(generic);

    await PasswordReset.deleteMany({ userId: user._id });
    const token = crypto.randomBytes(32).toString("hex");
    await PasswordReset.create({
      userId: user._id,
      tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });
    await audit(user._id, "PASSWORD_RESET_REQUESTED");

    // Development/demo only: never expose reset tokens in production responses.
    if (process.env.NODE_ENV !== "production") {
      return res.json({ ...generic, developmentResetToken: token });
    }
    if (process.env.PASSWORD_RESET_WEBHOOK_URL && process.env.PASSWORD_RESET_WEBHOOK_SECRET) {
      try {
        const response = await fetch(process.env.PASSWORD_RESET_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.PASSWORD_RESET_WEBHOOK_SECRET}` },
          body: JSON.stringify({
            email: user.email,
            token,
            expiresInMinutes: 15,
            resetUrl: `${process.env.CLIENT_ORIGIN || "http://localhost:5173"}/#reset?email=${encodeURIComponent(user.email)}&resetToken=${encodeURIComponent(token)}`,
          }),
        });
        if (!response.ok) console.error("Password reset delivery provider returned an error");
      } catch { console.error("Password reset delivery failed"); }
    } else {
      console.error("Password reset delivery is not configured; set PASSWORD_RESET_WEBHOOK_URL and PASSWORD_RESET_WEBHOOK_SECRET");
    }
    return res.json(generic);
  } catch (err) { next(err); }
});

app.post("/api/auth/reset-password", passwordResetLimiter, async (req, res, next) => {
  try {
    const input = z.object({
      email: z.string().trim().email().max(254),
      token: z.string().min(32).max(256),
      newPassword: strongPasswordSchema,
    }).parse(req.body);
    const user = await User.findOne({ email: input.email.toLowerCase() });
    const tokenHash = crypto.createHash("sha256").update(input.token).digest("hex");
    const reset = user ? await PasswordReset.findOne({ userId: user._id, tokenHash, expiresAt: { $gt: new Date() } }) : null;
    if (!reset) return res.status(400).json({ error: "Reset link is invalid or expired. Request a new one." });
    user.passwordHash = await bcrypt.hash(input.newPassword, 12);
    await user.save();
    await PasswordReset.deleteMany({ userId: user._id });
    await audit(user._id, "PASSWORD_RESET_COMPLETED");
    res.json({ message: "Password reset successfully. Please log in with your new password." });
  } catch (err) { next(err); }
});

app.post("/api/auth/logout", requireAuth, loadUser, async (req, res, next) => {
  try {
    await audit(req.user._id, "LOGOUT");
    req.session.destroy(err => {
      if (err) return res.status(500).json({ error: "Logout failed" });
      res.clearCookie("trustvault.sid", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
      res.json({ message: "Logged out" });
    });
  } catch (err) {
    next(err);
  }
});

app.get("/api/auth/me", requireAuth, loadUser, (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
  });
});

app.post("/api/documents",
  requireAuth, loadUser, allowRoles("owner", "admin"), (req, res, next) => {
    upload.single("file")(req, res, async err => {
      if (err) {
        await audit(req.user._id, "UPLOAD_REJECTED", null, {
          reason: err.message,
        }).catch(() => {});
        return res.status(400).json({ error: err.message });
      }

      try {
        if (!req.file) {
          return res.status(400).json({ error: "A file is required" });
        }
        const fileBuffer = await fs.promises.readFile(req.file.path);

if (!validateFileContent(fileBuffer, req.file.mimetype)) {
  await fs.promises.unlink(req.file.path).catch(() => {});

  await audit(req.user._id, "UPLOAD_REJECTED", null, {
    reason: "File content does not match the declared type",
  }).catch(() => {});

  return res.status(400).json({
    error: "File content does not match the allowed file type",
  });
}
        const input = z.object({
          name: z.string().trim().min(1).max(200).optional(),
          category: z.string().trim().max(80).optional(),
        }).parse(req.body);

        const doc = await Document.create({
          name: input.name || path.basename(req.file.originalname).slice(0, 200),
          category: input.category || "General",
          ownerId: req.user._id,
          storageName: req.file.filename,
          mimeType: req.file.mimetype,
          size: req.file.size,
        });

        await audit(req.user._id, "DOCUMENT_UPLOADED", doc._id);
        res.status(201).json({
          document: {
            id: doc._id,
            name: doc.name,
            category: doc.category,
            size: doc.size,
            createdAt: doc.createdAt,
          },
        });
      } catch (e) {
        if (req.file) fs.promises.unlink(req.file.path).catch(() => {});
        next(e);
      }
    });
  }
);

app.get("/api/documents", requireAuth, loadUser, async (req, res, next) => {
  try {
    const filter = {
      $or: [
        { ownerId: req.user._id },
        { "grants.userId": req.user._id },
      ],
    };

    if (req.query.category) {
  filter.category = String(req.query.category).slice(0, 80);
}

if (req.query.from || req.query.to) {
  filter.createdAt = {};

  if (req.query.from) {
    const from = new Date(String(req.query.from));

    if (Number.isNaN(from.getTime())) {
      return res.status(400).json({
        error: "Invalid 'from' date",
      });
    }

    filter.createdAt.$gte = from;
  }

  if (req.query.to) {
    const toValue = String(req.query.to);
    const to = new Date(toValue);

    if (Number.isNaN(to.getTime())) {
      return res.status(400).json({
        error: "Invalid 'to' date",
      });
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(toValue)) to.setHours(23, 59, 59, 999);
    filter.createdAt.$lte = to;
  }

  if (
    filter.createdAt.$gte &&
    filter.createdAt.$lte &&
    filter.createdAt.$gte > filter.createdAt.$lte
  ) {
    return res.status(400).json({
      error: "'from' date must not be later than 'to' date",
    });
  }
}

    const docs = await Document.find(filter).sort({ createdAt: -1 }).lean();
    const q = String(req.query.q || "").toLowerCase();
    const results = [];

    for (const doc of docs) {
      const owner = await User.findById(doc.ownerId).select("name email").lean();
      if (q && !doc.name.toLowerCase().includes(q) &&
          !(owner?.name || "").toLowerCase().includes(q) &&
          !(owner?.email || "").toLowerCase().includes(q) &&
          !doc.category.toLowerCase().includes(q)) continue;

      const grants = String(doc.ownerId) === String(req.user._id)
        ? await Promise.all(doc.grants.map(async grant => {
            const grantedUser = await User.findById(grant.userId).select("name email").lean();
            return grantedUser ? { userId: String(grantedUser._id), name: grantedUser.name, email: grantedUser.email, permission: grant.permission } : null;
          }))
        : [];
      results.push({
        id: doc._id,
        name: doc.name,
        category: doc.category,
        owner: owner?.name || "Unknown",
        ownerEmail: owner?.email,
        permission: permissionFor(doc, req.user),
        grants: grants.filter(Boolean),
        size: doc.size,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      });
    }
    res.json({ documents: results });
  } catch (err) {
    next(err);
  }
});

app.get("/api/documents/:id/download",
  requireAuth, loadUser, findDocument, requireDocumentAccess("read"),
  async (req, res, next) => {
    try {
      const filePath = path.join(PRIVATE_DIR, req.document.storageName);
      await fs.promises.access(filePath);
      await audit(req.user._id, "DOCUMENT_DOWNLOADED", req.document._id);
      res.download(filePath, req.document.name, err => {
        if (err && !res.headersSent) next(err);
      });
    } catch (err) {
      await audit(req.user._id, "DOWNLOAD_FAILED", req.document._id).catch(() => {});
      if (!res.headersSent) res.status(404).json({ error: "File unavailable" });
    }
  }
);

app.patch("/api/documents/:id",
  requireAuth, loadUser, findDocument, requireDocumentAccess("edit"),
  async (req, res, next) => {
    try {
      const input = z.object({
        name: z.string().trim().min(1).max(200).optional(),
        category: z.string().trim().max(80).optional(),
      }).strict().parse(req.body);

      Object.assign(req.document, input);
      await req.document.save();
      await audit(req.user._id, "DOCUMENT_UPDATED", req.document._id, input);
      res.json({ message: "Document updated" });
    } catch (err) {
      next(err);
    }
  }
);

app.post("/api/documents/:id/grants",
  requireAuth, loadUser, findDocument,
  async (req, res, next) => {
    try {
      if (String(req.document.ownerId) !== String(req.user._id)) {
        await audit(req.user._id, "PERMISSION_CHANGE_DENIED", req.document._id);
        return res.status(403).json({ error: "Only the document owner can grant access" });
      }

      const input = z.object({
        email: z.string().email(),
        permission: z.enum(["read", "edit"]),
      }).parse(req.body);

      const target = await User.findOne({ email: input.email.toLowerCase() });
      if (!target) return res.status(404).json({ error: "User not found" });
      if (String(target._id) === String(req.user._id)) {
        return res.status(400).json({ error: "You already own this document" });
      }

      req.document.grants = req.document.grants.filter(
        g => String(g.userId) !== String(target._id)
      );
      req.document.grants.push({ userId: target._id, permission: input.permission });
      await req.document.save();

      await audit(req.user._id, "PERMISSION_GRANTED", req.document._id, {
        targetUserId: String(target._id),
        permission: input.permission,
      });
      res.json({ message: "Access granted" });
    } catch (err) {
      next(err);
    }
  }
);

app.delete("/api/documents/:id/grants/:userId",
  requireAuth, loadUser, findDocument,
  async (req, res, next) => {
    try {
      if (String(req.document.ownerId) !== String(req.user._id)) {
        await audit(req.user._id, "PERMISSION_CHANGE_DENIED", req.document._id);
        return res.status(403).json({ error: "Only the document owner can revoke access" });
      }
      if (!validId(req.params.userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }

      const before = req.document.grants.length;
      req.document.grants = req.document.grants.filter(
        g => String(g.userId) !== req.params.userId
      );
      if (before === req.document.grants.length) {
        return res.status(404).json({ error: "Grant not found" });
      }

      await req.document.save();
      await audit(req.user._id, "PERMISSION_REVOKED", req.document._id, {
        targetUserId: req.params.userId,
      });
      res.json({ message: "Access revoked" });
    } catch (err) {
      next(err);
    }
  }
);

app.delete("/api/documents/:id",
  requireAuth, loadUser, findDocument,
  async (req, res, next) => {
    try {
      if (String(req.document.ownerId) !== String(req.user._id)) {
        await audit(req.user._id, "DOCUMENT_DELETE_DENIED", req.document._id);
        return res.status(403).json({ error: "Only the owner can delete this document" });
      }

      await audit(req.user._id, "DOCUMENT_DELETED", req.document._id, {
        name: req.document.name,
      });
      await fs.promises.unlink(path.join(PRIVATE_DIR, req.document.storageName))
        .catch(() => {});
      await req.document.deleteOne();
      res.json({ message: "Document deleted" });
    } catch (err) {
      next(err);
    }
  }
);

app.get("/api/admin/users", requireAuth, loadUser, allowRoles("admin"),
  async (req, res, next) => {
    try {
      const users = await User.find().select("name email role createdAt").lean();
      res.json({ users });
    } catch (err) {
      next(err);
    }
  }
);

app.patch("/api/admin/users/:id/role", requireAuth, loadUser, allowRoles("admin"),
  async (req, res, next) => {
    try {
      if (!validId(req.params.id)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }
      const input = z.object({
        role: z.enum(["admin", "owner", "viewer"]),
      }).parse(req.body);

      const target = await User.findById(req.params.id);
if (!target) {
  return res.status(404).json({ error: "User not found" });
}

if (String(target._id) === String(req.user._id)) {
  await audit(req.user._id, "SELF_ROLE_CHANGE_DENIED", null, {
    requestedRole: input.role,
  });

  return res.status(403).json({
    error: "You cannot change your own role",
  });
}

const previousRole = target.role;
      target.role = input.role;
      await target.save();
      await audit(req.user._id, "USER_ROLE_CHANGED", null, {
        targetUserId: String(target._id),
        previousRole,
        newRole: input.role,
      });
      res.json({ message: "Role updated" });
    } catch (err) {
      next(err);
    }
  }
);

app.get("/api/admin/audit", requireAuth, loadUser, allowRoles("admin"),
  async (req, res, next) => {
    try {
      const logs = await Audit.find().sort({ createdAt: -1 }).limit(500).lean();
      res.json({ audit: logs });
    } catch (err) {
      next(err);
    }
  }
);
app.get(
  "/api/admin/audit/verify",
  requireAuth,
  loadUser,
  allowRoles("admin"),
  async (req, res, next) => {
    try {
      const result = await verifyAuditChain();
      res.status(result.valid ? 200 : 409).json(result);
    } catch (err) {
      next(err);
    }
  }
);
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof z.ZodError) {
    return res.status(400).json({ error: "Invalid input", details: err.issues });
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: "A record with that value already exists" });
  }
  console.error(err.message);
  res.status(500).json({ error: "Internal server error" });
});

async function startServer() {
  await mongoose.connect(process.env.MONGODB_URI);
  return app.listen(PORT, () => console.log(`TrustVault API listening on ${PORT}`));
}

if (require.main === module) {
  startServer().catch(err => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
}

module.exports = {
  app,
  startServer,
  User,
  Document,
  Audit,
  PasswordReset,
  verifyAuditChain,
  validateFileContent,
  sessionStore,
};