const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  console.log('🔍 Checking database...\n');
  
  const sessions = await prisma.session.findMany();
  console.log('📅 Sessions:', sessions.length);
  sessions.forEach(s => {
    console.log(`  - ${s.name} (ID: ${s.id}, Active: ${s.isActive})`);
  });
  
  console.log('\n');
  
  const terms = await prisma.term.findMany({
    include: { session: true }
  });
  console.log('📚 Terms:', terms.length);
  terms.forEach(t => {
    console.log(`  - ${t.name} (Session: ${t.session?.name}, Active: ${t.isActive})`);
  });
  
  if (sessions.length === 0) {
    console.log('\n⚠️  No sessions found! Create one first.');
  }
  
  if (terms.length === 0) {
    console.log('\n⚠️  No terms found! Create terms for your session.');
  }
  
  await prisma.$disconnect();
}

check();