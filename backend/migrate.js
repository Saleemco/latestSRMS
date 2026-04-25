const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runMigration() {
  console.log('🚀 Starting migration...');
  
  try {
    // Test connection
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connected');

    // Create enum
    console.log('📝 Creating CommentType enum...');
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        CREATE TYPE "CommentType" AS ENUM ('GENERAL', 'STRENGTH', 'WEAKNESS', 'TEACHER_RECOMMENDATION', 'PRINCIPAL_REMARK');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('✅ CommentType enum created');

    // Create table
    console.log('📝 Creating ClassTeacherComment table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ClassTeacherComment" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "studentId" TEXT NOT NULL,
        "termId" TEXT NOT NULL,
        "comment" TEXT NOT NULL,
        "type" "CommentType" NOT NULL DEFAULT 'GENERAL',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ ClassTeacherComment table created');

    // Add constraints
    console.log('📝 Adding constraints...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "ClassTeacherComment" ADD CONSTRAINT IF NOT EXISTS "ClassTeacherComment_studentId_termId_type_key" UNIQUE ("studentId", "termId", "type");
    `);

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "ClassTeacherComment" ADD CONSTRAINT IF NOT EXISTS "ClassTeacherComment_studentId_fkey" 
        FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    `);

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "ClassTeacherComment" ADD CONSTRAINT IF NOT EXISTS "ClassTeacherComment_termId_fkey" 
        FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    `);
    console.log('✅ All constraints added');

    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();