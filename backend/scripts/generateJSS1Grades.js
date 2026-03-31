// scripts/generateJSS1Grades.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Configuration
const SESSION_NAME = "2025-2026";
const CLASS_NAME = "JSS 1";
const TERMS = ["First Term", "Second Term", "Third Term"];

// Subjects for JSS 1
const SUBJECTS = [
  "Mathematics",
  "English Language",
  "Basic Science",
  "Basic Technology",
  "Social Studies",
  "Civic Education",
  "Christian Religious Studies",
  "Agricultural Science",
  "Business Studies",
  "Computer Science",
  "Home Economics",
  "French"
];

// Generate realistic scores
function generateCAScore() {
  // CA scores between 25-40 (out of 40)
  return Math.floor(Math.random() * (40 - 25 + 1) + 25);
}

function generateExamScore() {
  // Exam scores between 35-60 (out of 60)
  return Math.floor(Math.random() * (60 - 35 + 1) + 35);
}

function getGradeLetter(score) {
  if (score >= 70) return "A";
  if (score >= 60) return "B";
  if (score >= 50) return "C";
  if (score >= 45) return "D";
  if (score >= 40) return "E";
  return "F";
}

async function generateJSS1Grades() {
  console.log("🚀 Starting grade generation for JSS 1...\n");

  // 1. Get the session
  const session = await prisma.session.findFirst({
    where: { name: SESSION_NAME }
  });

  if (!session) {
    console.error(`❌ Session "${SESSION_NAME}" not found!`);
    return;
  }
  console.log(`✅ Found session: ${session.name}`);

  // 2. Get all terms for this session
  const terms = await prisma.term.findMany({
    where: {
      sessionId: session.id,
      name: { in: TERMS }
    },
    orderBy: { startDate: 'asc' }
  });

  if (terms.length === 0) {
    console.error(`❌ No terms found for session "${SESSION_NAME}"!`);
    return;
  }
  console.log(`✅ Found ${terms.length} terms: ${terms.map(t => t.name).join(", ")}`);

  // 3. Get the class
  const classData = await prisma.class.findFirst({
    where: { name: CLASS_NAME }
  });

  if (!classData) {
    console.error(`❌ Class "${CLASS_NAME}" not found!`);
    return;
  }
  console.log(`✅ Found class: ${classData.name}`);

  // 4. Get all students in JSS 1
  const students = await prisma.student.findMany({
    where: { classId: classData.id },
    include: { user: true }
  });

  if (students.length === 0) {
    console.error(`❌ No students found in ${CLASS_NAME}!`);
    return;
  }
  console.log(`✅ Found ${students.length} students in ${CLASS_NAME}`);

  // 5. Get all subjects for JSS 1
  const subjects = await prisma.subject.findMany({
    where: {
      classes: {
        some: {
          classId: classData.id
        }
      }
    }
  });

  if (subjects.length === 0) {
    console.error(`❌ No subjects found for ${CLASS_NAME}!`);
    return;
  }
  console.log(`✅ Found ${subjects.length} subjects for ${CLASS_NAME}`);

  console.log("\n📊 Generation Summary:");
  console.log(`   Students: ${students.length}`);
  console.log(`   Subjects: ${subjects.length}`);
  console.log(`   Terms: ${terms.length}`);
  console.log(`   Total Grade Records: ${students.length * subjects.length * terms.length * 2}\n`);

  let successCount = 0;
  let errorCount = 0;
  let studentCount = 0;

  // 6. Generate grades for each student
  for (const student of students) {
    studentCount++;
    console.log(`\n📝 Processing student ${studentCount}/${students.length}: ${student.user?.name}`);

    for (const term of terms) {
      for (const subject of subjects) {
        try {
          // Generate scores
          const caScore = generateCAScore();
          const examScore = generateExamScore();
          const caPercentage = (caScore / 40) * 100;
          const examPercentage = (examScore / 60) * 100;
          const totalScore = caScore + examScore;
          const gradeLetter = getGradeLetter(totalScore);

          // Check if CA grade already exists
          const existingCAGrade = await prisma.grade.findFirst({
            where: {
              studentId: student.id,
              subjectId: subject.id,
              termId: term.id,
              type: "CA"
            }
          });

          // Check if Exam grade already exists
          const existingExamGrade = await prisma.grade.findFirst({
            where: {
              studentId: student.id,
              subjectId: subject.id,
              termId: term.id,
              type: "EXAM"
            }
          });

          // Create or update CA grade
          if (existingCAGrade) {
            await prisma.grade.update({
              where: { id: existingCAGrade.id },
              data: {
                score: caScore,
                percentage: caPercentage,
                gradeLetter: getGradeLetter(caPercentage),
                maxScore: 40,
                updatedAt: new Date()
              }
            });
          } else {
            await prisma.grade.create({
              data: {
                score: caScore,
                percentage: caPercentage,
                gradeLetter: getGradeLetter(caPercentage),
                type: "CA",
                category: "CA",
                studentId: student.id,
                subjectId: subject.id,
                termId: term.id,
                maxScore: 40,
                createdAt: new Date(),
                updatedAt: new Date()
              }
            });
          }

          // Create or update Exam grade
          if (existingExamGrade) {
            await prisma.grade.update({
              where: { id: existingExamGrade.id },
              data: {
                score: examScore,
                percentage: examPercentage,
                gradeLetter: getGradeLetter(examPercentage),
                maxScore: 60,
                updatedAt: new Date()
              }
            });
          } else {
            await prisma.grade.create({
              data: {
                score: examScore,
                percentage: examPercentage,
                gradeLetter: getGradeLetter(examPercentage),
                type: "EXAM",
                category: "EXAM",
                studentId: student.id,
                subjectId: subject.id,
                termId: term.id,
                maxScore: 60,
                createdAt: new Date(),
                updatedAt: new Date()
              }
            });
          }

          successCount++;
          console.log(`   ✅ ${term.name} - ${subject.name}: CA=${caScore}/40, Exam=${examScore}/60, Total=${totalScore}/100, Grade=${gradeLetter}`);
        } catch (error) {
          errorCount++;
          console.error(`   ❌ Error for ${student.user?.name} - ${term.name} - ${subject.name}:`, error.message);
        }
      }
    }
  }

  // 7. Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 GENERATION COMPLETE!");
  console.log("=".repeat(50));
  console.log(`✅ Successful: ${successCount} grade records`);
  console.log(`❌ Errors: ${errorCount} grade records`);
  console.log(`📚 Total: ${students.length} students, ${subjects.length} subjects, ${terms.length} terms`);
  console.log(`🎓 All JSS 1 students now have grades for all terms!`);
  console.log("\n✨ You can now view the results in the Teacher Results page.");
}

// Run the script
generateJSS1Grades()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });