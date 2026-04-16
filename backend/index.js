const express = require('express');
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const app = express();
const port = process.env.PORT || 3001;

// Configure multer for file upload
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Middleware
app.use(cors());
app.use(express.json());

// Debug middleware - log all requests
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.url}`);
  next();
});

// ==================== HEALTH CHECK ====================
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'School Management API is running',
    timestamp: new Date().toISOString()
  });
});

// ==================== AUTH ENDPOINTS ====================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase();
    console.log('Login attempt for email:', normalizedEmail);

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (!user) {
      console.log('User not found:', normalizedEmail);
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid email or password' 
      });
    }

    if (user.password !== password) {
      console.log('Invalid password for:', normalizedEmail);
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid email or password' 
      });
    }

    const nameParts = user.name ? user.name.split(' ') : ['', ''];
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const { password: _, ...userWithoutPassword } = user;
    
    const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');

    console.log('Login successful for:', normalizedEmail);
    
    res.json({
      success: true,
      data: {
        user: {
          id: userWithoutPassword.id,
          email: userWithoutPassword.email,
          name: userWithoutPassword.name,
          firstName: firstName,
          lastName: lastName,
          role: userWithoutPassword.role
        },
        token: token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Login failed' 
    });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'No token provided' 
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = Buffer.from(token, 'base64').toString();
      const userId = decoded.split(':')[0];
      
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });
      
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          error: 'User not found' 
        });
      }
      
      const nameParts = user.name ? user.name.split(' ') : ['', ''];
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      const { password, ...userWithoutPassword } = user;
      
      res.json({
        success: true,
        data: {
          id: userWithoutPassword.id,
          email: userWithoutPassword.email,
          name: userWithoutPassword.name,
          firstName: firstName,
          lastName: lastName,
          role: userWithoutPassword.role
        }
      });
    } catch (decodeError) {
      console.error('Token decode error:', decodeError);
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid token' 
      });
    }
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get user data' 
    });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, role, classIds, subjectIds } = req.body;
    const normalizedEmail = email.toLowerCase();
    console.log('📝 Registration attempt:', { email: normalizedEmail, firstName, lastName, role, classIds, subjectIds });
    
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        error: 'User already exists' 
      });
    }
    
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password,
        name: `${firstName} ${lastName}`,
        role: role
      }
    });
    
    console.log('✅ User created:', user.id, user.email);
    
    if (role === 'TEACHER') {
      console.log('👨‍🏫 Creating teacher profile...');
      
      const teacher = await prisma.teacher.create({
        data: {
          userId: user.id
        }
      });
      
      console.log('✅ Teacher profile created:', teacher.id);
      
      if (classIds && classIds.length > 0) {
        console.log('🏫 Assigning to classes:', classIds);
        
        const existingClasses = await prisma.class.findMany({
          where: { id: { in: classIds } }
        });
        
        console.log(`Found ${existingClasses.length} out of ${classIds.length} classes`);
        
        if (existingClasses.length > 0) {
          await prisma.teacher.update({
            where: { id: teacher.id },
            data: {
              classes: {
                connect: existingClasses.map(c => ({ id: c.id }))
              }
            }
          });
          
          console.log(`✅ Connected teacher to ${existingClasses.length} classes: ${existingClasses.map(c => c.name).join(', ')}`);
        } else {
          console.log('⚠️ No valid classes found to assign');
        }
      }
      
      if (subjectIds && subjectIds.length > 0) {
        console.log('📚 Assigning subjects:', subjectIds);
        
        const existingSubjects = await prisma.subject.findMany({
          where: { id: { in: subjectIds } }
        });
        
        console.log(`Found ${existingSubjects.length} out of ${subjectIds.length} subjects`);
        
        if (existingSubjects.length > 0) {
          for (const subject of existingSubjects) {
            await prisma.subject.update({
              where: { id: subject.id },
              data: { teacherId: teacher.id }
            });
            console.log(`  ✅ Assigned to subject: ${subject.name}`);
          }
          
          await prisma.teacher.update({
            where: { id: teacher.id },
            data: {
              subjects: {
                connect: existingSubjects.map(s => ({ id: s.id }))
              }
            }
          });
          
          console.log('✅ Subjects assigned successfully');
        }
      }
      
      console.log('✅ Teacher registration completed successfully');
    }
    
    if (role === 'PARENT') {
      console.log('👪 Creating parent profile...');
      
      await prisma.parent.create({
        data: {
          userId: user.id
        }
      });
      console.log('✅ Parent profile created');
    }
    
    const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
    
    const { password: _, ...userWithoutPassword } = user;
    
    console.log('✅ Registration successful for:', normalizedEmail);
    
    res.status(201).json({
      success: true,
      data: {
        user: userWithoutPassword,
        token: token
      }
    });
    
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Registration failed: ' + error.message 
    });
  }
});

// ==================== USER ENDPOINTS ====================
app.get('/api/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/role/:role', async (req, res) => {
  try {
    const { role } = req.params;
    const users = await prisma.user.findMany({
      where: { role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== CLASS ENDPOINTS ====================
// ==================== CLASS ENDPOINTS ====================
app.get('/api/classes', async (req, res) => {
  try {
    console.log('📚 GET /api/classes - Fetching all classes');
    const classes = await prisma.class.findMany({
      include: {
        teacher: {
          include: {
            user: true
          }
        },
        classTeacher: {
          include: {
            user: true
          }
        },
        students: {
          include: {
            user: true
          }
        },
        _count: {
          select: { students: true }
        }
      }
    });
    
    // Transform the data to include class teacher information
    const transformedClasses = classes.map(cls => ({
      id: cls.id,
      name: cls.name,
      grade: cls.grade,
      teacherId: cls.teacherId,
      teacher: cls.teacher ? {
        id: cls.teacher.id,
        name: cls.teacher.user?.name,
        email: cls.teacher.user?.email
      } : null,
      classTeacherId: cls.classTeacherId,
      classTeacher: cls.classTeacher ? {
        id: cls.classTeacher.id,
        firstName: cls.classTeacher.user?.name?.split(' ')[0] || '',
        lastName: cls.classTeacher.user?.name?.split(' ').slice(1).join(' ') || '',
        name: cls.classTeacher.user?.name,
        email: cls.classTeacher.user?.email
      } : null,
      _count: cls._count,
      createdAt: cls.createdAt,
      updatedAt: cls.updatedAt
    }));
    
    console.log(`✅ Found ${transformedClasses.length} classes`);
    console.log('📊 Classes with class teachers:', transformedClasses.filter(c => c.classTeacher).length);
    
    res.json(transformedClasses);
  } catch (error) {
    console.error('❌ Error fetching classes:', error);
    res.status(500).json({ error: error.message });
  }
});
app.post('/api/classes', async (req, res) => {
  try {
    const { name, section, classTeacherId } = req.body;
    console.log('Creating class with data from frontend:', { name, section, classTeacherId });
    
    let grade = 0;
    
    if (name.includes('JSS 1')) grade = 7;
    else if (name.includes('JSS 2')) grade = 8;
    else if (name.includes('JSS 3')) grade = 9;
    else if (name.includes('SSS 1')) grade = 10;
    else if (name.includes('SSS 2')) grade = 11;
    else if (name.includes('SSS 3')) grade = 12;
    else {
      const numberMatch = name.match(/\d+/);
      grade = numberMatch ? parseInt(numberMatch[0]) : 1;
    }
    
    const fullClassName = section && section !== 'General' 
      ? `${name} ${section}` 
      : name;
    
    const existingClass = await prisma.class.findFirst({
      where: { name: fullClassName }
    });
    
    if (existingClass) {
      console.log('Class already exists:', existingClass);
      return res.status(400).json({ 
        error: 'Class with this name already exists',
        existingClass 
      });
    }
    
    const newClass = await prisma.class.create({
      data: {
        name: fullClassName,
        grade: grade,
        teacherId: classTeacherId
      },
      include: {
        teacher: {
          include: {
            user: true
          }
        }
      }
    });
    
    console.log('Class created successfully:', newClass);
    res.status(201).json(newClass);
  } catch (error) {
    console.error('Error creating class:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({ 
        error: 'A class with this name already exists' 
      });
    }
    
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/classes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, grade, teacherId } = req.body;
    
    const updatedClass = await prisma.class.update({
      where: { id },
      data: {
        name,
        grade: parseInt(grade),
        teacherId
      },
      include: {
        teacher: {
          include: {
            user: true
          }
        }
      }
    });
    
    res.json(updatedClass);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/classes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🗑️ Deleting class:', id);
    
    const classWithRelations = await prisma.class.findUnique({
      where: { id },
      include: { 
        students: true,
        subjects: true,
        attendances: true 
      }
    });
    
    if (!classWithRelations) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    if (classWithRelations.students.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete class with students. Remove students first or reassign them.' 
      });
    }
    
    await prisma.$transaction([
      prisma.subjectClass.deleteMany({
        where: { classId: id }
      }),
      prisma.attendance.deleteMany({
        where: { classId: id }
      }),
      prisma.class.delete({
        where: { id }
      })
    ]);
    
    console.log('✅ Class deleted successfully:', id);
    res.json({ message: 'Class deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting class:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== TEACHER ENDPOINTS ====================

// 1. Get all teachers
app.get('/api/teachers', async (req, res) => {
  try {
    console.log('📚 Fetching teachers from API...');
    
    const teachers = await prisma.teacher.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        subjects: {
          include: {
            classes: {
              include: {
                class: true
              }
            }
          }
        },
        classes: true
      }
    });
    
    console.log(`✅ Found ${teachers.length} teachers`);
    
    const formattedTeachers = teachers.map(teacher => {
      const teacherName = teacher.user?.name || 'Unknown';
      const teacherEmail = teacher.user?.email || 'No email';
      
      const subjectsWithClasses = teacher.subjects.map(subject => ({
        id: subject.id,
        name: subject.name,
        className: subject.classes[0]?.class?.name || 'No Class'
      }));
      
      const assignedClasses = teacher.classes.map(cls => ({
        id: cls.id,
        name: cls.name
      }));
      
      return {
        id: teacher.id,
        userId: teacher.userId,
        name: teacherName,
        email: teacherEmail,
        subjects: subjectsWithClasses,
        classes: assignedClasses,
        createdAt: teacher.createdAt,
        updatedAt: teacher.updatedAt
      };
    });
    
    console.log('📊 Formatted teachers:', formattedTeachers.map(t => ({ id: t.id, name: t.name, classes: t.classes.length, subjects: t.subjects.length })));
    
    res.json(formattedTeachers);
    
  } catch (error) {
    console.error('❌ Error fetching teachers:', error);
    res.status(500).json({ 
      error: 'Failed to fetch teachers',
      message: error.message 
    });
  }
});

// 2. Get available teachers for class teacher assignment (SPECIFIC ROUTE - MUST COME BEFORE /:id)
app.get('/api/teachers/available', async (req, res) => {
  try {
    console.log('🔍 Fetching available teachers for class teacher assignment...');
    
    const teachers = await prisma.teacher.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        classTaught: true
      }
    });
    
    console.log(`✅ Found ${teachers.length} teachers in database`);
    
    const formattedTeachers = teachers.map(teacher => {
      const fullName = teacher.user?.name || 'Unknown Teacher';
      const email = teacher.user?.email || 'No email';
      
      return {
        id: teacher.id,
        name: fullName,
        email: email,
        currentClass: teacher.classTaught?.name || null
      };
    });
    
    console.log('📊 Available teachers:', formattedTeachers);
    
    res.json({ data: formattedTeachers });
  } catch (error) {
    console.error('❌ Error fetching available teachers:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Get teacher by ID (PARAMETER ROUTE - COMES AFTER SPECIFIC ROUTES)
app.get('/api/teachers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Skip if this is the 'available' route (already handled above)
    if (id === 'available') {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    
    console.log(`📚 Fetching teacher with ID: ${id}`);
    
    const teacher = await prisma.teacher.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        subjects: {
          include: {
            classes: {
              include: {
                class: true
              }
            }
          }
        },
        classes: true
      }
    });
    
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    
    const formattedTeacher = {
      id: teacher.id,
      userId: teacher.userId,
      name: teacher.user?.name || 'Unknown',
      email: teacher.user?.email || 'No email',
      subjects: teacher.subjects.map(subject => ({
        id: subject.id,
        name: subject.name,
        className: subject.classes[0]?.class?.name || 'No Class'
      })),
      classes: teacher.classes.map(cls => ({
        id: cls.id,
        name: cls.name
      })),
      createdAt: teacher.createdAt,
      updatedAt: teacher.updatedAt
    };
    
    res.json(formattedTeacher);
    
  } catch (error) {
    console.error('❌ Error fetching teacher:', error);
    res.status(500).json({ 
      error: 'Failed to fetch teacher',
      message: error.message 
    });
  }
});

// 4. Get teacher by user ID
app.get('/api/teachers/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('👤 Fetching teacher by user ID:', userId);
    
    const teacher = await prisma.teacher.findUnique({
      where: { userId: userId },
      include: {
        user: true,
        classes: true,
        subjects: true
      }
    });
    
    if (!teacher) {
      console.log('❌ No teacher found for user ID:', userId);
      return res.status(404).json({ error: 'Teacher not found' });
    }
    
    console.log('✅ Teacher found:', teacher.user?.name);
    res.json(teacher);
  } catch (error) {
    console.error('Error fetching teacher by user ID:', error);
    res.status(500).json({ error: error.message });
  }
});

// 5. Create teacher
app.post('/api/teachers', async (req, res) => {
  try {
    const { email, classIds, subjectIds } = req.body;
    console.log('📝 Creating teacher with data:', { email, classIds, subjectIds });
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    let user = await prisma.user.findUnique({
      where: { email }
    });
    
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          password: 'teacher123',
          name: email.split('@')[0],
          role: 'TEACHER'
        }
      });
      console.log('✅ Created user for teacher:', user.email);
    } else if (user.role !== 'TEACHER') {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role: 'TEACHER' }
      });
    }
    
    const teacher = await prisma.teacher.create({
      data: {
        userId: user.id
      },
      include: {
        user: true
      }
    });
    
    if (classIds && classIds.length > 0) {
      await prisma.teacher.update({
        where: { id: teacher.id },
        data: {
          classes: {
            connect: classIds.map(id => ({ id }))
          }
        }
      });
    }
    
    if (subjectIds && subjectIds.length > 0) {
      await prisma.teacher.update({
        where: { id: teacher.id },
        data: {
          subjects: {
            connect: subjectIds.map(id => ({ id }))
          }
        }
      });
    }
    
    const completeTeacher = await prisma.teacher.findUnique({
      where: { id: teacher.id },
      include: {
        user: true,
        classes: true,
        subjects: true
      }
    });
    
    console.log('✅ Teacher created successfully:', completeTeacher.user?.email);
    res.status(201).json(completeTeacher);
    
  } catch (error) {
    console.error('❌ Error creating teacher:', error);
    res.status(500).json({ error: error.message });
  }
});

// 6. Delete teacher
app.delete('/api/teachers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🗑️ Deleting teacher:', id);
    
    const teacher = await prisma.teacher.findUnique({
      where: { id },
      include: { 
        user: true,
        subjects: true,
        classes: true 
      }
    });
    
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    
    if (teacher.subjects.length > 0) {
      console.log(`📚 Removing teacher from ${teacher.subjects.length} subjects...`);
      await prisma.subject.updateMany({
        where: { teacherId: teacher.id },
        data: { teacherId: null }
      });
    }
    
    if (teacher.classes.length > 0) {
      console.log(`🏫 Removing teacher from ${teacher.classes.length} classes...`);
      await prisma.class.updateMany({
        where: { teacherId: teacher.id },
        data: { teacherId: null }
      });
    }
    
    await prisma.teacher.delete({
      where: { id: teacher.id }
    });
    
    await prisma.user.delete({
      where: { id: teacher.userId }
    });
    
    console.log('✅ Teacher deleted successfully:', id);
    res.json({ 
      success: true,
      message: 'Teacher deleted successfully' 
    });
    
  } catch (error) {
    console.error('❌ Error deleting teacher:', error);
    res.status(500).json({ 
      error: 'Failed to delete teacher',
      message: error.message 
    });
  }
});

// ==================== CLASS TEACHER ENDPOINTS ====================

// NEW: Assign class teacher endpoint (alternative URL)
app.put('/api/classes/:classId/assign-class-teacher', async (req, res) => {
  try {
    const { classId } = req.params;
    const { teacherId } = req.body;

    console.log(`📝 Assigning teacher ${teacherId} to class ${classId}`);

    // Check if class exists
    const classExists = await prisma.class.findUnique({
      where: { id: classId }
    });

    if (!classExists) {
      console.log('❌ Class not found:', classId);
      return res.status(404).json({ error: 'Class not found' });
    }

    // Check if teacher exists
    if (teacherId) {
      const teacherExists = await prisma.teacher.findUnique({
        where: { id: teacherId },
        include: { user: true }
      });

      if (!teacherExists) {
        console.log('❌ Teacher not found:', teacherId);
        return res.status(404).json({ error: 'Teacher not found' });
      }

      console.log(`✅ Found teacher: ${teacherExists.user?.name}`);
    }

    // Update the class with the class teacher
    const updatedClass = await prisma.class.update({
      where: { id: classId },
      data: {
        classTeacherId: teacherId || null
      },
      include: {
        classTeacher: {
          include: {
            user: true
          }
        }
      }
    });

    console.log(`✅ Class teacher ${teacherId ? 'assigned' : 'removed'} successfully`);

    res.json({
      success: true,
      data: updatedClass,
      message: teacherId ? 'Class teacher assigned successfully' : 'Class teacher removed successfully'
    });

  } catch (error) {
    console.error('❌ Error assigning class teacher:', error);
    res.status(500).json({ error: error.message });
  }
});

// Assign class teacher endpoint (existing - original URL)

app.put('/api/classes/:classId/assign-teacher', async (req, res) => {
  try {
    const { classId } = req.params;
    const { teacherId } = req.body;

    console.log('👨‍🏫 Assigning class teacher:', { classId, teacherId });

    if (!teacherId) {
      return res.status(400).json({ error: 'Teacher ID is required' });
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId }
    });

    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const updatedClass = await prisma.class.update({
      where: { id: classId },
      data: { classTeacherId: teacherId },
      include: {
        teacher: { include: { user: true } },
        classTeacher: { include: { user: true } },
        students: { include: { user: true } },
        _count: { select: { students: true } }
      }
    });

    const transformedClass = {
      id: updatedClass.id,
      name: updatedClass.name,
      grade: updatedClass.grade,
      teacherId: updatedClass.teacherId,
      teacher: updatedClass.teacher ? {
        id: updatedClass.teacher.id,
        name: updatedClass.teacher.user?.name,
        email: updatedClass.teacher.user?.email
      } : null,
      classTeacherId: updatedClass.classTeacherId,
      classTeacher: updatedClass.classTeacher ? {
        id: updatedClass.classTeacher.id,
        firstName: updatedClass.classTeacher.user?.name?.split(' ')[0] || '',
        lastName: updatedClass.classTeacher.user?.name?.split(' ').slice(1).join(' ') || '',
        name: updatedClass.classTeacher.user?.name,
        email: updatedClass.classTeacher.user?.email
      } : null,
      _count: updatedClass._count,
      createdAt: updatedClass.createdAt,
      updatedAt: updatedClass.updatedAt
    };

    console.log('✅ Class teacher assigned successfully');
    res.json(transformedClass);

  } catch (error) {
    console.error('❌ Error assigning class teacher:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get class teacher dashboard
// Get class teacher dashboard - Complete version
app.get('/api/dashboard/class-teacher', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let userId = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = Buffer.from(token, 'base64').toString();
      userId = decoded.split(':')[0];
    }
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Get teacher with their assigned homeroom class
    const teacher = await prisma.teacher.findFirst({
      where: { userId },
      include: {
        user: true,
        classTaught: {
          include: {
            students: {
              include: {
                user: true,
                attendances: true,
                grades: {
                  include: { subject: true }
                }
              },
              orderBy: {
                user: { name: 'asc' }
              }
            },
            subjects: {
              include: {
                subject: true
              }
            }
          }
        }
      }
    });
    
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    
    if (!teacher.classTaught) {
      return res.status(200).json({
        data: {
          hasClass: false,
          message: 'You are not assigned as a class teacher. Please contact admin.'
        }
      });
    }
    
    const myClass = teacher.classTaught;
    const students = myClass.students;
    
    // Calculate today's date boundaries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Get today's attendance
    const todayAttendanceRecords = await prisma.attendance.findMany({
      where: {
        classId: myClass.id,
        date: {
          gte: today,
          lt: tomorrow
        }
      }
    });
    
    const attendanceMap = {};
    todayAttendanceRecords.forEach(record => {
      attendanceMap[record.studentId] = record.status;
    });
    
    // Process students with their attendance and grades
    const processedStudents = students.map(student => {
      // Calculate attendance percentage for this student
      const studentAttendances = student.attendances || [];
      const presentCount = studentAttendances.filter(a => a.status === 'PRESENT').length;
      const attendancePercentage = studentAttendances.length > 0 
        ? (presentCount / studentAttendances.length) * 100 
        : 0;
      
      // Calculate average grade for this student
      const studentGrades = student.grades || [];
      let averageScore = 0;
      if (studentGrades.length > 0) {
        const totalScore = studentGrades.reduce((sum, g) => sum + (g.percentage || g.score), 0);
        averageScore = totalScore / studentGrades.length;
      }
      
      // Get today's attendance status
      const todayStatus = attendanceMap[student.id] || 'NOT_MARKED';
      
      return {
        id: student.id,
        name: student.user?.name || 'Unknown',
        firstName: student.user?.name?.split(' ')[0] || '',
        lastName: student.user?.name?.split(' ').slice(1).join(' ') || '',
        admissionNo: student.admissionNo,
        gender: student.gender,
        email: student.user?.email,
        attendanceRate: attendancePercentage.toFixed(1),
        averageScore: averageScore.toFixed(1),
        todayStatus
      };
    });
    
    // Calculate class statistics
    const totalStudents = students.length;
    const presentToday = todayAttendanceRecords.filter(a => a.status === 'PRESENT').length;
    const absentToday = todayAttendanceRecords.filter(a => a.status === 'ABSENT').length;
    const lateToday = todayAttendanceRecords.filter(a => a.status === 'LATE').length;
    const notMarked = totalStudents - todayAttendanceRecords.length;
    
    // Calculate overall class average
    const allGrades = students.flatMap(s => s.grades);
    const classAverage = allGrades.length > 0
      ? allGrades.reduce((sum, g) => sum + (g.percentage || g.score), 0) / allGrades.length
      : 0;
    
    // Get subjects in this class
    const classSubjects = myClass.subjects.map(s => ({
      id: s.subject.id,
      name: s.subject.name,
      code: s.subject.code
    }));
    
    // Identify students needing attention
    const lowAttendanceStudents = processedStudents.filter(s => parseFloat(s.attendanceRate) < 75);
    const lowPerformanceStudents = processedStudents.filter(s => parseFloat(s.averageScore) < 50);
    
    res.json({
      success: true,
      data: {
        hasClass: true,
        teacher: {
          id: teacher.id,
          name: teacher.user?.name,
          email: teacher.user?.email
        },
        class: {
          id: myClass.id,
          name: myClass.name,
          grade: myClass.grade,
          totalStudents,
          subjects: classSubjects,
          classAverage: classAverage.toFixed(1),
          stats: {
            presentToday,
            absentToday,
            lateToday,
            notMarked,
            attendanceRate: totalStudents > 0 ? (presentToday / totalStudents) * 100 : 0
          }
        },
        students: processedStudents,
        alerts: {
          lowAttendance: lowAttendanceStudents,
          lowPerformance: lowPerformanceStudents,
          totalAlerts: lowAttendanceStudents.length + lowPerformanceStudents.length
        }
      }
    });
    
  } catch (error) {
    console.error('Error fetching class teacher dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get students in class teacher's class
app.get('/api/class-teacher/students', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let userId = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = Buffer.from(token, 'base64').toString();
      userId = decoded.split(':')[0];
    }
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const teacher = await prisma.teacher.findFirst({
      where: { userId },
      include: {
        classTaught: {
          include: {
            students: {
              include: {
                user: true
              },
              orderBy: {
                user: {
                  name: 'asc'
                }
              }
            }
          }
        }
      }
    });
    
    if (!teacher || !teacher.classTaught) {
      return res.status(404).json({ error: 'No class assigned' });
    }
    
    const students = teacher.classTaught.students.map(student => ({
      id: student.id,
      name: student.user?.name,
      admissionNo: student.admissionNo,
      gender: student.gender
    }));
    
    res.json({ data: students });
  } catch (error) {
    console.error('Error fetching class teacher students:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get class teacher's attendance summary
app.get('/api/class-teacher/attendance-summary', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let userId = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = Buffer.from(token, 'base64').toString();
      userId = decoded.split(':')[0];
    }
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const teacher = await prisma.teacher.findFirst({
      where: { userId },
      include: {
        classTaught: {
          include: {
            students: {
              include: {
                attendances: true
              }
            }
          }
        }
      }
    });
    
    if (!teacher || !teacher.classTaught) {
      return res.status(404).json({ error: 'No class assigned' });
    }
    
    const classData = teacher.classTaught;
    const students = classData.students;
    
    // Calculate attendance statistics
    const totalStudents = students.length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayAttendances = await prisma.attendance.findMany({
      where: {
        classId: classData.id,
        date: today
      }
    });
    
    const presentToday = todayAttendances.filter(a => a.status === 'PRESENT').length;
    const absentToday = todayAttendances.filter(a => a.status === 'ABSENT').length;
    const lateToday = todayAttendances.filter(a => a.status === 'LATE').length;
    
    // Weekly summary
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    
    const weekAttendances = await prisma.attendance.findMany({
      where: {
        classId: classData.id,
        date: {
          gte: weekStart,
          lte: today
        }
      }
    });
    
    const weekPresent = weekAttendances.filter(a => a.status === 'PRESENT').length;
    const weekTotal = weekAttendances.length;
    const weekRate = weekTotal > 0 ? (weekPresent / weekTotal) * 100 : 0;
    
    // Monthly summary
    const monthStart = new Date(today);
    monthStart.setDate(1);
    
    const monthAttendances = await prisma.attendance.findMany({
      where: {
        classId: classData.id,
        date: {
          gte: monthStart,
          lte: today
        }
      }
    });
    
    const monthPresent = monthAttendances.filter(a => a.status === 'PRESENT').length;
    const monthTotal = monthAttendances.length;
    const monthRate = monthTotal > 0 ? (monthPresent / monthTotal) * 100 : 0;
    
    res.json({
      data: {
        totalStudents,
        today: {
          present: presentToday,
          absent: absentToday,
          late: lateToday,
          rate: totalStudents > 0 ? (presentToday / totalStudents) * 100 : 0
        },
        weekly: {
          present: weekPresent,
          total: weekTotal,
          rate: weekRate.toFixed(1)
        },
        monthly: {
          present: monthPresent,
          total: monthTotal,
          rate: monthRate.toFixed(1)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching attendance summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== STUDENT ENDPOINTS ====================
app.get('/api/students', async (req, res) => {
  try {
    const { classId, teacherId } = req.query;
    const where = {};
    
    if (classId) {
      where.classId = classId;
    }
    
    if (teacherId) {
      const teacher = await prisma.teacher.findUnique({
        where: { id: teacherId },
        include: { classes: true }
      });
      
      if (teacher && teacher.classes.length > 0) {
        const classIds = teacher.classes.map(c => c.id);
        where.classId = { in: classIds };
      } else {
        return res.json([]);
      }
    }
    
    const students = await prisma.student.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        },
        class: true,
        parent: {
          include: {
            user: true
          }
        },
        attendances: true,
        grades: {
          include: {
            subject: true
          }
        }
      }
    });
    
    const transformedStudents = students.map(function(student) {
      return {
        id: student.id,
        firstName: student.user?.name?.split(' ')[0] || '',
        lastName: student.user?.name?.split(' ').slice(1).join(' ') || '',
        email: student.user?.email || '',
        admissionNo: student.admissionNo || 'N/A',
        class: student.class,
        parent: student.parent ? {
          id: student.parent.id,
          firstName: student.parent.user?.name?.split(' ')[0] || '',
          lastName: student.parent.user?.name?.split(' ').slice(1).join(' ') || ''
        } : null,
        gender: student.gender,
        dob: student.dob,
        enrollmentDate: student.createdAt,
        user: student.user
      };
    });
    
    res.json(transformedStudents);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        },
        class: true,
        parent: {
          include: {
            user: true
          }
        },
        attendances: true,
        grades: {
          include: {
            subject: true
          }
        }
      }
    });
    
    const transformedStudent = {
      id: student.id,
      firstName: student.user?.name?.split(' ')[0] || '',
      lastName: student.user?.name?.split(' ').slice(1).join(' ') || '',
      email: student.user?.email || '',
      admissionNo: student.admissionNo || 'N/A',
      class: student.class,
      parent: student.parent ? {
        id: student.parent.id,
        firstName: student.parent.user?.name?.split(' ')[0] || '',
        lastName: student.parent.user?.name?.split(' ').slice(1).join(' ') || ''
      } : null,
      gender: student.gender,
      dob: student.dob,
      enrollmentDate: student.createdAt,
      user: student.user
    };
    
    res.json(transformedStudent);
  } catch (error) {
    console.error('Error fetching student:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/students', async (req, res) => {
  try {
    const { firstName, lastName, email, password, admissionNo, classId, parentId, gender, dob } = req.body;
    console.log('📝 Creating student with data:', { firstName, lastName, email, admissionNo, classId, parentId, gender, dob });
    
    let finalEmail = email;
    let finalPassword = password;
    
    if (!finalEmail) {
      const baseEmail = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@school.edu`;
      let existingUser = await prisma.user.findUnique({
        where: { email: baseEmail }
      });
      
      if (existingUser) {
        finalEmail = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(Math.random() * 1000)}@school.edu`;
      } else {
        finalEmail = baseEmail;
      }
    }
    
    if (!finalPassword) {
      finalPassword = 'student123';
    }
    
    const user = await prisma.user.create({
      data: {
        email: finalEmail,
        password: finalPassword,
        name: `${firstName} ${lastName}`,
        role: 'STUDENT'
      }
    });
    
    let finalAdmissionNo = admissionNo;
    if (!finalAdmissionNo) {
      const studentCount = await prisma.student.count();
      const year = new Date().getFullYear().toString().slice(-2);
      finalAdmissionNo = `STU${year}${String(studentCount + 1).padStart(4, '0')}`;
    }
    
    const student = await prisma.student.create({
      data: {
        userId: user.id,
        classId,
        parentId: parentId || null,
        admissionNo: finalAdmissionNo,
        gender: gender || null,
        dob: dob ? new Date(dob) : null
      },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        },
        class: true,
        parent: {
          include: {
            user: true
          }
        }
      }
    });
    
    const transformedStudent = {
      id: student.id,
      firstName: student.user?.name?.split(' ')[0] || firstName,
      lastName: student.user?.name?.split(' ').slice(1).join(' ') || lastName,
      email: student.user?.email || finalEmail,
      admissionNo: student.admissionNo || finalAdmissionNo,
      class: student.class,
      parent: student.parent ? {
        id: student.parent.id,
        firstName: student.parent.user?.name?.split(' ')[0] || '',
        lastName: student.parent.user?.name?.split(' ').slice(1).join(' ') || ''
      } : null,
      gender: student.gender,
      dob: student.dob,
      enrollmentDate: student.createdAt,
      user: student.user
    };
    
    console.log('✅ Student created successfully:', transformedStudent);
    res.status(201).json(transformedStudent);
  } catch (error) {
    console.error('❌ Error creating student:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({ 
        error: 'A student with this email or admission number already exists' 
      });
    }
    
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { classId, parentId } = req.body;
    
    const student = await prisma.student.update({
      where: { id },
      data: {
        classId,
        parentId
      },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        },
        class: true,
        parent: {
          include: {
            user: true
          }
        }
      }
    });
    
    res.json(student);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🗑️ Deleting student:', id);
    
    const student = await prisma.student.findUnique({
      where: { id },
      include: { user: true }
    });
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    console.log('📊 Student: ' + (student.user?.name || 'Unknown'));
    
    const fees = await prisma.fee.findMany({
      where: { studentId: id },
      select: { id: true }
    });
    
    console.log('💰 Found ' + fees.length + ' fees');
    
    for (const fee of fees) {
      await prisma.$executeRaw`DELETE FROM "Payment" WHERE "feeId" = ${fee.id}`;
    }
    
    for (const fee of fees) {
      await prisma.$executeRaw`DELETE FROM "FeeItem" WHERE "feeId" = ${fee.id}`;
    }
    
    for (const fee of fees) {
      await prisma.$executeRaw`DELETE FROM "Discount" WHERE "feeId" = ${fee.id}`;
    }
    
    await prisma.$executeRaw`DELETE FROM "Fee" WHERE "studentId" = ${id}`;
    await prisma.$executeRaw`DELETE FROM "Attendance" WHERE "studentId" = ${id}`;
    await prisma.$executeRaw`DELETE FROM "Grade" WHERE "studentId" = ${id}`;
    await prisma.$executeRaw`DELETE FROM "Student" WHERE id = ${id}`;
    await prisma.$executeRaw`DELETE FROM "User" WHERE id = ${student.userId}`;
    
    console.log('✅ Student deleted successfully');
    res.json({ message: 'Student deleted successfully' });
    
  } catch (error) {
    console.error('❌ Error deleting student:', error);
    res.status(500).json({ 
      error: 'Failed to delete student',
      details: error.message 
    });
  }
});

// Add endpoint to get students by teacher ID
app.get('/api/teachers/:teacherId/students', async (req, res) => {
  try {
    const { teacherId } = req.params;
    
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      include: { classes: true }
    });
    
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    
    if (teacher.classes.length === 0) {
      return res.json([]);
    }
    
    const classIds = teacher.classes.map(c => c.id);
    
    const students = await prisma.student.findMany({
      where: {
        classId: { in: classIds }
      },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        },
        class: true
      },
      orderBy: {
        user: {
          name: 'asc'
        }
      }
    });
    
    const transformedStudents = students.map(student => ({
      id: student.id,
      name: student.user?.name || 'Unknown',
      firstName: student.user?.name?.split(' ')[0] || '',
      lastName: student.user?.name?.split(' ').slice(1).join(' ') || '',
      email: student.user?.email || '',
      admissionNo: student.admissionNo || 'N/A',
      className: student.class?.name || 'No Class'
    }));
    
    res.json(transformedStudents);
  } catch (error) {
    console.error('Error fetching teacher students:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== EXCEL IMPORT ENDPOINTS ====================

function getValue(row, possibleKeys) {
  for (const key of possibleKeys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      return row[key];
    }
  }
  return null;
}

app.post('/api/students/import-excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    console.log(`📊 Reading Excel file: ${req.file.originalname}`);
    
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`📊 Found ${data.length} rows in Excel file`);
    console.log(`📊 Columns found: ${Object.keys(data[0] || {}).join(', ')}`);
    
    const results = {
      success: [],
      errors: [],
      total: data.length
    };
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        const firstName = getValue(row, ['FirstName', 'First Name', 'Firstname', 'first_name']);
        const lastName = getValue(row, ['LastName', 'Last Name', 'Lastname', 'last_name', 'Sur Name', 'Surname']);
        const email = getValue(row, ['Email', 'Email Address', 'email_address']);
        const admissionNo = getValue(row, ['AdmissionNo', 'Admission Number', 'Admission No', 'Student ID']);
        const className = getValue(row, ['ClassName', 'Class Name', 'Class', 'class_name']);
        const gender = getValue(row, ['Gender', 'Sex', 'gender']);
        const dob = getValue(row, ['DOB', 'Date of Birth', 'Birth Date']);
        
        if (!firstName || !lastName || !admissionNo || !className) {
          results.errors.push({ row: i + 2, data: row, error: 'Missing required fields' });
          continue;
        }
        
        let normalizedClassName = className.toString().toUpperCase();
        if (normalizedClassName === 'JSS1') normalizedClassName = 'JSS 1';
        else if (normalizedClassName === 'JSS2') normalizedClassName = 'JSS 2';
        else if (normalizedClassName === 'JSS3') normalizedClassName = 'JSS 3';
        else if (normalizedClassName === 'SSS1') normalizedClassName = 'SSS 1';
        else if (normalizedClassName === 'SSS2') normalizedClassName = 'SSS 2';
        else if (normalizedClassName === 'SSS3') normalizedClassName = 'SSS 3';
        
        const class_ = await prisma.class.findFirst({
          where: { name: { contains: normalizedClassName, mode: 'insensitive' } }
        });
        
        if (!class_) {
          results.errors.push({ row: i + 2, data: row, error: `Class not found: ${className}` });
          continue;
        }
        
        const finalEmail = email || `${firstName.toLowerCase()}.${lastName.toLowerCase()}@school.edu`;
        const existingUser = await prisma.user.findUnique({ where: { email: finalEmail } });
        if (existingUser) {
          results.errors.push({ row: i + 2, data: row, error: `Email already exists: ${finalEmail}` });
          continue;
        }
        
        const user = await prisma.user.create({
          data: {
            email: finalEmail,
            password: 'student123',
            name: `${firstName} ${lastName}`,
            role: 'STUDENT'
          }
        });
        
        await prisma.student.create({
          data: {
            userId: user.id,
            classId: class_.id,
            admissionNo: admissionNo.toString().trim(),
            gender: gender || null,
            dob: dob ? new Date(dob) : null
          }
        });
        
        results.success.push({
          row: i + 2,
          name: `${firstName} ${lastName}`,
          admissionNo: admissionNo,
          email: finalEmail,
          password: 'student123',
          className: class_.name
        });
        
      } catch (error) {
        results.errors.push({ row: i + 2, data: row, error: error.message });
      }
    }
    
    fs.unlinkSync(req.file.path);
    res.json({ message: 'Import completed', results });
    
  } catch (error) {
    console.error('Error importing students:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/students/import-excel-custom', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    const rows = data.slice(1);
    
    const results = { success: [], errors: [], total: rows.length };
    
    const allClasses = await prisma.class.findMany();
    const classMap = {};
    allClasses.forEach(c => { classMap[c.name.toUpperCase()] = c; });
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row[0] || !row[1] || !row[2]) continue;
      
      try {
        const admissionNo = row[0]?.toString().trim();
        const surName = row[1]?.toString().trim();
        const firstName = row[2]?.toString().trim();
        const otherName = row[3]?.toString().trim() || '';
        const gender = row[4]?.toString().trim() || '';
        const className = row[5]?.toString().trim();
        
        const fullName = `${firstName} ${surName}${otherName ? ' ' + otherName : ''}`;
        
        if (!admissionNo || !firstName || !surName || !className) {
          results.errors.push({ row: i + 2, data: { admissionNo, firstName, surName, className }, error: 'Missing required fields' });
          continue;
        }
        
        let normalizedClassName = className.toUpperCase();
        if (normalizedClassName === 'JSS1') normalizedClassName = 'JSS 1';
        else if (normalizedClassName === 'JSS2') normalizedClassName = 'JSS 2';
        else if (normalizedClassName === 'JSS3') normalizedClassName = 'JSS 3';
        else if (normalizedClassName === 'SSS1') normalizedClassName = 'SSS 1';
        else if (normalizedClassName === 'SSS2') normalizedClassName = 'SSS 2';
        else if (normalizedClassName === 'SSS3') normalizedClassName = 'SSS 3';
        
        const class_ = classMap[normalizedClassName];
        if (!class_) {
          results.errors.push({ row: i + 2, data: { admissionNo, className }, error: `Class not found: ${className}` });
          continue;
        }
        
        const existingStudent = await prisma.student.findFirst({ where: { admissionNo } });
        if (existingStudent) {
          results.errors.push({ row: i + 2, data: { admissionNo, fullName }, error: `Student with admission number ${admissionNo} already exists` });
          continue;
        }
        
        const email = `${firstName.toLowerCase()}.${surName.toLowerCase()}${otherName ? '.' + otherName.toLowerCase() : ''}@school.edu`;
        const finalEmail = await prisma.user.findUnique({ where: { email } }) 
          ? `${firstName.toLowerCase()}.${surName.toLowerCase()}${Date.now()}@school.edu` 
          : email;
        
        const user = await prisma.user.create({
          data: {
            email: finalEmail,
            password: 'student123',
            name: fullName,
            role: 'STUDENT'
          }
        });
        
        await prisma.student.create({
          data: {
            userId: user.id,
            classId: class_.id,
            admissionNo: admissionNo,
            gender: gender.toUpperCase() === 'MALE' ? 'Male' : gender.toUpperCase() === 'FEMALE' ? 'Female' : null
          }
        });
        
        results.success.push({
          row: i + 2,
          admissionNo: admissionNo,
          name: fullName,
          email: finalEmail,
          password: 'student123',
          className: class_.name,
          gender: gender
        });
        
      } catch (error) {
        results.errors.push({ row: i + 2, data: { admissionNo: row[0], name: `${row[2]} ${row[1]}` }, error: error.message });
      }
    }
    
    fs.unlinkSync(req.file.path);
    res.json({ message: 'Import completed', results });
    
  } catch (error) {
    console.error('Error importing students:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/students/import-template', (req, res) => {
  try {
    const templateData = [
      { 'FirstName': 'John', 'LastName': 'Doe', 'Email': 'john.doe@example.com', 'AdmissionNo': 'STU240001', 'ClassName': 'JSS 1', 'Gender': 'Male', 'DOB': '2010-05-15', 'ParentEmail': 'parent@example.com' },
      { 'FirstName': 'Jane', 'LastName': 'Smith', 'Email': '', 'AdmissionNo': 'STU240002', 'ClassName': 'JSS 2', 'Gender': 'Female', 'DOB': '2009-08-20', 'ParentEmail': '' }
    ];
    
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    worksheet['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 25 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=student_import_template.xlsx');
    res.send(buffer);
  } catch (error) {
    console.error('Error generating template:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== FIXED SUBJECT ENDPOINTS ====================

// Get all subjects with proper relations
app.get('/api/subjects', async (req, res) => {
  try {
    const subjects = await prisma.subject.findMany({
      include: {
        teacher: {
          include: { user: true }
        },
        classes: {
          include: {
            class: true
          }
        }
      }
    });

    const transformedSubjects = subjects.map(subject => ({
      id: subject.id,
      name: subject.name,
      code: subject.code,
      teacherId: subject.teacherId,
      teacher: subject.teacher ? {
        id: subject.teacher.id,
        name: subject.teacher.user?.name,
        email: subject.teacher.user?.email
      } : null,
      classes: subject.classes.map(sc => ({
        id: sc.class.id,
        name: sc.class.name
      }))
    }));

    res.json(transformedSubjects);
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get subjects for a specific class
app.get('/api/classes/:classId/subjects', async (req, res) => {
  try {
    const { classId } = req.params;

    const classWithSubjects = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        subjects: {
          include: {
            subject: {
              include: {
                teacher: {
                  include: { user: true }
                }
              }
            }
          }
        }
      }
    });

    if (!classWithSubjects) {
      return res.status(404).json({ error: 'Class not found' });
    }

    const subjects = classWithSubjects.subjects.map(sc => ({
      id: sc.subject.id,
      name: sc.subject.name,
      code: sc.subject.code,
      teacher: sc.subject.teacher?.user?.name
    }));

    res.json(subjects);
  } catch (error) {
    console.error('Error fetching class subjects:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get students for grade entry (with proper filtering)
app.get('/api/students/for-grades', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let userId = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = Buffer.from(token, 'base64').toString();
      userId = decoded.split(':')[0];
    }

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { classId, subjectId, termId } = req.query;

    // Get teacher's classes
    const teacher = await prisma.teacher.findFirst({
      where: { userId },
      include: { classes: true }
    });

    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const teacherClassIds = teacher.classes.map(c => c.id);

    // Build where clause
    const where = {};

    if (classId) {
      where.classId = classId;
    } else if (teacherClassIds.length > 0) {
      where.classId = { in: teacherClassIds };
    }

    const students = await prisma.student.findMany({
      where,
      include: {
        user: true,
        class: true,
        grades: {
          where: subjectId ? { subjectId } : {},
          include: { subject: true }
        }
      },
      orderBy: {
        user: { name: 'asc' }
      }
    });

    const formattedStudents = students.map(student => ({
      id: student.id,
      name: student.user?.name,
      admissionNo: student.admissionNo,
      className: student.class?.name,
      classId: student.classId,
      existingGrades: student.grades.map(g => ({
        id: g.id,
        score: g.score,
        type: g.type,
        subjectId: g.subjectId
      }))
    }));

    res.json(formattedStudents);
  } catch (error) {
    console.error('Error fetching students for grades:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== SUBJECT ENDPOINTS ====================

app.get('/api/subjects', async (req, res) => {
  try {
    const subjects = await prisma.subject.findMany({
      include: {
        teacher: { include: { user: true } },
        classes: { include: { class: true } },
        grades: true
      }
    });
    
    const transformedSubjects = subjects.map(subject => ({
      ...subject,
      classes: subject.classes.map(sc => sc.class)
    }));
    res.json(transformedSubjects);
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/subjects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const subject = await prisma.subject.findUnique({
      where: { id },
      include: {
        teacher: { include: { user: true } },
        classes: { include: { class: true } },
        grades: true
      }
    });
    if (!subject) return res.status(404).json({ error: 'Subject not found' });
    res.json({ ...subject, classes: subject.classes.map(sc => sc.class) });
  } catch (error) {
    console.error('Error fetching subject:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/subjects', async (req, res) => {
  try {
    const { name, classIds, teacherId } = req.body;
    if (!name || !classIds || !Array.isArray(classIds) || classIds.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const existingSubject = await prisma.subject.findFirst({ where: { name, teacherId: teacherId || null } });
    if (existingSubject) {
      return res.status(400).json({ error: 'Subject already exists for this teacher' });
    }
    
    const subject = await prisma.subject.create({
      data: {
        name,
        teacherId: teacherId || null,
        classes: { create: classIds.map(classId => ({ class: { connect: { id: classId } } })) }
      },
      include: {
        teacher: { include: { user: true } },
        classes: { include: { class: true } }
      }
    });
    
    res.status(201).json({ ...subject, classes: subject.classes.map(sc => sc.class) });
  } catch (error) {
    console.error('Error creating subject:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/subjects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, classIds, teacherId } = req.body;
    
    await prisma.subjectClass.deleteMany({ where: { subjectId: id } });
    
    const subject = await prisma.subject.update({
      where: { id },
      data: {
        name,
        teacherId: teacherId || null,
        classes: { create: classIds?.map(classId => ({ class: { connect: { id: classId } } })) || [] }
      },
      include: {
        teacher: { include: { user: true } },
        classes: { include: { class: true } }
      }
    });
    
    res.json({ ...subject, classes: subject.classes.map(sc => sc.class) });
  } catch (error) {
    console.error('Error updating subject:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/subjects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const subjectWithGrades = await prisma.subject.findUnique({ where: { id }, include: { grades: true } });
    if (subjectWithGrades?.grades.length > 0) {
      return res.status(400).json({ error: 'Cannot delete subject with existing grades' });
    }
    
    await prisma.$transaction([
      prisma.subjectClass.deleteMany({ where: { subjectId: id } }),
      prisma.subject.delete({ where: { id } })
    ]);
    
    res.json({ message: 'Subject deleted successfully' });
  } catch (error) {
    console.error('Error deleting subject:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== PARENT ENDPOINTS ====================
app.get('/api/parents', async (req, res) => {
  try {
    const parents = await prisma.parent.findMany({
      include: {
        user: { select: { name: true, email: true } },
        students: { include: { user: true, class: true } }
      }
    });
    res.json(parents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/parents', async (req, res) => {
  try {
    const { userId } = req.body;
    const parent = await prisma.parent.create({ data: { userId }, include: { user: { select: { name: true, email: true           }
        }
      }
    });
    
    if (!parent) {
      return res.status(404).json({ error: 'Parent profile not found' });
    }
    
    console.log('✅ Parent profile found:', parent.user?.name);
    res.json(parent);

  } catch (error) {
    console.error('Error fetching parent profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get parent by user ID
app.get('/api/parents/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const parent = await prisma.parent.findUnique({
      where: { userId: userId },
      include: {
        user: true,
        students: {
          include: {
            user: true,
            class: true
          }
        }
      }
    });

    if (!parent) {
      return res.status(404).json({ error: 'Parent not found' });
    }

    res.json(parent);
  } catch (error) {
    console.error('Error fetching parent by user ID:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get parent dashboard data
app.get('/api/dashboard/parent', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let userId = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = Buffer.from(token, 'base64').toString();
      userId = decoded.split(':')[0];
    }

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const parent = await prisma.parent.findUnique({
      where: { userId: userId },
      include: {
        user: true,
        students: {
          include: {
            user: true,
            class: true,
            fees: {
              include: {
                payments: true,
                term: {
                  include: {
                    session: true
                  }
                },
                feeItems: true
              },
              orderBy: { createdAt: 'desc' }
            },
            attendances: {
              take: 5,
              orderBy: { date: 'desc' }
            },
            grades: {
              include: {
                subject: true
              },
              take: 10,
              orderBy: { createdAt: 'desc' }
            }
          }
        }
      }
    });

    if (!parent) {
      return res.status(404).json({ error: 'Parent not found' });
    }

    let totalOutstanding = 0;
    let totalExpected = 0;
    let totalPaid = 0;

    const transformedStudents = parent.students.map(student => {
      let studentTotalFees = 0;
      let studentTotalPaid = 0;
      let studentTotalOutstanding = 0;

      student.fees.forEach(fee => {
        studentTotalFees += fee.totalAmount;
        studentTotalPaid += fee.paidAmount;
        studentTotalOutstanding += fee.balance;
      });

      totalExpected += studentTotalFees;
      totalPaid += studentTotalPaid;
      totalOutstanding += studentTotalOutstanding;

      const recentPayments = student.fees.flatMap(fee => 
        fee.payments.map(payment => ({
          id: payment.id,
          amount: payment.amount,
          date: payment.paymentDate,
          method: payment.paymentMethod,
          term: fee.term?.name,
          session: fee.term?.session?.name
        }))
      ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

      return {
        id: student.id,
        name: student.user?.name || 'Unknown',
        admissionNo: student.admissionNo || 'N/A',
        className: student.class?.name || 'No Class',
        feeSummary: {
          totalFees: studentTotalFees,
          totalPaid: studentTotalPaid,
          totalOutstanding: studentTotalOutstanding,
          paymentProgress: studentTotalFees > 0 ? (studentTotalPaid / studentTotalFees) * 100 : 0
        },
        recentPayments,
        recentAttendance: student.attendances.map(a => ({
          date: a.date,
          status: a.status
        })),
        recentGrades: student.grades.map(g => ({
          id: g.id,
          subjectName: g.subject?.name,
          score: g.score,
          type: g.type,
          createdAt: g.createdAt
        }))
      };
    });

    res.json({
      data: {
        parent: {
          name: parent.user?.name,
          email: parent.user?.email
        },
        students: transformedStudents,
        totalOutstanding,
        totalExpected,
        totalPaid
      }
    });
  } catch (error) {
    console.error('Error fetching parent dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get parent's children (simplified version)
app.get('/api/parents/children', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let userId = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = Buffer.from(token, 'base64').toString();
      userId = decoded.split(':')[0];
    }

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const parent = await prisma.parent.findUnique({
      where: { userId: userId },
      include: {
        students: {
          include: {
            user: true,
            class: true
          }
        }
      }
    });

    if (!parent) {
      return res.json({ data: [] });
    }

    const children = parent.students.map(student => ({
      id: student.id,
      name: student.user?.name,
      admissionNo: student.admissionNo,
      className: student.class?.name
    }));

    res.json({ data: children });

  } catch (error) {
    console.error('Error fetching parent children:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get available students (students without parents)
app.get('/api/parent/available-students', async (req, res) => {
  try {
    const { search } = req.query;
    const where = { parentId: null };

    if (search && search.trim()) {
      where.OR = [
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { admissionNo: { contains: search, mode: 'insensitive' } }
      ];
    }

    const students = await prisma.student.findMany({
      where,
      include: { 
        user: true, 
        class: true 
      },
      orderBy: { 
        user: { name: 'asc' } 
      }
    });

    res.json({ 
      data: students.map(s => ({ 
        id: s.id, 
        name: s.user?.name, 
        admissionNo: s.admissionNo, 
        className: s.class?.name, 
        classId: s.classId 
      }))
    });
  } catch (error) {
    console.error('Error fetching available students:', error);
    res.status(500).json({ error: error.message });
  }
});

// Link a child to a parent
app.post('/api/parent/link-child', async (req, res) => {
  try {
    console.log('🔗 LINK CHILD ENDPOINT HIT');

    const authHeader = req.headers.authorization;
    let userId = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = Buffer.from(token, 'base64').toString();
      userId = decoded.split(':')[0];
    }

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { studentId } = req.body;

    if (!studentId) {
      return res.status(400).json({ error: 'Student ID is required' });
    }

    // Find parent profile
    const parent = await prisma.parent.findUnique({
      where: { userId: userId },
      include: { user: true }
    });

    if (!parent) {
      return res.status(404).json({ error: 'Parent profile not found' });
    }

    // Find student
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { user: true, class: true }
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    if (student.parentId) {
      return res.status(400).json({ error: 'Student already has a parent' });
    }

    // Link
    const updatedStudent = await prisma.student.update({
      where: { id: studentId },
      data: { parentId: parent.id },
      include: { user: true, class: true }
    });

    res.json({
      success: true,
      message: 'Child linked successfully',
      data: {
        id: updatedStudent.id,
        name: updatedStudent.user?.name,
        admissionNo: updatedStudent.admissionNo,
        className: updatedStudent.class?.name
      }
    });

  } catch (error) {
    console.error('Error linking child:', error);
    res.status(500).json({ error: error.message });
  }
});

// Unlink a child from a parent
app.delete('/api/parent/unlink-child/:studentId', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let userId = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = Buffer.from(token, 'base64').toString();
      userId = decoded.split(':')[0];
    }

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { studentId } = req.params;

    const parent = await prisma.parent.findUnique({
      where: { userId: userId }
    });

    if (!parent) {
      return res.status(404).json({ error: 'Parent profile not found' });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { user: true }
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    if (student.parentId !== parent.id) {
      return res.status(400).json({ error: 'Student not linked to your account' });
    }

    await prisma.student.update({
      where: { id: studentId },
      data: { parentId: null }
    });

    console.log(`✅ Child unlinked: ${student.user?.name}`);

    res.json({ message: 'Child unlinked successfully' });

  } catch (error) {
    console.error('Error unlinking child:', error);
    res.status(500).json({ error: error.message });
  }
});


// ==================== STATIC FILE SERVING (FRONTEND) ====================
// Serve frontend static files - MUST be before API routes
app.use(express.static("public"));

// Handle React Router - serve index.html for all non-API routes
// Use a catch-all regex but check path inside handler
app.get(/.*/, (req, res) => {
  // Skip API routes - let them 404 if not handled above
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }
  res.sendFile(path.resolve("public", "index.html"));
});

const server = app.listen(port, () => {
  console.log(`\n🚀 Server running on http://localhost:${port}`);
  
  console.log('\n🔍 REGISTERED ROUTES:');
  if (app._router && app._router.stack) {
    app._router.stack.forEach(function(r) {
      if (r.route && r.route.path) {
        console.log(`${Object.keys(r.route.methods).join(', ').toUpperCase()} ${r.route.path}`);
      }
    });
  }
  
  console.log(`\n📚 API Endpoints:`);
  console.log(`   🔐 AUTH`);
  console.log(`     POST   /api/auth/login`);
  console.log(`     GET    /api/auth/me`);
  console.log(`     POST   /api/auth/register`);
  console.log(`   👥 USERS`);
  console.log(`     GET    /api/users`);
  console.log(`     GET    /api/users/role/:role`);
  console.log(`     DELETE /api/users/:userId`);
  console.log(`     DELETE /api/users/:userId`);
  console.log(`   🏫 CLASSES`);
  console.log(`     GET    /api/classes`);
  console.log(`     GET    /api/classes/:id`);
  console.log(`     POST   /api/classes`);
  console.log(`     PUT    /api/classes/:id`);
  console.log(`     DELETE /api/classes/:id`);
  console.log(`   👨‍🏫 TEACHERS`);
  console.log(`     GET    /api/teachers`);
  console.log(`     GET    /api/teachers/available (SPECIFIC ROUTE)`);
  console.log(`     GET    /api/teachers/:id`);
  console.log(`     GET    /api/teachers/user/:userId`);
  console.log(`     POST   /api/teachers`);
  console.log(`     PUT    /api/teachers/:id`);
  console.log(`     DELETE /api/teachers/:id`);
  console.log(`   👨‍🏫 CLASS TEACHER`);
  console.log(`     PUT    /api/classes/:classId/assign-teacher`);
  console.log(`     PUT    /api/classes/:classId/assign-class-teacher`);
  console.log(`     GET    /api/dashboard/class-teacher`);
  console.log(`     GET    /api/class-teacher/students`);
  console.log(`     GET    /api/class-teacher/attendance-summary`);
  console.log(`   🎓 STUDENTS`);
  console.log(`     GET    /api/students`);
  console.log(`     GET    /api/students/:id`);
  console.log(`     POST   /api/students`);
  console.log(`     PUT    /api/students/:id`);
  console.log(`     DELETE /api/students/:id (with cascade deletion)`);
  console.log(`   📊 EXCEL IMPORT`);
  console.log(`     POST   /api/students/import-excel`);
  console.log(`     POST   /api/students/import-excel-custom`);
  console.log(`     GET    /api/students/import-template`);
  console.log(`   📚 SUBJECTS`);
  console.log(`     GET    /api/subjects`);
  console.log(`     GET    /api/subjects/:id`);
  console.log(`     POST   /api/subjects`);
  console.log(`     PUT    /api/subjects/:id`);
  console.log(`     DELETE /api/subjects/:id`);
  console.log(`   👪 PARENTS`);
  console.log(`     GET    /api/parents`);
  console.log(`     POST   /api/parents`);
  console.log(`     GET    /api/parents/children`);
  console.log(`   🔗 PARENT CHILD LINKING`);
  console.log(`     GET    /api/parent/available-students`);
  console.log(`     POST   /api/parent/link-child`);
  console.log(`     DELETE /api/parent/unlink-child/:studentId`);
  console.log(`   🔗 PARENT CHILD LINKING`);
  console.log(`     GET    /api/parent/available-students`);
  console.log(`     POST   /api/parent/link-child`);
  console.log(`     DELETE /api/parent/unlink-child/:studentId`);
  console.log(`   📅 ATTENDANCE`);
  console.log(`     GET    /api/attendance`);
  console.log(`     POST   /api/attendance`);
  console.log(`     POST   /api/attendance/bulk`);
  console.log(`   📊 GRADES`);
  console.log(`     GET    /api/grades`);
  console.log(`     POST   /api/grades`);
  console.log(`     DELETE /api/grades/:id`);
  console.log(`     POST   /api/grades/bulk-delete`);
  console.log(`     GET    /api/grades/filter`);
  console.log(`     GET    /api/grades/summary/:studentId`);
  console.log(`     GET    /api/grades/final/:studentId/:subjectId`);
  console.log(`   📅 SESSION MANAGEMENT`);
  console.log(`     GET    /api/sessions`);
  console.log(`     GET    /api/sessions/active`);
  console.log(`     POST   /api/sessions`);
  console.log(`     PUT    /api/sessions/:id`);
  console.log(`     POST   /api/sessions/:id/archive`);
  console.log(`     POST   /api/sessions/next (auto-create next year)`);
  console.log(`   📅 TERM MANAGEMENT`);
  console.log(`     GET    /api/terms`);
  console.log(`     GET    /api/terms/active`);
  console.log(`     POST   /api/terms`);
  console.log(`     PUT    /api/terms/:id`);
  console.log(`     DELETE /api/terms/:id`);
  console.log(`   💰 FEE MANAGEMENT`);
  console.log(`     GET    /api/bursar/students`);
  console.log(`     GET    /api/bursar/dashboard`);
  console.log(`     GET    /api/fees (with term filter)`);
  console.log(`     GET    /api/fees/summary (with term/session filter)`);
  console.log(`     GET    /api/fees/parent`);
  console.log(`     POST   /api/fees/bulk-delete (BULK DELETE - placed before /:id)`);
  console.log(`     GET    /api/fees/:id`);
  console.log(`     GET    /api/fees/student/:studentId`);
  console.log(`     POST   /api/fees`);
  console.log(`     POST   /api/fees/bulk (bulk fee creation)`);
  console.log(`     POST   /api/fees/:feeId/payments`);
  console.log(`     PUT    /api/fees/:id`);
  console.log(`     DELETE /api/fees/:id`);
  console.log(`     GET    /api/fees/receipt/:feeId`);
  console.log(`   📊 DASHBOARDS`);
  console.log(`     GET    /api/dashboard/principal`);
  console.log(`     GET    /api/dashboard/admin`);
  console.log(`     GET    /api/dashboard/bursar`);
  console.log(`     GET    /api/dashboard/teacher (FIXED - subjects only show for teacher's assigned classes)`);
  console.log(`     GET    /api/dashboard/class-teacher (NEW - Class teacher dashboard)`);
  console.log(`     GET    /api/dashboard/parent`);
  console.log(`     GET    /api/dashboard/student`);
  console.log(`   ❤️ HEALTH`);
  console.log(`     GET    /api/health`);
});