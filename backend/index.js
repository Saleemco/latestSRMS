// backend/index.js
// IMPORTANT: This MUST be the first line
require("./instrument");

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
    const parent = await prisma.parent.create({ data: { userId }, include: { user: { select: { name: true, email: true } } } });
    res.status(201).json(parent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ADD THIS ENDPOINT - Get parent's children
app.get('/api/parents/children', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let userId = null;
    
    console.log('🔍 Parent children request received');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = Buffer.from(token, 'base64').toString();
      userId = decoded.split(':')[0];
      console.log('👤 User ID from token:', userId);
    }
    
    if (!userId) {
      console.log('❌ No user ID found');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // First, check if the user is a parent
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      console.log('❌ User not found');
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (user.role !== 'PARENT') {
      console.log('❌ User is not a parent, role:', user.role);
      return res.status(403).json({ error: 'User is not a parent' });
    }
    
    // Find the parent profile
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
    
    console.log('Parent found:', parent ? 'Yes' : 'No');
    
    if (!parent) {
      console.log('❌ Parent profile not found for user:', userId);
      return res.status(404).json({ error: 'Parent profile not found' });
    }
    
    console.log('Students count:', parent.students.length);
    
    const children = parent.students.map(student => ({
      id: student.id,
      name: student.user?.name,
      admissionNo: student.admissionNo,
      className: student.class?.name
    }));
    
    console.log('✅ Returning children:', children);
    res.json(children);
  } catch (error) {
    console.error('❌ Error fetching parent children:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== PARENT CHILD LINKING ENDPOINTS ====================
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
      include: { user: true, class: true },
      orderBy: { user: { name: 'asc' } }
    });
    
    res.json({ data: students.map(s => ({ id: s.id, name: s.user?.name, admissionNo: s.admissionNo, className: s.class?.name, classId: s.classId })) });
  } catch (error) {
    console.error('Error fetching available students:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/parent/link-child', async (req, res) => {
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

    const { studentId } = req.body;
    if (!studentId) {
      return res.status(400).json({ error: 'Student ID required' });
    }

    // CHANGE THIS LINE - use userId from token, NOT findFirst
    const parent = await prisma.parent.findUnique({ 
      where: { userId: userId }  // ← THIS IS THE FIX
    });

    if (!parent) {
      return res.status(404).json({ error: 'Parent profile not found' });
    }

    const student = await prisma.student.findUnique({ 
      where: { id: studentId }, 
      include: { user: true, class: true } 
    });

    if (!student) return res.status(404).json({ error: 'Student not found' });
    if (student.parentId) return res.status(400).json({ error: 'Student already has a parent' });

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

    // CHANGE THIS LINE - use userId from token
    const parent = await prisma.parent.findUnique({ 
      where: { userId: userId }  // ← THIS IS THE FIX
    });

    if (!parent) return res.status(404).json({ error: 'Parent profile not found' });

    const student = await prisma.student.findUnique({ 
      where: { id: studentId }, 
      include: { user: true } 
    });

    if (!student) return res.status(404).json({ error: 'Student not found' });
    if (student.parentId !== parent.id) {
      return res.status(400).json({ error: 'Student not linked to your account' });
    }

    await prisma.student.update({ 
      where: { id: studentId }, 
      data: { parentId: null } 
    });

    res.json({ message: 'Child linked successfully' });
  } catch (error) {
    console.error('Error unlinking child:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== ATTENDANCE ENDPOINTS ====================
app.get('/api/attendance', async (req, res) => {
  try {
    const attendance = await prisma.attendance.findMany({
      include: { student: { include: { user: true } }, class: true }
    });
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/attendance', async (req, res) => {
  try {
    const { date, status, studentId, classId } = req.body;
    const attendance = await prisma.attendance.create({
      data: { date: new Date(date), status, studentId, classId },
      include: { student: { include: { user: true } }, class: true }
    });
    res.status(201).json(attendance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add bulk attendance endpoint
app.post('/api/attendance/bulk', async (req, res) => {
  try {
    const { date, attendances, classId } = req.body;
    console.log('📝 Recording bulk attendance for date:', date);
    
    const results = [];
    for (const att of attendances) {
      const attendance = await prisma.attendance.upsert({
        where: {
          studentId_date: {
            studentId: att.studentId,
            date: new Date(date)
          }
        },
        update: {
          status: att.status
        },
        create: {
          date: new Date(date),
          status: att.status,
          studentId: att.studentId,
          classId: classId || null
        }
      });
      results.push(attendance);
    }
    
    console.log(`✅ Recorded ${results.length} attendance records`);
    res.json({ data: results });
  } catch (error) {
    console.error('Error recording bulk attendance:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== GRADE ENDPOINTS ====================

// 1. GET all grades
app.get('/api/grades', async (req, res) => {
  try {
    const grades = await prisma.grade.findMany({
      include: { student: { include: { user: true } }, subject: true }
    });
    res.json(grades);
  } catch (error) {
    console.error('Error fetching grades:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. POST create grade
app.post('/api/grades', async (req, res) => {
  try {
    const { 
      score, 
      type, 
      studentId, 
      subjectId, 
      maxScore, 
      remarks, 
      percentage, 
      gradeLetter, 
      termId, 
      category 
    } = req.body;
    
    console.log('📝 Creating grade with data:', {
      score,
      type,
      studentId,
      subjectId,
      maxScore,
      category,
      percentage,
      termId
    });
    
    // Validate required fields
    if (!studentId) {
      console.error('❌ Missing studentId');
      return res.status(400).json({ 
        success: false,
        error: 'Student ID is required',
        details: 'Missing studentId field'
      });
    }
    
    if (!subjectId) {
      console.error('❌ Missing subjectId');
      return res.status(400).json({ 
        success: false,
        error: 'Subject ID is required',
        details: 'Missing subjectId field'
      });
    }
    
    if (score === undefined || score === null) {
      console.error('❌ Missing score');
      return res.status(400).json({ 
        success: false,
        error: 'Score is required',
        details: 'Missing score field'
      });
    }
    
    // Check if student exists
    const studentExists = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: true,
        class: true
      }
    });
    
    if (!studentExists) {
      console.error('❌ Student not found:', studentId);
      return res.status(404).json({ 
        success: false,
        error: 'Student not found',
        details: `No student found with ID: ${studentId}`
      });
    }
    
    console.log('✅ Student found:', {
      id: studentExists.id,
      name: studentExists.user?.name,
      class: studentExists.class?.name
    });
    
    // Check if subject exists
    const subjectExists = await prisma.subject.findUnique({
      where: { id: subjectId },
      include: {
        teacher: {
          include: {
            user: true
          }
        }
      }
    });
    
    if (!subjectExists) {
      console.error('❌ Subject not found:', subjectId);
      return res.status(404).json({ 
        success: false,
        error: 'Subject not found',
        details: `No subject found with ID: ${subjectId}`
      });
    }
    
    console.log('✅ Subject found:', {
      id: subjectExists.id,
      name: subjectExists.name,
      teacher: subjectExists.teacher?.user?.name
    });
    
    // Parse and validate scores
    let finalScore = parseFloat(score);
    let finalMaxScore = maxScore ? parseFloat(maxScore) : (type === 'EXAM' ? 60 : 40);
    
    if (isNaN(finalScore)) {
      console.error('❌ Invalid score:', score);
      return res.status(400).json({ 
        success: false,
        error: 'Invalid score',
        details: 'Score must be a valid number'
      });
    }
    
    if (finalScore < 0 || finalScore > finalMaxScore) {
      console.error(`❌ Score out of range: ${finalScore} (max: ${finalMaxScore})`);
      return res.status(400).json({ 
        success: false,
        error: 'Score out of range',
        details: `Score must be between 0 and ${finalMaxScore}`
      });
    }
    
    let finalPercentage = percentage ? parseFloat(percentage) : null;
    let finalGrade = gradeLetter;
    
    // Calculate percentage if not provided
    if (!finalPercentage && finalScore) {
      finalPercentage = (finalScore / finalMaxScore) * 100;
    }
    
    // Calculate grade letter if not provided
    if (!finalGrade && finalPercentage) {
      if (finalPercentage >= 70) finalGrade = 'A';
      else if (finalPercentage >= 60) finalGrade = 'B';
      else if (finalPercentage >= 50) finalGrade = 'C';
      else if (finalPercentage >= 45) finalGrade = 'D';
      else if (finalPercentage >= 40) finalGrade = 'E';
      else finalGrade = 'F';
    }
    
    // Determine category if not provided
    let finalCategory = category;
    if (!finalCategory) {
      finalCategory = type === 'EXAM' ? 'EXAM' : 'CA';
    }
    
    let finalType = type;
    if (!finalType) {
      finalType = finalCategory === 'EXAM' ? 'EXAM' : 'CA';
    }
    
    console.log('📊 Calculated values:', {
      finalScore,
      finalMaxScore,
      finalPercentage: finalPercentage?.toFixed(2),
      finalGrade,
      finalType,
      finalCategory
    });
    
    // Check if grade already exists for this student, subject, and term
    const existingGrade = await prisma.grade.findFirst({
      where: {
        studentId: studentId,
        subjectId: subjectId,
        type: finalType,
        termId: termId || null
      }
    });
    
    if (existingGrade) {
      console.log('⚠️ Grade already exists, updating instead...');
      
      const updatedGrade = await prisma.grade.update({
        where: { id: existingGrade.id },
        data: {
          score: finalScore,
          percentage: finalPercentage,
          gradeLetter: finalGrade,
          maxScore: finalMaxScore,
          remarks: remarks || null,
          updatedAt: new Date()
        },
        include: {
          student: {
            include: {
              user: true,
              class: true
            }
          },
          subject: true
        }
      });
      
      console.log('✅ Grade updated successfully:', updatedGrade.id);
      
      return res.status(200).json({
        success: true,
        data: updatedGrade,
        message: `${finalType} grade updated successfully`
      });
    }
    
    // Create new grade
    const grade = await prisma.grade.create({
      data: {
        score: finalScore,
        percentage: finalPercentage,
        gradeLetter: finalGrade,
        type: finalType,
        category: finalCategory,
        studentId: studentId,
        subjectId: subjectId,
        maxScore: finalMaxScore,
        remarks: remarks || null,
        termId: termId || null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      include: {
        student: {
          include: {
            user: true,
            class: true
          }
        },
        subject: true
      }
    });
    
    console.log('✅ Grade created successfully:', grade.id);
    
    res.status(201).json({
      success: true,
      data: grade,
      message: `${finalType} grade created successfully`
    });
    
  } catch (error) {
    console.error('❌ Error creating grade:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Full error:', error);
    
    // Handle specific Prisma errors
    if (error.code === 'P2002') {
      return res.status(400).json({ 
        success: false,
        error: 'Grade already exists',
        details: 'A grade record for this student, subject, and term already exists'
      });
    }
    
    if (error.code === 'P2003') {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid foreign key',
        details: 'The provided student ID or subject ID does not exist'
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to create grade',
      details: error.message,
      code: error.code
    });
  }
});

// 3. DELETE grade - MOVED HERE (BEFORE /grades/filter)
app.delete('/api/grades/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🗑️ Deleting grade:', id);
    
    // Check if grade exists
    const grade = await prisma.grade.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            user: true
          }
        },
        subject: true
      }
    });
    
    if (!grade) {
      console.log('❌ Grade not found:', id);
      return res.status(404).json({ 
        success: false,
        error: 'Grade not found' 
      });
    }
    
    console.log(`📊 Deleting grade for ${grade.student?.user?.name} - ${grade.subject?.name} (${grade.type})`);
    
    // Delete the grade
    await prisma.grade.delete({
      where: { id }
    });
    
    console.log('✅ Grade deleted successfully');
    
    res.json({ 
      success: true,
      message: `${grade.type} grade deleted successfully`,
      data: {
        id: grade.id,
        studentName: grade.student?.user?.name,
        subjectName: grade.subject?.name,
        type: grade.type
      }
    });
    
  } catch (error) {
    console.error('❌ Error deleting grade:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete grade',
      details: error.message 
    });
  }
});

// 4. GET filtered grades
app.get('/api/grades/filter', async (req, res) => {
  try {
    const { studentId, subjectId, type, teacherId, termId, category, sessionId } = req.query;
    const where = {};
    
    if (studentId) where.studentId = studentId;
    if (subjectId) where.subjectId = subjectId;
    if (type) where.type = type;
    if (termId) where.termId = termId;
    if (category) where.category = category;
    
    // If teacherId is provided, filter by subjects the teacher teaches
    if (teacherId) {
      where.subject = { teacherId: teacherId };
    }
    
    // If sessionId is provided, filter by term session
    if (sessionId) {
      where.term = { sessionId: sessionId };
    }
    
    const grades = await prisma.grade.findMany({
      where,
      include: {
        student: {
          include: {
            user: true,
            class: true
          }
        },
        subject: {
          include: {
            teacher: {
              include: {
                user: true
              }
            }
          }
        },
        term: {
          include: {
            session: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    const formattedGrades = grades.map(grade => ({
      id: grade.id,
      score: grade.score,
      percentage: grade.percentage,
      gradeLetter: grade.gradeLetter,
      type: grade.type,
      category: grade.category,
      maxScore: grade.maxScore,
      remarks: grade.remarks,
      createdAt: grade.createdAt,
      studentId: grade.studentId,
      student: {
        id: grade.student.id,
        name: grade.student.user?.name,
        admissionNo: grade.student.admissionNo,
        className: grade.student.class?.name
      },
      subjectId: grade.subjectId,
      subject: {
        id: grade.subject.id,
        name: grade.subject.name,
        teacher: grade.subject.teacher?.user?.name
      },
      termId: grade.termId,
      term: grade.term ? {
        id: grade.term.id,
        name: grade.term.name,
        session: grade.term.session ? {
          id: grade.term.session.id,
          name: grade.term.session.name
        } : null
      } : null
    }));
    
    res.json({ data: formattedGrades });
  } catch (error) {
    console.error('Error fetching filtered grades:', error);
    res.status(500).json({ error: error.message });
  }
});

// 5. GET grade summary for a student
app.get('/api/grades/summary/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { termId } = req.query;
    
    const where = { studentId };
    if (termId) where.termId = termId;
    
    const grades = await prisma.grade.findMany({
      where,
      include: { subject: true }
    });
    
    const summary = {
      totalGrades: grades.length,
      average: grades.length > 0 ? grades.reduce((sum, g) => sum + (g.percentage || g.score), 0) / grades.length : 0,
      byType: {},
      bySubject: {}
    };
    
    grades.forEach(grade => {
      if (!summary.byType[grade.type]) {
        summary.byType[grade.type] = { count: 0, total: 0, average: 0 };
      }
      summary.byType[grade.type].count++;
      summary.byType[grade.type].total += (grade.percentage || grade.score);
      summary.byType[grade.type].average = summary.byType[grade.type].total / summary.byType[grade.type].count;
      
      if (!summary.bySubject[grade.subject.name]) {
        summary.bySubject[grade.subject.name] = { count: 0, total: 0, average: 0, subjectId: grade.subjectId };
      }
      summary.bySubject[grade.subject.name].count++;
      summary.bySubject[grade.subject.name].total += (grade.percentage || grade.score);
      summary.bySubject[grade.subject.name].average = summary.bySubject[grade.subject.name].total / summary.bySubject[grade.subject.name].count;
    });
    
    res.json({ data: summary });
  } catch (error) {
    console.error('Error fetching grade summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// 6. GET calculate final grade for a student (CA 40% + Exam 60%)
app.get('/api/grades/final/:studentId/:subjectId', async (req, res) => {
  try {
    const { studentId, subjectId } = req.params;
    const { termId } = req.query;
    
    const where = { studentId, subjectId };
    if (termId) where.termId = termId;
    
    const grades = await prisma.grade.findMany({
      where,
      include: { subject: true }
    });
    
    // Separate CA and Exam grades
    const caGrades = grades.filter(g => g.category === 'CA');
    const examGrades = grades.filter(g => g.category === 'EXAM');
    
    // Calculate CA total (40% of total)
    let caTotal = 0;
    let caMaxTotal = 0;
    caGrades.forEach(grade => {
      caTotal += grade.score;
      caMaxTotal += grade.maxScore;
    });
    const caPercentage = caMaxTotal > 0 ? (caTotal / caMaxTotal) * 40 : 0;
    
    // Calculate Exam score (60% of total)
    let examScore = 0;
    let examMax = 0;
    examGrades.forEach(grade => {
      examScore += grade.score;
      examMax += grade.maxScore;
    });
    const examPercentage = examMax > 0 ? (examScore / examMax) * 60 : 0;
    
    // Final total
    const finalScore = caPercentage + examPercentage;
    const finalGrade = getGradeLetter(finalScore);
    
    res.json({
      data: {
        ca: {
          total: caTotal,
          maxTotal: caMaxTotal,
          percentage: caPercentage,
          weight: 40,
          grades: caGrades
        },
        exam: {
          total: examScore,
          maxTotal: examMax,
          percentage: examPercentage,
          weight: 60,
          grades: examGrades
        },
        final: {
          score: finalScore.toFixed(1),
          grade: finalGrade,
          remarks: finalGrade === 'A' ? 'Excellent!' :
                  finalGrade === 'B' ? 'Very Good' :
                  finalGrade === 'C' ? 'Good' :
                  finalGrade === 'D' ? 'Satisfactory' :
                  finalGrade === 'E' ? 'Pass' : 'Needs Improvement'
        }
      }
    });
  } catch (error) {
    console.error('Error calculating final grade:', error);
    res.status(500).json({ error: error.message });
  }
});

// 7. Bulk delete grades (optional)
app.post('/api/grades/bulk-delete', async (req, res) => {
  try {
    const { gradeIds } = req.body;
    
    if (!gradeIds || !Array.isArray(gradeIds) || gradeIds.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'No grade IDs provided' 
      });
    }
    
    console.log(`🗑️ Bulk deleting ${gradeIds.length} grades`);
    
    const deletedGrades = await prisma.grade.deleteMany({
      where: {
        id: { in: gradeIds }
      }
    });
    
    console.log(`✅ Deleted ${deletedGrades.count} grades`);
    
    res.json({ 
      success: true,
      message: `${deletedGrades.count} grades deleted successfully`,
      count: deletedGrades.count
    });
    
  } catch (error) {
    console.error('❌ Error bulk deleting grades:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete grades',
      details: error.message 
    });
  }
});

function getGradeLetter(percentage) {
  if (percentage >= 70) return 'A';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  if (percentage >= 45) return 'D';
  if (percentage >= 40) return 'E';
  return 'F';
}

// ==================== SESSION MANAGEMENT ENDPOINTS ====================
app.get('/api/sessions', async (req, res) => {
  try {
    const sessions = await prisma.session.findMany({
      include: {
        terms: true,
        _count: {
          select: { terms: true }
        }
      },
      orderBy: [
        { isActive: 'desc' },
        { startDate: 'desc' }
      ]
    });
    res.json({ data: sessions });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sessions/active', async (req, res) => {
  try {
    const activeSession = await prisma.session.findFirst({
      where: { isActive: true, isArchived: false },
      include: { terms: true }
    });
    res.json({ data: activeSession });
  } catch (error) {
    console.error('Error fetching active session:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sessions', async (req, res) => {
  try {
    const { name, startDate, endDate, copyFromSessionId, isActive } = req.body;

    if (!name || !startDate || !endDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existingSession = await prisma.session.findUnique({
      where: { name }
    });

    if (existingSession) {
      return res.status(400).json({ error: 'Session already exists' });
    }

    if (isActive) {
      await prisma.session.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      });
    }

    const session = await prisma.session.create({
      data: {
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: isActive || false
      }
    });

    // Auto-create 3 terms for this session
    const termNames = ['1st Term', '2nd Term', '3rd Term'];
    const sessionStart = new Date(startDate);
    const sessionEnd = new Date(endDate);
    const totalDays = (sessionEnd - sessionStart) / (1000 * 60 * 60 * 24);
    const termDays = Math.floor(totalDays / 3);

    for (let i = 0; i < termNames.length; i++) {
      const termStart = new Date(sessionStart);
      termStart.setDate(sessionStart.getDate() + (i * termDays));

      const termEnd = new Date(termStart);
      termEnd.setDate(termStart.getDate() + termDays - 1);

      // For the last term, use the session end date
      if (i === termNames.length - 1) {
        termEnd.setTime(sessionEnd.getTime());
      }

      await prisma.term.create({
        data: {
          name: termNames[i],
          sessionId: session.id,
          startDate: termStart,
          endDate: termEnd,
          isActive: (i === 0 && isActive) // First term active if session is active
        }
      });
    }

    // If copying from another session, also copy fees? (optional)
    if (copyFromSessionId) {
      const sourceSession = await prisma.session.findUnique({
        where: { id: copyFromSessionId },
        include: { terms: true }
      });

      if (sourceSession && sourceSession.terms.length > 0) {
        console.log(`📋 Additional terms copy from ${sourceSession.name}`);
      }
    }

    console.log(`✅ Session created with 3 terms: ${session.name}`);

    res.status(201).json({ 
      data: session, 
      message: 'Session and 3 terms created successfully' 
    });

  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, startDate, endDate, isActive, isArchived } = req.body;
    
    if (isActive) {
      await prisma.session.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      });
    }
    
    const session = await prisma.session.update({
      where: { id },
      data: {
        name,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        isActive,
        isArchived
      }
    });
    
    res.json({ data: session, message: 'Session updated successfully' });
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sessions/:id/archive', async (req, res) => {
  try {
    const { id } = req.params;
    
    const session = await prisma.session.update({
      where: { id },
      data: { 
        isActive: false,
        isArchived: true 
      }
    });
    
    await prisma.term.updateMany({
      where: { sessionId: id },
      data: { isActive: false }
    });
    
    res.json({ 
      data: session, 
      message: 'Session archived successfully' 
    });
    
  } catch (error) {
    console.error('Error archiving session:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sessions/next', async (req, res) => {
  try {
    const { currentSessionId } = req.body;
    
    const currentSession = await prisma.session.findUnique({
      where: { id: currentSessionId },
      include: { terms: true }
    });
    
    if (!currentSession) {
      return res.status(404).json({ error: 'Current session not found' });
    }
    
    const currentYearStart = parseInt(currentSession.name.split('-')[0]);
    const nextYearStart = currentYearStart + 1;
    const nextYearEnd = nextYearStart + 1;
    const nextSessionName = `${nextYearStart}-${nextYearEnd}`;
    
    const nextStartDate = new Date(currentSession.startDate);
    nextStartDate.setFullYear(nextStartDate.getFullYear() + 1);
    
    const nextEndDate = new Date(currentSession.endDate);
    nextEndDate.setFullYear(nextEndDate.getFullYear() + 1);
    
    await prisma.session.update({
      where: { id: currentSessionId },
      data: { isActive: false }
    });
    
    const newSession = await prisma.session.create({
      data: {
        name: nextSessionName,
        startDate: nextStartDate,
        endDate: nextEndDate,
        isActive: true
      }
    });
    
    for (const term of currentSession.terms) {
      const termStartDate = new Date(term.startDate);
      termStartDate.setFullYear(termStartDate.getFullYear() + 1);
      
      const termEndDate = new Date(term.endDate);
      termEndDate.setFullYear(termEndDate.getFullYear() + 1);
      
      await prisma.term.create({
        data: {
          name: term.name,
          sessionId: newSession.id,
          startDate: termStartDate,
          endDate: termEndDate,
          isActive: false
        }
      });
    }
    
    console.log(`✅ Created next session: ${nextSessionName} with ${currentSession.terms.length} terms`);
    
    res.json({ 
      data: newSession, 
      message: `Next session ${nextSessionName} created successfully` 
    });
    
  } catch (error) {
    console.error('Error creating next session:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== TERM ENDPOINTS ====================
app.get('/api/terms', async (req, res) => {
  try {
    const { sessionId } = req.query;
    const where = {};
    if (sessionId) where.sessionId = sessionId;
    
    const terms = await prisma.term.findMany({
      where,
      include: {
        session: true
      },
      orderBy: [
        { isActive: 'desc' },
        { startDate: 'asc' }
      ]
    });
    res.json({ data: terms });
  } catch (error) {
    console.error('Error fetching terms:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/terms/active', async (req, res) => {
  try {
    const activeTerm = await prisma.term.findFirst({
      where: { isActive: true },
      include: { session: true }
    });
    res.json({ data: activeTerm });
  } catch (error) {
    console.error('Error fetching active term:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/terms', async (req, res) => {
  try {
    const { name, sessionId, startDate, endDate, isActive } = req.body;
    
    if (!name || !sessionId || !startDate || !endDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const existingTerm = await prisma.term.findFirst({
      where: {
        name,
        sessionId
      }
    });
    
    if (existingTerm) {
      return res.status(400).json({ error: 'Term already exists in this session' });
    }
    
    if (isActive) {
      await prisma.term.updateMany({
        where: { sessionId, isActive: true },
        data: { isActive: false }
      });
    }
    
    const term = await prisma.term.create({
      data: {
        name,
        sessionId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: isActive || false
      },
      include: {
        session: true
      }
    });
    
    res.status(201).json({ data: term, message: 'Term created successfully' });
  } catch (error) {
    console.error('Error creating term:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/terms/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, sessionId, startDate, endDate, isActive } = req.body;
    
    const term = await prisma.term.findUnique({
      where: { id },
      include: { session: true }
    });
    
    if (!term) {
      return res.status(404).json({ error: 'Term not found' });
    }
    
    if (isActive) {
      await prisma.term.updateMany({
        where: { sessionId: term.sessionId, isActive: true },
        data: { isActive: false }
      });
    }
    
    const updatedTerm = await prisma.term.update({
      where: { id },
      data: {
        name,
        sessionId: sessionId || term.sessionId,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        isActive
      },
      include: {
        session: true
      }
    });
    
    res.json({ data: updatedTerm, message: 'Term updated successfully' });
  } catch (error) {
    console.error('Error updating term:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/terms/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const feesCount = await prisma.fee.count({
      where: { termId: id }
    });
    
    if (feesCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete term with associated fees. Delete or reassign fees first.' 
      });
    }
    
    await prisma.term.delete({
      where: { id }
    });
    
    res.json({ message: 'Term deleted successfully' });
  } catch (error) {
    console.error('Error deleting term:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== BURSAR / FEE MANAGEMENT ENDPOINTS ====================
app.get('/api/bursar/students', async (req, res) => {
  try {
    const students = await prisma.student.findMany({
      include: { user: { select: { name: true, email: true } }, class: true }
    });
    res.json({ data: students.map(s => ({ id: s.id, name: s.user?.name, admissionNo: s.admissionNo, className: s.class?.name, classId: s.classId })) });
  } catch (error) {
    console.error('Error fetching students for bursar:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/fees', async (req, res) => {
  try {
    console.log('💰 Fetching all fees...');
    const { termId } = req.query;
    
    const where = {};
    if (termId) {
      where.termId = termId;
    }
    
    const fees = await prisma.fee.findMany({
      where,
      include: {
        student: {
          include: {
            user: true,
            class: true
          }
        },
        term: {
          include: {
            session: true
          }
        },
        payments: {
          include: {
            recordedBy: {
              select: {
                name: true
              }
            }
          }
        },
        feeItems: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`✅ Found ${fees.length} fees`);
    
    const transformedFees = fees.map(function(fee) {
      let firstName = 'Unknown';
      let lastName = '';
      if (fee.student?.user?.name) {
        const nameParts = fee.student.user.name.split(' ');
        firstName = nameParts[0] || 'Unknown';
        lastName = nameParts.slice(1).join(' ') || '';
      }
      
      return {
        id: fee.id,
        studentId: fee.studentId,
        termId: fee.termId,
        totalAmount: fee.totalAmount,
        amountPaid: fee.paidAmount,
        balance: fee.balance,
        status: fee.status === 'PAID' ? 'PAID' : 
                fee.status === 'PARTIAL' ? 'PARTIALLY_PAID' : 'UNPAID',
        receiptNo: fee.receiptNo,
        createdAt: fee.createdAt,
        updatedAt: fee.updatedAt,
        student: fee.student ? {
          id: fee.student.id,
          admissionNo: fee.student.admissionNo || 'N/A',
          user: {
            firstName: firstName,
            lastName: lastName,
            email: fee.student.user?.email || ''
          },
          class: fee.student.class ? {
            name: fee.student.class.name || '',
            section: fee.student.class.section || ''
          } : null
        } : null,
        term: fee.term ? {
          id: fee.term.id,
          name: fee.term.name,
          session: {
            id: fee.term.session?.id,
            name: fee.term.session?.name,
            year: fee.term.session?.name
          }
        } : null,
        payments: fee.payments ? fee.payments.map(function(payment) {
          return {
            id: payment.id,
            feeId: payment.feeId,
            amount: payment.amount,
            date: payment.paymentDate,
            method: payment.paymentMethod,
            reference: payment.referenceNo,
            recordedBy: payment.recordedBy ? {
              firstName: payment.recordedBy.name?.split(' ')[0] || '',
              lastName: payment.recordedBy.name?.split(' ').slice(1).join(' ') || ''
            } : null
          };
        }) : []
      };
    });
    
    res.json({
      data: transformedFees
    });
  } catch (error) {
    console.error('Error fetching fees:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/fees/summary', async (req, res) => {
  try {
    console.log('📊 Fetching fee summary...');
    const { termId, sessionId } = req.query;
    
    const where = {};
    if (termId) where.termId = termId;
    if (sessionId) where.term = { sessionId };
    
    const fees = await prisma.fee.findMany({ where });
    
    console.log(`📊 Found ${fees.length} fees`);
    
    let totalExpected = 0;
    let totalCollected = 0;
    
    fees.forEach(fee => {
      totalExpected += fee.totalAmount || 0;
      totalCollected += fee.paidAmount || 0;
    });
    
    const totalOutstanding = totalExpected - totalCollected;
    const collectionRate = totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0;
    
    const summary = {
      totalExpected,
      totalCollected,
      totalOutstanding,
      collectionRate: Math.round(collectionRate * 100) / 100
    };
    
    console.log('📊 Summary calculated:', summary);
    
    res.json({
      data: summary
    });
    
  } catch (error) {
    console.error('❌ Error fetching fee summary:', error);
    res.status(500).json({ 
      error: 'Failed to fetch fee summary',
      details: error.message 
    });
  }
});

app.get('/api/fees/parent', async (req, res) => {
  try {
    console.log('👪 Fetching parent fees...');
    
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

    console.log('🔍 Fetching fees for user ID:', userId);

    const parent = await prisma.parent.findUnique({
      where: { userId: userId },
      include: {
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
            }
          }
        }
      }
    });
    
    if (!parent || parent.students.length === 0) {
      return res.json({ 
        data: { 
          fees: [], 
          totalOutstanding: 0 
        } 
      });
    }
    
    // Group fees by child - matching frontend expected structure
    const groupedFees = parent.students.map(student => {
      // Transform each fee with safe default values
      const transformedFees = (student.fees || []).map(fee => ({
        id: fee.id || '',
        studentId: fee.studentId || '',
        termId: fee.termId || '',
        totalAmount: Number(fee.totalAmount) || 0,
        amountPaid: Number(fee.paidAmount) || 0,
        balance: Number(fee.balance) || 0,
        status: fee.status === 'PAID' ? 'PAID' : fee.status === 'PARTIAL' ? 'PARTIALLY_PAID' : 'UNPAID',
        createdAt: fee.createdAt || new Date(),
        updatedAt: fee.updatedAt || new Date(),
        term: fee.term ? {
          id: fee.term.id || '',
          name: fee.term.name || 'N/A',
          session: fee.term.session ? {
            id: fee.term.session.id || '',
            name: fee.term.session.name || 'N/A',
            year: fee.term.session.name || 'N/A'
          } : null
        } : null,
        payments: (fee.payments || []).map(p => ({
          id: p.id || '',
          amount: Number(p.amount) || 0,
          date: p.paymentDate || new Date(),
          method: p.paymentMethod || 'CASH',
          reference: p.referenceNo || ''
        }))
      }));
      
      // Return the child data structure exactly as frontend expects
      return {
        childId: student.id,
        childName: student.user?.name || 'Unknown',
        admissionNo: student.admissionNo || 'N/A',
        class: student.class ? {
          name: student.class.name || 'No Class Assigned',
          section: student.class.section || '',
          grade: student.class.grade || 0
        } : { name: 'No Class Assigned', section: '', grade: 0 },
        fees: transformedFees
      };
    });
    
    // Calculate total outstanding across all children
    const totalOutstanding = groupedFees.reduce((sum, child) => 
      sum + child.fees.reduce((childSum, fee) => childSum + (fee.balance || 0), 0), 0
    );
    
    console.log(`✅ Found ${groupedFees.length} children with fee records`);
    console.log(`💰 Total outstanding: ${totalOutstanding}`);
    
    // Return in the exact format frontend expects
    res.json({
      data: {
        fees: groupedFees,
        totalOutstanding: totalOutstanding || 0
      }
    });
    
  } catch (error) {
    console.error('Error fetching parent fees:', error);
    res.status(500).json({ 
      error: error.message,
      data: { fees: [], totalOutstanding: 0 }
    });
  }
});

// ==================== BULK DELETE FEES ENDPOINT (PLACED BEFORE /:id ROUTES) ====================
app.post('/api/fees/bulk-delete', async (req, res) => {
  try {
    const { feeIds } = req.body;
    
    if (!feeIds || !Array.isArray(feeIds) || feeIds.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'No fee IDs provided',
        message: 'Please provide an array of fee IDs to delete'
      });
    }
    
    console.log(`🗑️ Bulk deleting ${feeIds.length} fees...`);
    console.log('Fee IDs to delete:', feeIds);
    
    // First, check if all fees exist and get their details
    const existingFees = await prisma.fee.findMany({
      where: { id: { in: feeIds } },
      include: {
        student: {
          include: {
            user: true
          }
        },
        payments: true,
        feeItems: true,
        discounts: true
      }
    });
    
    const existingFeeIds = existingFees.map(f => f.id);
    const missingFeeIds = feeIds.filter(id => !existingFeeIds.includes(id));
    
    if (missingFeeIds.length > 0) {
      console.log('⚠️ Some fees not found:', missingFeeIds);
    }
    
    if (existingFeeIds.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No fees found',
        message: 'None of the provided fee IDs exist'
      });
    }
    
    // Delete all related records first (payments, feeItems, discounts) then delete fees
    // Using Promise.all for parallel execution since we're not in a transaction that needs rollback
    const results = await Promise.all([
      // Delete payments for all fees
      prisma.payment.deleteMany({
        where: { feeId: { in: existingFeeIds } }
      }),
      // Delete fee items for all fees
      prisma.feeItem.deleteMany({
        where: { feeId: { in: existingFeeIds } }
      }),
      // Delete discounts for all fees
      prisma.discount.deleteMany({
        where: { feeId: { in: existingFeeIds } }
      })
    ]);
    
    const paymentsDeleted = results[0].count;
    const feeItemsDeleted = results[1].count;
    const discountsDeleted = results[2].count;
    
    console.log(`  🗑️ Deleted ${paymentsDeleted} payments`);
    console.log(`  🗑️ Deleted ${feeItemsDeleted} fee items`);
    console.log(`  🗑️ Deleted ${discountsDeleted} discounts`);
    
    // Finally delete the fees themselves
    const deletedFees = await prisma.fee.deleteMany({
      where: { id: { in: existingFeeIds } }
    });
    
    console.log(`  🗑️ Deleted ${deletedFees.count} fees`);
    console.log(`✅ Successfully bulk deleted ${deletedFees.count} fees`);
    
    res.json({ 
      success: true,
      message: `${deletedFees.count} fee record(s) deleted successfully`,
      count: deletedFees.count,
      details: {
        fees: deletedFees.count,
        payments: paymentsDeleted,
        feeItems: feeItemsDeleted,
        discounts: discountsDeleted,
        missingIds: missingFeeIds
      }
    });
    
  } catch (error) {
    console.error('❌ Error bulk deleting fees:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete fee records',
      message: error.message
    });
  }
});

// ==================== FEE ROUTES WITH PARAMETERS (AFTER SPECIFIC ROUTES) ====================

app.get('/api/fees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const fee = await prisma.fee.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            user: true,
            class: true
          }
        },
        term: {
          include: {
            session: true
          }
        },
        payments: {
          include: {
            recordedBy: {
              select: {
                name: true
              }
            }
          },
          orderBy: { paymentDate: 'desc' }
        },
        feeItems: true,
        discounts: {
          include: {
            approvedBy: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });
    
    if (!fee) {
      return res.status(404).json({ error: 'Fee not found' });
    }
    
    let firstName = 'Unknown';
    let lastName = '';
    if (fee.student?.user?.name) {
      const nameParts = fee.student.user.name.split(' ');
      firstName = nameParts[0] || 'Unknown';
      lastName = nameParts.slice(1).join(' ') || '';
    }
    
    const transformedFee = {
      id: fee.id,
      studentId: fee.studentId,
      termId: fee.termId,
      totalAmount: fee.totalAmount,
      amountPaid: fee.paidAmount,
      balance: fee.balance,
      status: fee.status === 'PAID' ? 'PAID' : 
              fee.status === 'PARTIAL' ? 'PARTIALLY_PAID' : 'UNPAID',
      receiptNo: fee.receiptNo,
      createdAt: fee.createdAt,
      updatedAt: fee.updatedAt,
      student: fee.student ? {
        id: fee.student.id,
        admissionNo: fee.student.admissionNo || 'N/A',
        user: {
          firstName: firstName,
          lastName: lastName,
          email: fee.student.user?.email || ''
        },
        class: fee.student.class ? {
          name: fee.student.class.name,
          section: fee.student.class.section || ''
        } : null
      } : null,
      term: fee.term ? {
        id: fee.term.id,
        name: fee.term.name,
        session: {
          id: fee.term.session?.id,
          name: fee.term.session?.name,
          year: fee.term.session?.name
        }
      } : null,
      payments: fee.payments ? fee.payments.map(function(payment) {
        return {
          id: payment.id,
          feeId: payment.feeId,
          amount: payment.amount,
          date: payment.paymentDate,
          method: payment.paymentMethod,
          reference: payment.referenceNo,
          recordedBy: payment.recordedBy ? {
            firstName: payment.recordedBy.name?.split(' ')[0] || '',
            lastName: payment.recordedBy.name?.split(' ').slice(1).join(' ') || ''
          } : null
        };
      }) : []
    };
    
    res.json({
      data: transformedFee
    });
  } catch (error) {
    console.error('Error fetching fee:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/fees/student/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const fees = await prisma.fee.findMany({
      where: { studentId },
      include: {
        term: {
          include: {
            session: true
          }
        },
        payments: true,
        feeItems: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    const transformedFees = fees.map(function(fee) {
      return {
        id: fee.id,
        studentId: fee.studentId,
        termId: fee.termId,
        totalAmount: fee.totalAmount,
        amountPaid: fee.paidAmount,
        balance: fee.balance,
        status: fee.status === 'PAID' ? 'PAID' : 
                fee.status === 'PARTIAL' ? 'PARTIALLY_PAID' : 'UNPAID',
        createdAt: fee.createdAt,
        updatedAt: fee.updatedAt,
        term: fee.term ? {
          id: fee.term.id,
          name: fee.term.name,
          session: {
            id: fee.term.session?.id,
            name: fee.term.session?.name,
            year: fee.term.session?.name
          }
        } : null,
        payments: fee.payments
      };
    });
    
    res.json({
      data: transformedFees
    });
  } catch (error) {
    console.error('Error fetching student fees:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/fees', async (req, res) => {
  try {
    const { studentId, termId, totalAmount } = req.body;
    console.log('📝 Creating fee record:', { studentId, termId, totalAmount });
    
    if (!studentId || !termId || !totalAmount) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ 
        error: 'Missing required fields: studentId, termId, and totalAmount are required' 
      });
    }
    
    console.log('🔍 Checking student with ID:', studentId);
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: true,
        class: true
      }
    });
    
    if (!student) {
      console.log('❌ Student not found:', studentId);
      return res.status(404).json({ error: 'Student not found' });
    }
    console.log('✅ Student found:', { 
      id: student.id, 
      name: student.user?.name,
      admissionNo: student.admissionNo 
    });
    
    console.log('🔍 Checking term with ID:', termId);
    let term;
    if (termId) {
      term = await prisma.term.findUnique({
        where: { id: termId },
        include: {
          session: true
        }
      });
    } else {
      term = await prisma.term.findFirst({
        where: { isActive: true },
        include: {
          session: true
        }
      });
    }
    
    if (!term) {
      console.log('❌ Term not found with ID:', termId);
      const availableTerms = await prisma.term.findMany({
        include: { session: true }
      });
      console.log('Available terms:', availableTerms.map(t => ({ id: t.id, name: t.name, session: t.session?.name, isActive: t.isActive })));
      
      return res.status(404).json({ 
        error: 'Term not found',
        message: 'The selected term does not exist. Please check the term ID.',
        availableTerms: availableTerms.map(t => ({ id: t.id, name: t.name, session: t.session?.name, isActive: t.isActive }))
      });
    }
    console.log('✅ Term found:', { id: term.id, name: term.name, session: term.session?.name });
    
    console.log('💾 Creating fee in database...');
    const dueDate = term.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    const fee = await prisma.fee.create({
      data: {
        studentId,
        termId: term.id,
        totalAmount: parseFloat(totalAmount),
        paidAmount: 0,
        balance: parseFloat(totalAmount),
        status: 'PENDING',
        dueDate: dueDate,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      include: {
        student: {
          include: {
            user: true,
            class: true
          }
        },
        term: {
          include: {
            session: true
          }
        }
      }
    });
    console.log('✅ Fee created with ID:', fee.id);
    
    let firstName = 'Unknown';
    let lastName = '';
    if (fee.student?.user?.name) {
      const nameParts = fee.student.user.name.split(' ');
      firstName = nameParts[0] || 'Unknown';
      lastName = nameParts.slice(1).join(' ') || '';
    }
    
    const transformedFee = {
      id: fee.id,
      studentId: fee.studentId,
      termId: fee.termId,
      totalAmount: fee.totalAmount,
      amountPaid: 0,
      balance: fee.balance,
      status: 'UNPAID',
      createdAt: fee.createdAt,
      updatedAt: fee.updatedAt,
      student: fee.student ? {
        id: fee.student.id,
        admissionNo: fee.student.admissionNo || 'N/A',
        user: {
          firstName: firstName,
          lastName: lastName,
          email: fee.student.user?.email || ''
        },
        class: fee.student.class ? {
          name: fee.student.class.name,
          section: fee.student.class.section || ''
        } : null
      } : null,
      term: fee.term ? {
        id: fee.term.id,
        name: fee.term.name,
        session: {
          id: fee.term.session?.id,
          name: fee.term.session?.name,
          year: fee.term.session?.name
        }
      } : null,
      payments: []
    };
    
    console.log('✅ Sending response to client');
    res.status(201).json({
      data: transformedFee
    });
    
  } catch (error) {
    console.error('❌ ERROR CREATING FEE:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'A fee record for this student and term already exists' });
    }
    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'Invalid student or term ID' });
    }
    
    res.status(500).json({ 
      error: 'Failed to create fee record',
      details: error.message 
    });
  }
});

app.post('/api/fees/bulk', async (req, res) => {
  try {
    const { classFees, termId } = req.body;
    
    if (!classFees || !termId || !Array.isArray(classFees) || classFees.length === 0) {
      return res.status(400).json({ error: 'Missing required fields: classFees array and termId are required' });
    }
    
    const term = await prisma.term.findUnique({
      where: { id: termId },
      include: { session: true }
    });
    
    if (!term) {
      return res.status(404).json({ error: 'Term not found' });
    }
    
    const dueDate = term.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    let totalFeesCreated = 0;
    const results = [];
    
    for (const classFee of classFees) {
      const { classId, amount, className } = classFee;
      
      if (!amount || amount <= 0) continue;
      
      const students = await prisma.student.findMany({
        where: { classId },
        select: { id: true }
      });
      
      if (students.length === 0) {
        results.push({ classId, className, count: 0, amount, error: 'No students found' });
        continue;
      }
      
      const fees = await Promise.all(
        students.map(student => 
          prisma.fee.create({
            data: {
              studentId: student.id,
              termId,
              totalAmount: amount,
              paidAmount: 0,
              balance: amount,
              status: 'PENDING',
              dueDate,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          })
        )
      );
      
      totalFeesCreated += fees.length;
      results.push({ classId, className, count: fees.length, amount, success: true });
    }
    
    console.log(`✅ Bulk fee creation completed: ${totalFeesCreated} fee records created`);
    
    res.json({
      message: `Successfully created ${totalFeesCreated} fee records`,
      totalFees: totalFeesCreated,
      results
    });
    
  } catch (error) {
    console.error('Error creating bulk fees:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/fees/:feeId/payments', async (req, res) => {
  try {
    const { feeId } = req.params;
    const { amount, method, reference } = req.body;
    
    console.log('💵 Recording payment for fee:', feeId, { amount, method, reference });
    
    const bursarUser = await prisma.user.findFirst({
      where: { role: 'BURSAR' }
    });
    
    if (!bursarUser) {
      return res.status(404).json({ error: 'Bursar user not found' });
    }
    
    const result = await prisma.$transaction(async function(tx) {
      const fee = await tx.fee.findUnique({
        where: { id: feeId }
      });
      
      if (!fee) {
        throw new Error('Fee not found');
      }
      
      const newPaidAmount = fee.paidAmount + parseFloat(amount);
      const newBalance = fee.totalAmount - newPaidAmount;
      
      let newStatus = fee.status;
      if (newBalance <= 0) {
        newStatus = 'PAID';
      } else if (newPaidAmount > 0) {
        newStatus = 'PARTIAL';
      }
      
      const payment = await tx.payment.create({
        data: {
          feeId,
          amount: parseFloat(amount),
          paymentMethod: method,
          referenceNo: reference,
          recordedById: bursarUser.id,
          status: 'COMPLETED'
        }
      });
      
      const updatedFee = await tx.fee.update({
        where: { id: feeId },
        data: {
          paidAmount: newPaidAmount,
          balance: newBalance,
          status: newStatus
        },
        include: {
          student: {
            include: {
              user: true
            }
          }
        }
      });
      
      return { payment, fee: updatedFee };
    });
    
    res.status(201).json({
      data: {
        id: result.payment.id,
        feeId: result.payment.feeId,
        amount: result.payment.amount,
        date: result.payment.paymentDate,
        method: result.payment.paymentMethod,
        reference: result.payment.referenceNo,
        recordedBy: result.payment.recordedBy ? {
          firstName: result.payment.recordedBy.name?.split(' ')[0] || '',
          lastName: result.payment.recordedBy.name?.split(' ').slice(1).join(' ') || ''
        } : null
      }
    });
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/fees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId, termId, totalAmount } = req.body;
    
    const fee = await prisma.fee.findUnique({
      where: { id }
    });
    
    if (!fee) {
      return res.status(404).json({ error: 'Fee not found' });
    }
    
    const updatedFee = await prisma.fee.update({
      where: { id },
      data: {
        studentId: studentId || fee.studentId,
        termId: termId || fee.termId,
        totalAmount: totalAmount ? parseFloat(totalAmount) : fee.totalAmount,
        balance: totalAmount ? (parseFloat(totalAmount) - fee.paidAmount) : fee.balance
      },
      include: {
        student: {
          include: {
            user: true
          }
        },
        term: {
          include: {
            session: true
          }
        }
      }
    });
    
    res.json({
      data: updatedFee
    });
  } catch (error) {
    console.error('Error updating fee:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/fees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🗑️ Deleting fee:', id);
    
    // Check if fee exists
    const fee = await prisma.fee.findUnique({
      where: { id },
      include: {
        payments: true,
        feeItems: true,
        discounts: true
      }
    });
    
    if (!fee) {
      return res.status(404).json({ 
        success: false,
        error: 'Fee not found' 
      });
    }
    
    // Delete related records first
    if (fee.payments.length > 0) {
      await prisma.payment.deleteMany({ where: { feeId: id } });
      console.log(`  ✅ Deleted ${fee.payments.length} payments`);
    }
    
    if (fee.feeItems.length > 0) {
      await prisma.feeItem.deleteMany({ where: { feeId: id } });
      console.log(`  ✅ Deleted ${fee.feeItems.length} fee items`);
    }
    
    if (fee.discounts.length > 0) {
      await prisma.discount.deleteMany({ where: { feeId: id } });
      console.log(`  ✅ Deleted ${fee.discounts.length} discounts`);
    }
    
    // Delete the fee
    await prisma.fee.delete({
      where: { id }
    });
    
    console.log('✅ Fee deleted successfully');
    
    res.json({ 
      success: true,
      message: 'Fee record deleted successfully',
      data: { id }
    });
    
  } catch (error) {
    console.error('❌ Error deleting fee:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete fee',
      details: error.message 
    });
  }
});

app.get('/api/fees/receipt/:feeId', async (req, res) => {
  try {
    const { feeId } = req.params;
    
    const fee = await prisma.fee.findUnique({
      where: { id: feeId },
      include: {
        student: {
          include: {
            user: true
          }
        },
        term: {
          include: {
            session: true
          }
        },
        payments: true
      }
    });
    
    if (!fee) {
      return res.status(404).json({ error: 'Fee not found' });
    }
    
    res.json({
      data: {
        receiptNo: `RCP-${Date.now()}`,
        fee,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error generating receipt:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/bursar/dashboard', async (req, res) => {
  try {
    const fees = await prisma.fee.findMany({
      include: {
        payments: true,
        term: {
          include: {
            session: true
          }
        }
      }
    });
    
    const totalExpected = fees.reduce(function(sum, fee) { return sum + fee.totalAmount; }, 0);
    const totalPaid = fees.reduce(function(sum, fee) { return sum + fee.paidAmount; }, 0);
    const outstanding = totalExpected - totalPaid;
    const collectionRate = totalExpected > 0 ? (totalPaid / totalExpected) * 100 : 0;
    
    const paidCount = fees.filter(function(f) { return f.status === 'PAID'; }).length;
    const pendingCount = fees.filter(function(f) { return f.status === 'PENDING'; }).length;
    const partialCount = fees.filter(function(f) { return f.status === 'PARTIAL'; }).length;
    const overdueCount = fees.filter(function(f) { return f.status === 'OVERDUE'; }).length;
    
    res.json({
      data: {
        summary: {
          totalExpected,
          totalPaid,
          outstanding,
          collectionRate: collectionRate.toFixed(1)
        },
        counts: {
          paid: paidCount,
          pending: pendingCount,
          partial: partialCount,
          overdue: overdueCount,
          total: fees.length
        }
      }
    });
  } catch (error) {
    console.error('Error fetching bursar dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== DASHBOARD ENDPOINTS ====================
app.get('/api/dashboard/principal', async (req, res) => {
  try {
    const totalStudents = await prisma.student.count();
    const totalTeachers = await prisma.teacher.count();
    const totalParents = await prisma.parent.count();
    const totalClasses = await prisma.class.count();
    
    const recentStudents = await prisma.student.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        user: true,
        class: true
      }
    });
    
    const recentParents = await prisma.parent.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        },
        students: {
          take: 3,
          include: {
            user: true,
            class: true
          }
        }
      }
    });
    
    const fees = await prisma.fee.findMany();
    const totalExpected = fees.reduce((sum, fee) => sum + fee.totalAmount, 0);
    const totalCollected = fees.reduce((sum, fee) => sum + fee.paidAmount, 0);
    const collectionRate = totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayAttendance = await prisma.attendance.count({
      where: {
        date: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        }
      }
    });
    
    const formattedParents = recentParents.map(parent => ({
      id: parent.id,
      name: parent.user?.name || 'Unknown',
      email: parent.user?.email || '',
      childrenCount: parent.students.length,
      children: parent.students.map(s => ({
        id: s.id,
        name: s.user?.name,
        admissionNo: s.admissionNo,
        className: s.class?.name
      }))
    }));
    
    res.json({
      data: {
        stats: {
          totalStudents,
          totalTeachers,
          totalParents,
          totalClasses,
          totalExpected,
          totalCollected,
          collectionRate: Math.round(collectionRate),
          todayAttendance
        },
        recentStudents: recentStudents.map(s => ({
          id: s.id,
          name: s.user?.name,
          admissionNo: s.admissionNo,
          className: s.class?.name,
          createdAt: s.createdAt
        })),
        recentParents: formattedParents
      }
    });
  } catch (error) {
    console.error('Error fetching principal dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/dashboard/admin', async (req, res) => {
  try {
    const totalStudents = await prisma.student.count();
    const totalTeachers = await prisma.teacher.count();
    const totalParents = await prisma.parent.count();
    const totalClasses = await prisma.class.count();
    const totalSubjects = await prisma.subject.count();
    
    const recentUsers = await prisma.user.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });
    
    const parents = await prisma.parent.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        },
        students: {
          include: {
            user: true,
            class: true
          }
        }
      }
    });
    
    const fees = await prisma.fee.findMany();
    const totalExpected = fees.reduce((sum, fee) => sum + fee.totalAmount, 0);
    const totalCollected = fees.reduce((sum, fee) => sum + fee.paidAmount, 0);
    
    const classDistribution = await prisma.class.findMany({
      include: {
        _count: {
          select: { students: true }
        }
      }
    });
    
    const formattedParents = parents.map(parent => ({
      id: parent.id,
      name: parent.user?.name || 'Unknown',
      email: parent.user?.email || '',
      childrenCount: parent.students.length,
      children: parent.students.map(s => ({
        id: s.id,
        name: s.user?.name,
        admissionNo: s.admissionNo,
        className: s.class?.name
      }))
    }));
    
    res.json({
      data: {
        stats: {
          totalStudents,
          totalTeachers,
          totalParents,
          totalClasses,
          totalSubjects,
          totalExpected,
          totalCollected,
          outstanding: totalExpected - totalCollected
        },
        recentUsers,
        classDistribution: classDistribution.map(c => ({
          name: c.name,
          studentCount: c._count.students
        })),
        recentParents: formattedParents
      }
    });
  } catch (error) {
    console.error('Error fetching admin dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/dashboard/bursar', async (req, res) => {
  try {
    const fees = await prisma.fee.findMany({
      include: {
        payments: true,
        student: {
          include: {
            user: true
          }
        },
        term: {
          include: {
            session: true
          }
        }
      }
    });
    
    const totalExpected = fees.reduce((sum, fee) => sum + fee.totalAmount, 0);
    const totalPaid = fees.reduce((sum, fee) => sum + fee.paidAmount, 0);
    const outstanding = totalExpected - totalPaid;
    const collectionRate = totalExpected > 0 ? (totalPaid / totalExpected) * 100 : 0;
    
    const payments = await prisma.payment.findMany();
    const paymentMethods = {};
    payments.forEach(p => {
      paymentMethods[p.paymentMethod] = (paymentMethods[p.paymentMethod] || 0) + p.amount;
    });
    
    const recentPayments = await prisma.payment.findMany({
      take: 5,
      orderBy: { paymentDate: 'desc' },
      include: {
        fee: {
          include: {
            student: {
              include: {
                user: true
              }
            },
            term: {
              include: {
                session: true
              }
            }
          }
        },
        recordedBy: true
      }
    });
    
    const paidCount = fees.filter(f => f.status === 'PAID').length;
    const pendingCount = fees.filter(f => f.status === 'PENDING').length;
    const partialCount = fees.filter(f => f.status === 'PARTIAL').length;
    const overdueCount = fees.filter(f => f.status === 'OVERDUE').length;
    
    res.json({
      data: {
        summary: {
          totalExpected,
          totalPaid,
          outstanding,
          collectionRate: collectionRate.toFixed(1),
          totalFees: fees.length
        },
        breakdown: {
          paid: paidCount,
          pending: pendingCount,
          partial: partialCount,
          overdue: overdueCount
        },
        paymentMethods,
        recentPayments: recentPayments.map(p => ({
          id: p.id,
          amount: p.amount,
          method: p.paymentMethod,
          date: p.paymentDate,
          studentName: p.fee?.student?.user?.name || 'Unknown',
          recordedBy: p.recordedBy?.name || 'System'
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching bursar dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

// Teacher Dashboard - FIXED VERSION
app.get('/api/dashboard/teacher', async (req, res) => {
  try {
    console.log('🔍 Fetching teacher dashboard...');
    
    const authHeader = req.headers.authorization;
    let userId = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = Buffer.from(token, 'base64').toString();
      userId = decoded.split(':')[0];
      console.log('👤 User ID from token:', userId);
    }
    
    let teacher;
    if (userId) {
      teacher = await prisma.teacher.findFirst({
        where: { userId: userId },
        include: {
          user: true,
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
    }
    
    if (!teacher) {
      teacher = await prisma.teacher.findFirst({
        include: {
          user: true,
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
    }

    if (!teacher) {
      console.log('⚠️ No teacher profile found');
      return res.json({
        data: {
          teacher: { name: "No Teacher Found", subjects: [], classes: [] },
          stats: { totalStudents: 0, totalClasses: 0, totalSubjects: 0, todayAttendance: 0 },
          recentGrades: [],
          students: []
        }
      });
    }

    console.log('👨‍🏫 Teacher found:', teacher.user?.name);
    console.log('📚 Teacher subjects count:', teacher.subjects?.length);
    console.log('📚 Teacher classes count:', teacher.classes?.length);

    // Get teacher's assigned classes
    const teacherClasses = teacher.classes || [];
    const classIds = teacherClasses.map(c => c.id);
    
    // Get students from those classes
    let students = [];
    if (classIds.length > 0) {
      students = await prisma.student.findMany({
        where: { classId: { in: classIds } },
        include: { 
          user: true, 
          class: true 
        },
        orderBy: { user: { name: 'asc' } }
      });
      console.log(`👨‍🎓 Found ${students.length} students from ${teacherClasses.length} classes`);
    } else {
      console.log('⚠️ Teacher has no assigned classes');
    }
    
    // FORMAT SUBJECTS WITH THEIR CLASSES - FIXED
    const formattedSubjects = [];
    const subjectMap = new Map(); // To avoid duplicates
    
    for (const subject of teacher.subjects) {
      // Get the class info for this subject
      if (subject.classes && subject.classes.length > 0) {
        for (const subjectClass of subject.classes) {
          const className = subjectClass.class?.name;
          const classId = subjectClass.classId;
          
          if (className) {
            const key = `${subject.id}-${classId}`;
            if (!subjectMap.has(key)) {
              subjectMap.set(key, true);
              formattedSubjects.push({
                id: subject.id,
                name: subject.name,
                className: className,
                classId: classId,
                subjectCode: subject.code || subject.name.substring(0, 3).toUpperCase()
              });
            }
          }
        }
      } else {
        // If subject has no class association, add it without class
        formattedSubjects.push({
          id: subject.id,
          name: subject.name,
          className: null,
          classId: null,
          subjectCode: subject.code || subject.name.substring(0, 3).toUpperCase()
        });
      }
    }
    
    console.log('📖 Formatted subjects:', formattedSubjects.map(s => `${s.name} -> ${s.className || 'No Class'}`));
    
    // Get today's attendance count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayAttendance = await prisma.attendance.count({
      where: {
        classId: { in: classIds.length > 0 ? classIds : [] },
        date: { gte: today, lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
      }
    });
    
    // Get recent grades
    let recentGrades = [];
    if (teacher.subjects.length > 0 && students.length > 0) {
      const subjectIds = teacher.subjects.map(s => s.id);
      const studentIds = students.map(s => s.id);
      
      recentGrades = await prisma.grade.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
        where: {
          AND: [
            { subjectId: { in: subjectIds } },
            { studentId: { in: studentIds } }
          ]
        },
        include: {
          student: { include: { user: true } },
          subject: true
        }
      });
      console.log(`📊 Found ${recentGrades.length} recent grades`);
    }
    
    // Format students for response
    const formattedStudents = students.map(student => ({
      id: student.id,
      name: student.user?.name || 'Unknown',
      firstName: student.user?.name?.split(' ')[0] || '',
      lastName: student.user?.name?.split(' ').slice(1).join(' ') || '',
      admissionNo: student.admissionNo || 'N/A',
      className: student.class?.name || 'No Class',
      classId: student.classId
    }));
    
    // Format grades for response
    const formattedGrades = recentGrades.map(grade => ({
      id: grade.id,
      studentName: grade.student?.user?.name || 'Unknown',
      subjectName: grade.subject?.name || 'Unknown',
      score: grade.score,
      type: grade.type,
      createdAt: grade.createdAt
    }));
    
    // Format classes for response
    const formattedClasses = teacherClasses.map(cls => ({
      id: cls.id,
      name: cls.name
    }));
    
    const responseData = {
      data: {
        teacher: {
          id: teacher.id,
          name: teacher.user?.name || 'Teacher',
          subjects: formattedSubjects,
          classes: formattedClasses
        },
        stats: {
          totalStudents: students.length,
          totalClasses: teacherClasses.length,
          totalSubjects: formattedSubjects.length,
          todayAttendance: todayAttendance
        },
        recentGrades: formattedGrades,
        students: formattedStudents
      }
    };
    
    console.log('✅ Dashboard data prepared:', {
      teacherName: responseData.data.teacher.name,
      studentsCount: responseData.data.stats.totalStudents,
      classesCount: responseData.data.stats.totalClasses,
      subjectsCount: responseData.data.stats.totalSubjects,
      subjects: responseData.data.teacher.subjects.map(s => `${s.name} (${s.className || 'No Class'})`)
    });
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Error fetching teacher dashboard:', error);
    res.status(500).json({ 
      error: 'Failed to fetch teacher dashboard',
      details: error.message 
    });
  }
});

// app.get('/api/dashboard/parent', async (req, res) => {
//   try {
//     const parentUser = await prisma.user.findFirst({
//       where: { role: 'PARENT' }
//     });
    
//     if (!parentUser) {
//       return res.json({
//         data: {
//           message: 'No parent profile found',
//           parent: { name: '', email: '' },
//           students: [],
//           totalOutstanding: 0,
//           totalExpected: 0,
//           totalPaid: 0
//         }
//       });
//     }
    
//     const parent = await prisma.parent.findUnique({
//       where: { userId: parentUser.id },
//       include: {
//         user: true,
//         students: {
//           include: {
//             user: true,
//             class: true,
//             fees: {
//               include: {
//                 payments: true,
//                 term: {
//                   include: {
//                     session: true
//                   }
//                 },
//                 feeItems: true
//               },
//               orderBy: { createdAt: 'desc' }
//             },
//             attendances: {
//               take: 5,
//               orderBy: { date: 'desc' }
//             },
//             grades: {
//               include: {
//                 subject: true
//               },
//               take: 10,
//               orderBy: { createdAt: 'desc' }
//             }
//           }
//         }
//       }
//     });
    
//     if (!parent) {
//       return res.json({
//         data: {
//           message: 'Parent profile not found',
//           parent: { name: '', email: '' },
//           students: [],
//           totalOutstanding: 0,
//           totalExpected: 0,
//           totalPaid: 0
//         }
//       });
//     }
    
//     let totalOutstanding = 0;
//     let totalExpected = 0;
//     let totalPaid = 0;
    
//     const transformedStudents = parent.students.map(student => {
//       let studentTotalFees = 0;
//       let studentTotalPaid = 0;
//       let studentTotalOutstanding = 0;
      
//       student.fees.forEach(fee => {
//         studentTotalFees += fee.totalAmount;
//         studentTotalPaid += fee.paidAmount;
//         studentTotalOutstanding += fee.balance;
//       });
      
//       totalExpected += studentTotalFees;
//       totalPaid += studentTotalPaid;
//       totalOutstanding += studentTotalOutstanding;
      
//       const recentPayments = student.fees.flatMap(fee => 
//         fee.payments.map(payment => ({
//           id: payment.id,
//           amount: payment.amount,
//           date: payment.paymentDate,
//           method: payment.paymentMethod,
//           term: fee.term?.name,
//           session: fee.term?.session?.name
//         }))
//       ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
      
//       return {
//         id: student.id,
//         name: student.user?.name || 'Unknown',
//         admissionNo: student.admissionNo || 'N/A',
//         className: student.class?.name || 'No Class',
//         feeSummary: {
//           totalFees: studentTotalFees,
//           totalPaid: studentTotalPaid,
//           totalOutstanding: studentTotalOutstanding,
//           paymentProgress: studentTotalFees > 0 ? (studentTotalPaid / studentTotalFees) * 100 : 0
//         },
//         recentPayments,
//         recentAttendance: student.attendances.map(a => ({
//           date: a.date,
//           status: a.status
//         })),
//         recentGrades: student.grades.map(g => ({
//           id: g.id,
//           subjectName: g.subject?.name,
//           score: g.score,
//           type: g.type,
//           createdAt: g.createdAt
//         }))
//       };
//     });
    
//     res.json({
//       data: {
//         parent: {
//           name: parent.user?.name,
//           email: parent.user?.email
//         },
//         students: transformedStudents,
//         totalOutstanding,
//         totalExpected,
//         totalPaid
//       }
//     });
//   } catch (error) {
//     console.error('Error fetching parent dashboard:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

app.get('/api/dashboard/student', async (req, res) => {
  try {
    const student = await prisma.student.findFirst({
      include: {
        user: true,
        class: true,
        attendances: {
          orderBy: { date: 'desc' },
          take: 10
        },
        grades: {
          include: {
            subject: true
          },
          orderBy: { createdAt: 'desc' }
        },
        fees: {
          include: {
            payments: true,
            term: {
              include: {
                session: true
              }
            }
          }
        }
      }
    });
    
    if (!student) {
      return res.json({
        data: {
          message: 'No student profile found'
        }
      });
    }
    
    const totalAttendanceDays = student.attendances.length;
    const presentDays = student.attendances.filter(a => a.status === 'PRESENT').length;
    const attendancePercentage = totalAttendanceDays > 0 ? (presentDays / totalAttendanceDays) * 100 : 0;
    
    const grades = student.grades;
    const averageGrade = grades.length > 0 
      ? grades.reduce((sum, g) => sum + g.score, 0) / grades.length 
      : 0;
    
    const totalFees = student.fees.reduce((sum, f) => sum + f.totalAmount, 0);
    const paidFees = student.fees.reduce((sum, f) => sum + f.paidAmount, 0);
    const outstandingFees = totalFees - paidFees;
    
    res.json({
      data: {
        student: {
          id: student.id,
          name: student.user?.name,
          admissionNo: student.admissionNo,
          className: student.class?.name
        },
        stats: {
          totalAttendanceDays,
          presentDays,
          attendancePercentage: Math.round(attendancePercentage),
          averageGrade: Math.round(averageGrade * 10) / 10,
          totalFees,
          paidFees,
          outstandingFees
        },
        recentAttendances: student.attendances.map(a => ({
          date: a.date,
          status: a.status
        })),
        grades: student.grades.map(g => ({
          id: g.id,
          subjectName: g.subject?.name,
          score: g.score,
          type: g.type,
          createdAt: g.createdAt
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching student dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});


// ==================== PARENT PROFILE MANAGEMENT ====================

// Create parent profile for logged-in user
app.post('/api/parents/create-profile', async (req, res) => {
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

    console.log('🔍 Creating parent profile for user ID:', userId);

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user role to PARENT if not already
    if (user.role !== 'PARENT') {
      await prisma.user.update({
        where: { id: userId },
        data: { role: 'PARENT' }
      });
      console.log('✅ Updated user role to PARENT');
    }

    // Check if parent profile already exists
    const existingParent = await prisma.parent.findUnique({
      where: { userId: userId },
      include: { user: true }
    });

    if (existingParent) {
      console.log('✅ Parent profile already exists');
      return res.json({ 
        success: true, 
        message: 'Parent profile already exists', 
        parent: existingParent 
      });
    }

    // Create parent profile
    const parent = await prisma.parent.create({
      data: { userId: userId },
      include: { user: true }
    });

    console.log(`✅ Created parent profile for: ${parent.user?.name} (${parent.user?.email})`);

    res.json({ 
      success: true, 
      message: 'Parent profile created successfully', 
      parent: parent 
    });

  } catch (error) {
    console.error('Error creating parent profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get current parent profile
app.get('/api/parents/me', async (req, res) => {
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

    console.log('🔍 Fetching parent profile for user ID:', userId);

    // First check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has parent role
    if (user.role !== 'PARENT') {
      return res.status(403).json({ error: 'User is not a parent' });
    }

    // Find parent profile
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
      console.log('❌ Parent profile not found for user ID:', userId);
      return res.status(404).json({ 
        error: 'Parent profile not found',
        message: 'Please create a parent profile first'
      });
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

// DELETE ALL NON-ADMIN USERS (Admin only)
// app.delete('/api/admin/delete-all-users', async (req, res) => {
//   try {
//     const authHeader = req.headers.authorization;
//     let userId = null;

//     if (authHeader && authHeader.startsWith('Bearer ')) {
//       const token = authHeader.split(' ')[1];
//       const decoded = Buffer.from(token, 'base64').toString();
//       userId = decoded.split(':')[0];
//     }

//     if (!userId) {
//       return res.status(401).json({ error: 'Unauthorized' });
//     }

//     // Verify admin access
//     const admin = await prisma.user.findUnique({
//       where: { id: userId }
//     });

//     if (admin?.email !== 'admin@school.com') {
//       return res.status(403).json({ error: 'Admin access required' });
//     }

//     // Get count of users to delete
//     const usersToDelete = await prisma.user.findMany({
//       where: { email: { not: 'admin@school.com' } },
//       select: { id: true, email: true, name: true, role: true }
//     });

//     if (usersToDelete.length === 0) {
//       return res.json({ message: 'No non-admin users to delete' });
//     }

//     console.log(`⚠️ Deleting ${usersToDelete.length} non-admin users...`);

//     // Delete in correct order
//     await prisma.$transaction([
//       prisma.payment.deleteMany({
//         where: { recordedBy: { email: { not: 'admin@school.com' } } }
//       }),
//       prisma.discount.deleteMany({
//         where: { approvedBy: { email: { not: 'admin@school.com' } } }
//       }),
//       prisma.grade.deleteMany({
//         where: { student: { user: { email: { not: 'admin@school.com' } } } }
//       }),
//       prisma.attendance.deleteMany({
//         where: { student: { user: { email: { not: 'admin@school.com' } } } }
//       }),
//       prisma.fee.deleteMany({
//         where: { student: { user: { email: { not: 'admin@school.com' } } } }
//       }),
//       prisma.student.deleteMany({
//         where: { user: { email: { not: 'admin@school.com' } } }
//       }),
//       prisma.teacher.deleteMany({
//         where: { user: { email: { not: 'admin@school.com' } } }
//       }),
//       prisma.parent.deleteMany({
//         where: { user: { email: { not: 'admin@school.com' } } }
//       }),
//       prisma.user.deleteMany({
//         where: { email: { not: 'admin@school.com' } }
//       })
//     ]);

//     res.json({
//       success: true,
//       message: `Deleted ${usersToDelete.length} non-admin users`,
//       deletedUsers: usersToDelete.map(u => ({ email: u.email, role: u.role }))
//     });

//   } catch (error) {
//     console.error('Error deleting users:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// ==================== CLASS TEACHER ATTENDANCE ENDPOINTS ====================

// Get class teacher's class attendance for a specific date
app.get('/api/class-teacher/attendance', async (req, res) => {
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

    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Get teacher with their homeroom class
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
                user: { name: 'asc' }
              }
            }
          }
        }
      }
    });

    if (!teacher || !teacher.classTaught) {
      return res.status(404).json({ error: 'No class assigned to this teacher' });
    }

    // Get existing attendance for this date
    const existingAttendance = await prisma.attendance.findMany({
      where: {
        classId: teacher.classTaught.id,
        date: {
          gte: targetDate,
          lt: nextDay
        }
      }
    });

    const attendanceMap = {};
    existingAttendance.forEach(a => {
      attendanceMap[a.studentId] = a.status;
    });

    // Prepare attendance sheet
    const attendanceSheet = teacher.classTaught.students.map(student => ({
      studentId: student.id,
      studentName: student.user?.name,
      admissionNo: student.admissionNo,
      status: attendanceMap[student.id] || 'PRESENT'
    }));

    res.json({
      success: true,
      data: {
        classId: teacher.classTaught.id,
        className: teacher.classTaught.name,
        date: targetDate,
        students: attendanceSheet
      }
    });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save/Update bulk attendance
app.post('/api/class-teacher/attendance/bulk', async (req, res) => {
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

    const { date, attendances, classId } = req.body;

    // Verify teacher has access to this class
    const teacher = await prisma.teacher.findFirst({
      where: { userId, classTaughtId: classId }
    });

    if (!teacher) {
      return res.status(403).json({ error: 'You are not the class teacher for this class' });
    }

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    // Use transaction for bulk upsert
    const results = await prisma.$transaction(
      attendances.map(att =>
        prisma.attendance.upsert({
          where: {
            studentId_date: {
              studentId: att.studentId,
              date: targetDate
            }
          },
          update: { status: att.status },
          create: {
            date: targetDate,
            status: att.status,
            studentId: att.studentId,
            classId: classId
          }
        })
      )
    );

    res.json({
      success: true,
      message: `Attendance recorded for ${results.length} students`,
      data: results
    });
  } catch (error) {
    console.error('Error saving attendance:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== CLASS TEACHER REPORT CARD COMMENTS ====================

// Get comments for a student in a specific term
app.get('/api/class-teacher/comments/:studentId', async (req, res) => {
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
    const { termId } = req.query;

    // Verify teacher is class teacher of this student
    const teacher = await prisma.teacher.findFirst({
      where: { userId },
      include: {
        classTaught: {
          include: {
            students: {
              where: { id: studentId }
            }
          }
        }
      }
    });

    if (!teacher || !teacher.classTaught || teacher.classTaught.students.length === 0) {
      return res.status(403).json({ error: 'You do not have access to this student' });
    }

    const whereClause = { studentId };
    if (termId) whereClause.termId = termId;

    const comments = await prisma.classTeacherComment.findMany({
      where: whereClause,
      include: {
        term: {
          include: { session: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: comments });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save/Update comment for a student
app.post('/api/class-teacher/comments', async (req, res) => {
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

    const { studentId, termId, comment, type } = req.body;

    if (!studentId || !termId || !comment) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify teacher is class teacher of this student
    const teacher = await prisma.teacher.findFirst({
      where: { userId },
      include: {
        classTaught: {
          include: {
            students: {
              where: { id: studentId }
            }
          }
        }
      }
    });

    if (!teacher || !teacher.classTaught || teacher.classTaught.students.length === 0) {
      return res.status(403).json({ error: 'You do not have access to this student' });
    }

    const savedComment = await prisma.classTeacherComment.upsert({
      where: {
        studentId_termId_type: {
          studentId,
          termId,
          type: type || 'GENERAL'
        }
      },
      update: { comment, updatedAt: new Date() },
      create: {
        studentId,
        termId,
        comment,
        type: type || 'GENERAL'
      }
    });

    res.json({
      success: true,
      message: 'Comment saved successfully',
      data: savedComment
    });
  } catch (error) {
    console.error('Error saving comment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all students with their performance summary for class teacher
app.get('/api/class-teacher/students-performance', async (req, res) => {
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

    const { termId } = req.query;

    // Get teacher with their homeroom class
    const teacher = await prisma.teacher.findFirst({
      where: { userId },
      include: {
        classTaught: {
          include: {
            students: {
              include: {
                user: true,
                grades: {
                  where: termId ? { termId } : {},
                  include: { subject: true }
                },
                attendances: true
              },
              orderBy: {
                user: { name: 'asc' }
              }
            }
          }
        }
      }
    });

    if (!teacher || !teacher.classTaught) {
      return res.status(404).json({ error: 'No class assigned to this teacher' });
    }

    // Calculate performance for each student
    const studentsPerformance = teacher.classTaught.students.map(student => {
      const grades = student.grades;
      const totalScore = grades.reduce((sum, g) => sum + (g.percentage || g.score), 0);
      const averageScore = grades.length > 0 ? totalScore / grades.length : 0;
      
      const attendances = student.attendances;
      const presentCount = attendances.filter(a => a.status === 'PRESENT').length;
      const attendanceRate = attendances.length > 0 ? (presentCount / attendances.length) * 100 : 0;

      // Get grade letter
      let gradeLetter = 'F';
      if (averageScore >= 70) gradeLetter = 'A';
      else if (averageScore >= 60) gradeLetter = 'B';
      else if (averageScore >= 50) gradeLetter = 'C';
      else if (averageScore >= 45) gradeLetter = 'D';
      else if (averageScore >= 40) gradeLetter = 'E';

      return {
        id: student.id,
        name: student.user?.name,
        admissionNo: student.admissionNo,
        averageScore: averageScore.toFixed(1),
        gradeLetter,
        attendanceRate: attendanceRate.toFixed(1),
        subjects: grades.map(g => ({
          name: g.subject?.name,
          score: g.score,
          percentage: g.percentage,
          gradeLetter: g.gradeLetter
        }))
      };
    });

    res.json({
      success: true,
      data: {
        className: teacher.classTaught.name,
        classId: teacher.classTaught.id,
        totalStudents: studentsPerformance.length,
        students: studentsPerformance
      }
    });
  } catch (error) {
    console.error('Error fetching students performance:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get attendance history for class teacher's class
app.get('/api/class-teacher/attendance-history', async (req, res) => {
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

    const { startDate, endDate, month, year } = req.query;

    // Get teacher with their homeroom class
    const teacher = await prisma.teacher.findFirst({
      where: { userId },
      include: {
        classTaught: {
          include: {
            students: {
              include: {
                user: true
              }
            }
          }
        }
      }
    });

    if (!teacher || !teacher.classTaught) {
      return res.status(404).json({ error: 'No class assigned to this teacher' });
    }

    // Build date filter
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    } else if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);
      dateFilter = {
        gte: start,
        lte: end
      };
    } else {
      // Default to current month
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      dateFilter = {
        gte: start,
        lte: end
      };
    }

    // Get all attendance records for this class
    const attendances = await prisma.attendance.findMany({
      where: {
        classId: teacher.classTaught.id,
        date: dateFilter
      },
      include: {
        student: {
          include: {
            user: true
          }
        }
      },
      orderBy: [
        { date: 'desc' },
        { student: { user: { name: 'asc' } } }
      ]
    });

    // Group attendance by date
    const attendanceByDate = {};
    attendances.forEach(att => {
      const dateKey = att.date.toISOString().split('T')[0];
      if (!attendanceByDate[dateKey]) {
        attendanceByDate[dateKey] = {
          date: dateKey,
          records: []
        };
      }
      attendanceByDate[dateKey].records.push({
        studentId: att.studentId,
        studentName: att.student.user?.name,
        admissionNo: att.student.admissionNo,
        status: att.status
      });
    });

    // Calculate summary statistics
    const totalStudents = teacher.classTaught.students.length;
    const summary = {
      totalDays: Object.keys(attendanceByDate).length,
      averageAttendance: 0,
      studentStats: {}
    };

    // Calculate per-student attendance statistics
    teacher.classTaught.students.forEach(student => {
      const studentAttendances = attendances.filter(a => a.studentId === student.id);
      const presentCount = studentAttendances.filter(a => a.status === 'PRESENT').length;
      const absentCount = studentAttendances.filter(a => a.status === 'ABSENT').length;
      const lateCount = studentAttendances.filter(a => a.status === 'LATE').length;
      const attendanceRate = studentAttendances.length > 0 
        ? (presentCount / studentAttendances.length) * 100 
        : 0;

      summary.studentStats[student.id] = {
        name: student.user?.name,
        admissionNo: student.admissionNo,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        totalDays: studentAttendances.length,
        attendanceRate: attendanceRate.toFixed(1)
      };
    });

    // Calculate overall average attendance
    const totalAttendanceRate = Object.values(summary.studentStats).reduce((sum, s) => 
      sum + parseFloat(s.attendanceRate), 0);
    summary.averageAttendance = totalStudents > 0 
      ? (totalAttendanceRate / totalStudents).toFixed(1) 
      : 0;

    res.json({
      success: true,
      data: {
        className: teacher.classTaught.name,
        classId: teacher.classTaught.id,
        totalStudents,
        summary,
        attendanceByDate: Object.values(attendanceByDate).sort((a, b) => b.date.localeCompare(a.date)),
        monthlySummary: await getMonthlyAttendanceSummary(teacher.classTaught.id)
      }
    });
  } catch (error) {
    console.error('Error fetching attendance history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to get monthly attendance summary
async function getMonthlyAttendanceSummary(classId) {
  const monthlyData = [];
  const now = new Date();
  
  for (let i = 0; i < 6; i++) {
    const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    
    const attendances = await prisma.attendance.findMany({
      where: {
        classId,
        date: {
          gte: monthStart,
          lte: monthEnd
        }
      },
      include: {
        student: true
      }
    });
    
    const uniqueDays = [...new Set(attendances.map(a => a.date.toISOString().split('T')[0]))];
    const totalPresent = attendances.filter(a => a.status === 'PRESENT').length;
    const totalLate = attendances.filter(a => a.status === 'LATE').length;
    const totalAbsent = attendances.filter(a => a.status === 'ABSENT').length;
    const totalRecords = attendances.length;
    
    monthlyData.push({
      month: month.toLocaleString('default', { month: 'long', year: 'numeric' }),
      monthIndex: month.getMonth(),
      year: month.getFullYear(),
      days: uniqueDays.length,
      present: totalPresent,
      late: totalLate,
      absent: totalAbsent,
      total: totalRecords,
      attendanceRate: totalRecords > 0 ? ((totalPresent / totalRecords) * 100).toFixed(1) : 0
    });
  }
  
  return monthlyData;
}

// ==================== MIGRATION ENDPOINT ====================
// Migration endpoint - Fixed SQL syntax
app.post('/api/migrate', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let userId = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = Buffer.from(token, 'base64').toString();
      userId = decoded.split(':')[0];
    }

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    const admin = await prisma.user.findUnique({ 
      where: { id: userId },
      select: { id: true, email: true, role: true }
    });

    console.log('Migration attempt by:', admin?.email, 'Role:', admin?.role);

    if (admin?.role !== 'ADMIN' && admin?.role !== 'PRINCIPAL') {
      return res.status(403).json({ error: 'Admin or Principal access required' });
    }

    console.log('🚀 Running migration...');

    // Create enum
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        CREATE TYPE "CommentType" AS ENUM ('GENERAL', 'STRENGTH', 'WEAKNESS', 'TEACHER_RECOMMENDATION', 'PRINCIPAL_REMARK');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('✅ CommentType enum created');

    // Create table
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

    // Add unique constraint (PostgreSQL doesn't support IF NOT EXISTS for constraints)
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "ClassTeacherComment" ADD CONSTRAINT "ClassTeacherComment_studentId_termId_type_key" UNIQUE ("studentId", "termId", "type");
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('✅ Unique constraint added');

    // Add foreign key constraints
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "ClassTeacherComment" ADD CONSTRAINT "ClassTeacherComment_studentId_fkey" 
          FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('✅ Student FK added');

    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "ClassTeacherComment" ADD CONSTRAINT "ClassTeacherComment_termId_fkey" 
          FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('✅ Term FK added');

    console.log('🎉 Migration completed successfully!');

    res.json({ 
      success: true, 
      message: 'Migration completed successfully!',
      adminEmail: admin?.email,
      adminRole: admin?.role
    });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ error: error.message });
  }
});




// ==================== SENTRY ERROR HANDLING ====================
// This must be after ALL your routes
const Sentry = require("@sentry/node");
Sentry.setupExpressErrorHandler(app);

// Optional fallthrough error handler
app.use(function onError(err, req, res, next) {
  console.error('❌ Error:', err.message);
  res.statusCode = 500;
  res.json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message,
    errorId: res.sentry 
  });
});

// ==================== STATIC FILE SERVING (FRONTEND) ====================
// Serve frontend static files - MUST be AFTER API routes (so API routes take precedence)
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
  console.log(`     GET    /api/class-teacher/attendance-history (date range/monthly)`);
  console.log(`     GET    /api/class-teacher/attendance (by date)`);
  console.log(`     POST   /api/class-teacher/attendance/bulk (save attendance)`);
  console.log(`     GET    /api/class-teacher/comments/:studentId (report card comments)`);
  console.log(`     POST   /api/class-teacher/comments (save comment)`);
  console.log(`     GET    /api/class-teacher/students-performance (performance summary)`);
  console.log(`     POST   /api/migrate (create ClassTeacherComment table - admin only)`);
  console.log(`     GET    /api/class-teacher/attendance-history (date range/monthly)`);
  console.log(`     GET    /api/class-teacher/attendance (by date)`);
  console.log(`     POST   /api/class-teacher/attendance/bulk (save attendance)`);
  console.log(`     GET    /api/class-teacher/comments/:studentId (report card comments)`);
  console.log(`     POST   /api/class-teacher/comments (save comment)`);
  console.log(`     GET    /api/class-teacher/students-performance (performance summary)`);
  console.log(`     GET    /api/class-teacher/attendance (by date)`);
  console.log(`     POST   /api/class-teacher/attendance/bulk (save attendance)`);
  console.log(`     GET    /api/class-teacher/comments/:studentId (report card comments)`);
  console.log(`     POST   /api/class-teacher/comments (save comment)`);
  console.log(`     GET    /api/class-teacher/students-performance (performance summary)`);
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