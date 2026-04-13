const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Render database...\n');

  // 1. Create Users
  console.log('📝 Creating users...');
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
      console.log(`  ✅ Created: ${user.name} (${user.role})`);
    } else {
      console.log(`  ⚠️ Already exists: ${user.name}`);
    }
  }

  // 2. Create Classes
  console.log('\n🏫 Creating classes...');
  const classNames = ['JSS 1', 'JSS 2', 'JSS 3', 'SSS 1', 'SSS 2', 'SSS 3'];
  const classes = {};
  
  for (let i = 0; i < classNames.length; i++) {
    const existing = await prisma.class.findUnique({ where: { name: classNames[i] } });
    if (!existing) {
      const cls = await prisma.class.create({ 
        data: { name: classNames[i], grade: i + 7 } 
      });
      classes[classNames[i]] = cls;
      console.log(`  ✅ Created class: ${classNames[i]}`);
    } else {
      classes[classNames[i]] = existing;
      console.log(`  ⚠️ Class already exists: ${classNames[i]}`);
    }
  }

  // 3. Create Subjects
  console.log('\n📚 Creating subjects...');
  const subjectNames = ['English', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Economics', 'Government'];
  
  for (const name of subjectNames) {
    const existing = await prisma.subject.findFirst({ where: { name } });
    if (!existing) {
      await prisma.subject.create({ data: { name } });
      console.log(`  ✅ Created subject: ${name}`);
    } else {
      console.log(`  ⚠️ Subject already exists: ${name}`);
    }
  }

  // 4. Create Teacher Profiles
  console.log('\n👨‍🏫 Creating teacher profiles...');
  
  const mathTeacher = await prisma.user.findUnique({ where: { email: 'teacher.math@school.com' } });
  if (mathTeacher) {
    const existing = await prisma.teacher.findUnique({ where: { userId: mathTeacher.id } });
    if (!existing) {
      await prisma.teacher.create({ data: { userId: mathTeacher.id } });
      console.log('  ✅ Created teacher profile for Math Teacher');
    }
  }

  const classTeacherUser = await prisma.user.findUnique({ where: { email: 'classteacher@school.com' } });
  let classTeacher = null;
  if (classTeacherUser) {
    const existing = await prisma.teacher.findUnique({ where: { userId: classTeacherUser.id } });
    if (!existing) {
      classTeacher = await prisma.teacher.create({ data: { userId: classTeacherUser.id } });
      console.log('  ✅ Created teacher profile for Class Teacher');
    } else {
      classTeacher = existing;
    }
  }

  // 5. Assign Class Teacher to SSS 1
  if (classTeacher && classes['SSS 1']) {
    await prisma.class.update({
      where: { id: classes['SSS 1'].id },
      data: { classTeacherId: classTeacher.id }
    });
    console.log('\n✅ Assigned Class Teacher to SSS 1');
  }

  // 6. Create Parent Profile
  console.log('\n👪 Creating parent profile...');
  const parentUser = await prisma.user.findUnique({ where: { email: 'parent@school.com' } });
  let parent = null;
  if (parentUser) {
    const existing = await prisma.parent.findUnique({ where: { userId: parentUser.id } });
    if (!existing) {
      parent = await prisma.parent.create({ data: { userId: parentUser.id } });
      console.log('  ✅ Created parent profile');
    }
  }

  // 7. Create Student
  console.log('\n🎓 Creating student...');
  const studentUser = await prisma.user.findUnique({ where: { email: 'student@school.edu' } });
  if (studentUser && classes['SSS 1']) {
    const existing = await prisma.student.findFirst({ where: { userId: studentUser.id } });
    if (!existing) {
      await prisma.student.create({
        data: {
          userId: studentUser.id,
          classId: classes['SSS 1'].id,
          parentId: parent?.id || null,
          admissionNo: 'STU240001',
          gender: 'Male'
        }
      });
      console.log('  ✅ Created student: James Smith');
    }
  }

  // 8. Create Session
  console.log('\n📅 Creating session...');
  const year = new Date().getFullYear();
  const sessionName = `${year}-${year + 1}`;
  
  let session = await prisma.session.findUnique({ where: { name: sessionName } });
  if (!session) {
    session = await prisma.session.create({
      data: {
        name: sessionName,
        startDate: new Date(`${year}-09-01`),
        endDate: new Date(`${year + 1}-07-31`),
        isActive: true
      }
    });
    console.log(`  ✅ Created session: ${sessionName}`);
  }

  // 9. Create Terms
  console.log('\n📅 Creating terms...');
  const terms = ['1st Term', '2nd Term', '3rd Term'];
  for (let i = 0; i < terms.length; i++) {
    const existing = await prisma.term.findFirst({
      where: { name: terms[i], sessionId: session.id }
    });
    if (!existing) {
      await prisma.term.create({
        data: {
          name: terms[i],
          sessionId: session.id,
          startDate: new Date(`${year}-09-${i * 2 + 1}`),
          endDate: new Date(`${year}-12-${i * 10 + 20}`),
          isActive: i === 0
        }
      });
      console.log(`  ✅ Created term: ${terms[i]}`);
    }
  }

  console.log('\n✅ Seeding completed successfully!');
  console.log('\n📋 Login Credentials:');
  console.log('   Admin: admin@school.com / admin123');
  console.log('   Principal: principal@school.com / principal123');
  console.log('   Teacher: teacher.math@school.com / teacher123');
  console.log('   Class Teacher: classteacher@school.com / classteacher123');
  console.log('   Parent: parent@school.com / parent123');
  console.log('   Student: student@school.edu / student123');
  console.log('   Bursar: bursar@school.com / bursar123');
}

main()
  .catch(e => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });