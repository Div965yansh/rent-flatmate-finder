import 'dotenv/config';
import prisma from '../src/config/prisma.js';
import app from '../src/app.js';
import { DEMO_PASSWORD } from '../prisma/seed.js';

async function verify() {
  console.log('--- 1. DATABASE RECORD VERIFICATION ---');

  const demoEmails = [
    'admin@example.com',
    'owner1@example.com',
    'owner2@example.com',
    'tenant1@example.com',
    'tenant2@example.com',
  ];

  const users = await prisma.user.findMany({
    where: { email: { in: demoEmails } },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      passwordHash: true,
    },
    orderBy: { email: 'asc' },
  });

  console.log(`Total demo users found: ${users.length} (Expected: 5)`);

  const roleCounts = users.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});

  console.log(`- ADMIN count: ${roleCounts.ADMIN || 0} (Expected: 1)`);
  console.log(`- OWNER count: ${roleCounts.OWNER || 0} (Expected: 2)`);
  console.log(`- TENANT count: ${roleCounts.TENANT || 0} (Expected: 2)`);

  const allActive = users.every((u) => u.isActive === true);
  console.log(`All demo accounts active: ${allActive}`);

  const allHashed = users.every((u) => u.passwordHash.startsWith('$2b$'));
  console.log(`All passwords properly bcrypt-hashed: ${allHashed}`);

  console.log('\n--- 2. HTTP LOGIN VERIFICATION (POST /api/auth/login) ---');

  // Start server on dynamic port
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const loginUrl = `http://127.0.0.1:${port}/api/auth/login`;

  for (const email of demoEmails) {
    const res = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: DEMO_PASSWORD,
      }),
    });

    const data = await res.json();
    const ok = res.status === 200 && data.token && data.user.email === email;

    console.log(
      `[${res.status}] Login for ${email} (${data.user?.role}): ${ok ? 'SUCCESS ✅' : 'FAILED ❌'}`
    );
  }

  server.close();
  await prisma.$disconnect();
}

verify().catch((err) => {
  console.error(err);
  process.exit(1);
});
