import 'dotenv/config';
import prisma from '../src/config/prisma.js';
import { hashPassword } from '../src/utils/password.js';

/**
 * Standard development password for all seeded demo accounts.
 */
export const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD || 'DevPassword123!';

const DEMO_USERS = [
  {
    name: 'System Admin',
    email: 'admin@example.com',
    role: 'ADMIN',
  },
  {
    name: 'Property Owner 1',
    email: 'owner1@example.com',
    role: 'OWNER',
  },
  {
    name: 'Property Owner 2',
    email: 'owner2@example.com',
    role: 'OWNER',
  },
  {
    name: 'Flatmate Seeker 1',
    email: 'tenant1@example.com',
    role: 'TENANT',
  },
  {
    name: 'Flatmate Seeker 2',
    email: 'tenant2@example.com',
    role: 'TENANT',
  },
];

async function main() {
  console.log('🌱 Starting Phase 2 database seed...');
  console.log(`ℹ️  Default password for demo accounts: "${DEMO_PASSWORD}"`);

  // Hash password using the existing bcrypt utility
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const seededUsers = [];

  for (const demoUser of DEMO_USERS) {
    // Idempotent upsert by unique email
    const user = await prisma.user.upsert({
      where: { email: demoUser.email },
      update: {
        name: demoUser.name,
        role: demoUser.role,
        isActive: true,
        passwordHash,
      },
      create: {
        name: demoUser.name,
        email: demoUser.email,
        role: demoUser.role,
        isActive: true,
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    seededUsers.push(user);
    console.log(`  ✓ Seeded [${user.role}] ${user.email} (${user.name})`);
  }

  console.log(`\n🎉 Seed finished. Total demo accounts ensured: ${seededUsers.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
