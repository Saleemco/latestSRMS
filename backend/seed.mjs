import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  const users = [
    { email: 'admin@school.com', password: 'admin123', name: 'Admin User', role: 'ADMIN' },
    { email: 'principal@school.com', password: 'principal123', name: 'Dr. James Wilson', role: 'PRINCIPAL' },
    { email: 'bursar@school.com', password: 'bursar123', name: 'Mr. John Doe', role: 'BURSAR' },
    { email: 'teacher.math@school.com', password: 'teacher123', name: 'Mr. Michael Brown', role: 'TEACHER' },
    { email: 'classteacher@school.com', password: 'classteacher123', name: 'Mrs. Patricia Lee', role: 'TEACHER' },
    { email: 'parent@school.com', password: 'parent123', name: 'John Parent', role: 'PARENT' },
    { email: 'student@school.edu', password: 'student123', name: 'James Smith', role: 'STUDENT' },
  ];

  for (const user of users) {
    const existing = await prisma.user.findUnique({ where: { email: user.email } });
    if (!existing) {
      await prisma.user.create({ data: user });
      console.log(`✅ Created: ${user.name}`);
    }
  }

  console.log('\n✅ Seeding completed!');
  console.log('\n📋 Login: admin@school.com / admin123');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());