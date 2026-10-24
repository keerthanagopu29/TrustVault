require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to seed demo accounts in production. Use a separate demo environment.');
}
if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI must be configured.');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin', 'owner', 'viewer'], default: 'viewer' },
}, { timestamps: true });
const User = mongoose.models.User || mongoose.model('User', userSchema);

const accounts = [
  { name: 'TrustVault Demo Admin', role: 'admin', email: process.env.DEMO_ADMIN_EMAIL, password: process.env.DEMO_ADMIN_PASSWORD },
  { name: 'TrustVault Demo Owner', role: 'owner', email: process.env.DEMO_OWNER_EMAIL, password: process.env.DEMO_OWNER_PASSWORD },
  { name: 'TrustVault Demo Viewer', role: 'viewer', email: process.env.DEMO_VIEWER_EMAIL, password: process.env.DEMO_VIEWER_PASSWORD },
];

(async () => {
  if (accounts.some(account => !account.email || !account.password)) {
    throw new Error('Set all DEMO_*_EMAIL and DEMO_*_PASSWORD values in server/.env before seeding.');
  }
  if (accounts.some(account => account.password.length < 12)) {
    throw new Error('Each demo password must be at least 12 characters.');
  }
  await mongoose.connect(process.env.MONGODB_URI);
  for (const account of accounts) {
    const email = account.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(account.password, 12);
    await User.findOneAndUpdate(
      { email },
      { $set: { name: account.name, email, role: account.role, passwordHash } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
    console.log(`Seeded ${account.role} demo account: ${email}`);
  }
  await mongoose.disconnect();
})().catch(async error => {
  console.error('Demo seeding failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
