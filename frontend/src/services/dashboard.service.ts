// // dashboard.service.ts
// import api from './api';

// export const dashboardService = {
//   getTeacherDashboard: async () => {
//     const response = await api.get('/dashboard/teacher');
//     return response.data.data;
//   },

//   getPrincipalDashboard: async () => {
//     const response = await api.get('/dashboard/principal');
//     return response.data.data;
//   },

//   getAdminDashboard: async () => {
//     const response = await api.get('/dashboard/admin');
//     return response.data.data;
//   },

//   getBursarDashboard: async () => {
//     const response = await api.get('/dashboard/bursar');
//     return response.data.data;
//   },

//   getParentDashboard: async () => {
//     const response = await api.get('/dashboard/parent');
//     return response.data.data;
//   },

//   getStudentDashboard: async () => {
//     const response = await api.get('/dashboard/student');
//     return response.data.data;
//   },

//   submitGrade: async (gradeData: any) => {
//     const response = await api.post('/grades', gradeData);
//     return response.data;
//   },

//   deleteGrade: async (gradeId: string) => {
//     const response = await api.delete(`/grades/${gradeId}`);
//     return response.data;
//   },

//   bulkDeleteGrades: async (gradeIds: string[]) => {
//     const response = await api.post('/grades/bulk-delete', { gradeIds });
//     return response.data;
//   },

//   submitAttendance: async (attendanceData: any) => {
//     const response = await api.post('/attendance/bulk', attendanceData);
//     return response.data;
//   },

//   getAttendanceByClass: async (classId: string, date: string) => {
//     const response = await api.get(`/attendance/class/${classId}?date=${date}`);
//     return response.data;
//   },

//   getGradesByTeacher: async (teacherId: string, termId?: string, sessionId?: string) => {
//     const params: any = {};
//     if (teacherId) params.teacherId = teacherId;
//     if (termId) params.termId = termId;
//     if (sessionId) params.sessionId = sessionId;
//     const response = await api.get('/grades/filter', { params });
//     return response.data;
//   },

//   getTeacherStudents: async (teacherId: string) => {
//     const response = await api.get(`/teachers/${teacherId}/students`);
//     return response.data;
//   },

//   getGradesByStudent: async (studentId: string, termId?: string, sessionId?: string) => {
//     const params: any = { studentId };
//     if (termId) params.termId = termId;
//     if (sessionId) params.sessionId = sessionId;
//     const response = await api.get('/grades/filter', { params });
//     return response.data;
//   },

//   getParentChildren: async () => {
//     const response = await api.get('/parents/children');
//     return response.data;
//   },

//   // ==================== CLASS TEACHER METHODS ====================
  
//   // Get class teacher dashboard
//   getClassTeacherDashboard: async () => {
//     const response = await api.get('/dashboard/class-teacher');
//     return response.data.data;
//   },

//   // Get students in class teacher's class
//   getClassTeacherStudents: async () => {
//     const response = await api.get('/class-teacher/students');
//     return response.data.data;
//   },

//   // Get class teacher's attendance summary
//   getClassTeacherAttendanceSummary: async () => {
//     const response = await api.get('/class-teacher/attendance-summary');
//     return response.data.data;
//   },

//   // Get available teachers for class teacher assignment
//   getAvailableTeachers: async () => {
//     try {
//       console.log('📡 Fetching available teachers...');
//       const response = await api.get('/teachers/available');
//       console.log('✅ Available teachers response:', response.data);
//       return response.data.data || [];
//     } catch (error: any) {
//       console.error('❌ Error fetching available teachers:', error);
//       // Fallback to regular teachers endpoint if available endpoint fails
//       try {
//         console.log('🔄 Falling back to /teachers endpoint...');
//         const fallbackResponse = await api.get('/teachers');
//         const teachers = fallbackResponse.data || [];
//         // Format teachers for the dropdown
//         const formattedTeachers = teachers.map((teacher: any) => ({
//           id: teacher.id,
//           name: teacher.name,
//           email: teacher.email,
//           currentClass: teacher.currentClass || null
//         }));
//         return formattedTeachers;
//       } catch (fallbackError) {
//         console.error('❌ Fallback also failed:', fallbackError);
//         return [];
//       }
//     }
//   },

//   // Assign class teacher
//   assignClassTeacher: async (classId: string, teacherId: string) => {
//     try {
//       console.log(`📝 Assigning teacher ${teacherId} to class ${classId}`);
//       const response = await api.put(`/classes/${classId}/assign-teacher`, { teacherId });
//       console.log('✅ Assign response:', response.data);
//       return response.data;
//     } catch (error: any) {
//       console.error('❌ Error assigning class teacher:', error);
//       throw error;
//     }
//   },

//   // Remove class teacher
//   removeClassTeacher: async (classId: string) => {
//     try {
//       console.log(`📝 Removing class teacher from class ${classId}`);
//       const response = await api.put(`/classes/${classId}/assign-teacher`, { teacherId: null });
//       console.log('✅ Remove response:', response.data);
//       return response.data;
//     } catch (error: any) {
//       console.error('❌ Error removing class teacher:', error);
//       throw error;
//     }
//   },

//   // Get class by ID
//   getClassById: async (classId: string) => {
//     try {
//       const response = await api.get(`/classes/${classId}`);
//       return response.data;
//     } catch (error: any) {
//       console.error('Error fetching class:', error);
//       throw error;
//     }
//   },

//   // Get all classes (alias for classService.getAll, kept for compatibility)
//   getAllClasses: async () => {
//     try {
//       const response = await api.get('/classes');
//       return response.data;
//     } catch (error: any) {
//       console.error('Error fetching classes:', error);
//       return [];
//     }
//   }
// };

// export default dashboardService;

import api from './api';

export const dashboardService = {
  getTeacherDashboard: async () => {
    const response = await api.get('/dashboard/teacher');
    return response.data.data;
  },

  getPrincipalDashboard: async () => {
    const response = await api.get('/dashboard/principal');
    return response.data.data;
  },

  getAdminDashboard: async () => {
    const response = await api.get('/dashboard/admin');
    return response.data.data;
  },

  getBursarDashboard: async () => {
    const response = await api.get('/dashboard/bursar');
    return response.data.data;
  },

  getParentDashboard: async () => {
    const response = await api.get('/dashboard/parent');
    return response.data.data;
  },

  getStudentDashboard: async () => {
    const response = await api.get('/dashboard/student');
    return response.data.data;
  },

  submitGrade: async (gradeData: any) => {
    const response = await api.post('/grades', gradeData);
    return response.data;
  },

  deleteGrade: async (gradeId: string) => {
    const response = await api.delete(`/grades/${gradeId}`);
    return response.data;
  },

  bulkDeleteGrades: async (gradeIds: string[]) => {
    const response = await api.post('/grades/bulk-delete', { gradeIds });
    return response.data;
  },

  submitAttendance: async (attendanceData: any) => {
    const response = await api.post('/attendance/bulk', attendanceData);
    return response.data;
  },

  getAttendanceByClass: async (classId: string, date: string) => {
    const response = await api.get(`/attendance/class/${classId}?date=${date}`);
    return response.data;
  },

  getGradesByTeacher: async (teacherId: string, termId?: string, sessionId?: string) => {
    const params: any = {};
    if (teacherId) params.teacherId = teacherId;
    if (termId) params.termId = termId;
    if (sessionId) params.sessionId = sessionId;
    const response = await api.get('/grades/filter', { params });
    return response.data;
  },

  getTeacherStudents: async (teacherId: string) => {
    const response = await api.get(`/teachers/${teacherId}/students`);
    return response.data;
  },

  getGradesByStudent: async (studentId: string, termId?: string, sessionId?: string) => {
    const params: any = { studentId };
    if (termId) params.termId = termId;
    if (sessionId) params.sessionId = sessionId;
    const response = await api.get('/grades/filter', { params });
    return response.data;
  },

  getParentChildren: async () => {
    const response = await api.get('/parents/children');
    return response.data;
  },

  // ==================== CLASS TEACHER METHODS ====================
  
  // Get class teacher dashboard (returns class data, students, attendance, alerts)
  getClassTeacherDashboard: async () => {
    const response = await api.get('/dashboard/class-teacher');
    // Return the data property which contains the dashboard data
    return response.data.data;
  },

  // Get students in class teacher's class
  getClassTeacherStudents: async () => {
    const response = await api.get('/class-teacher/students');
    return response.data.data;
  },

  // Get class teacher's attendance summary (today, weekly, monthly)
  getClassTeacherAttendanceSummary: async () => {
    const response = await api.get('/class-teacher/attendance-summary');
    return response.data.data;
  },

  // Mark attendance for class teacher's class (bulk)
  markClassAttendance: async (data: { date: string; attendances: Array<{ studentId: string; status: string }> }) => {
    const response = await api.post('/class-teacher/mark-attendance', data);
    return response.data;
  },

  // Get attendance sheet for a specific date
  getClassAttendanceSheet: async (date: string) => {
    const response = await api.get(`/class-teacher/attendance-sheet?date=${date}`);
    return response.data.data;
  },

  // Get detailed student information for class teacher
  getClassTeacherStudentDetails: async (studentId: string) => {
    const response = await api.get(`/class-teacher/student/${studentId}`);
    return response.data.data;
  },

  // Generate report cards for entire class
  generateClassReportCards: async (classId: string, termId?: string) => {
    const params = termId ? { termId } : {};
    const response = await api.post(`/class/${classId}/generate-report-cards`, params);
    return response.data;
  },

  // Send bulk notifications to parents of students in class
  sendBulkParentNotification: async (data: { classId: string; message: string; subject?: string }) => {
    const response = await api.post('/class-teacher/notify-parents', data);
    return response.data;
  },

  // Get class performance summary (grade distribution, top/bottom students)
  getClassPerformanceSummary: async (classId: string, termId?: string) => {
    const params = termId ? { termId } : {};
    const response = await api.get(`/class/${classId}/performance-summary`, { params });
    return response.data.data;
  },

  // ==================== ADMIN CLASS TEACHER ASSIGNMENT METHODS ====================
  
  // Get available teachers for class teacher assignment
  getAvailableTeachers: async () => {
    try {
      console.log('📡 Fetching available teachers...');
      const response = await api.get('/teachers/available');
      console.log('✅ Available teachers response:', response.data);
      return response.data.data || [];
    } catch (error: any) {
      console.error('❌ Error fetching available teachers:', error);
      // Fallback to regular teachers endpoint if available endpoint fails
      try {
        console.log('🔄 Falling back to /teachers endpoint...');
        const fallbackResponse = await api.get('/teachers');
        const teachers = fallbackResponse.data || [];
        // Format teachers for the dropdown
        const formattedTeachers = teachers.map((teacher: any) => ({
          id: teacher.id,
          name: teacher.name,
          email: teacher.email,
          currentClass: teacher.currentClass || null
        }));
        return formattedTeachers;
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError);
        return [];
      }
    }
  },

  // Get teachers available for class teacher assignment (not already assigned)
  getAvailableClassTeachers: async () => {
    try {
      const response = await api.get('/teachers/available-for-class-teacher');
      return response.data.data || [];
    } catch (error: any) {
      console.error('Error fetching available class teachers:', error);
      return [];
    }
  },

  // Assign a teacher as class teacher for a specific class
  assignClassTeacher: async (classId: string, teacherId: string | null) => {
    try {
      console.log(`📝 Assigning teacher ${teacherId} to class ${classId}`);
      const response = await api.put(`/classes/${classId}/assign-class-teacher`, { teacherId });
      console.log('✅ Assign response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Error assigning class teacher:', error);
      throw error;
    }
  },

  // Remove class teacher from a class (alias for assignClassTeacher with null)
  removeClassTeacher: async (classId: string) => {
    return dashboardService.assignClassTeacher(classId, null);
  },

  // Get class by ID with full details
  getClassById: async (classId: string) => {
    try {
      const response = await api.get(`/classes/${classId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching class:', error);
      throw error;
    }
  },

  // Get all classes (alias for classService.getAll, kept for compatibility)
  getAllClasses: async () => {
    try {
      const response = await api.get('/classes');
      return response.data;
    } catch (error: any) {
      console.error('Error fetching classes:', error);
      return [];
    }
  },

  // Get classes with class teacher information
  getClassesWithClassTeachers: async () => {
    try {
      const response = await api.get('/classes');
      const classes = response.data;
      // Transform to include class teacher info
      return classes.map((cls: any) => ({
        id: cls.id,
        name: cls.name,
        grade: cls.grade,
        classTeacher: cls.classTeacher,
        classTeacherId: cls.classTeacherId,
        studentCount: cls._count?.students || 0
      }));
    } catch (error: any) {
      console.error('Error fetching classes with teachers:', error);
      return [];
    }
  },

  // ==================== TEACHER PORTAL METHODS ====================
  
  // Get unified teacher portal (shows both class teacher and subject teacher roles)
  getTeacherPortal: async () => {
    const response = await api.get('/teacher/portal');
    return response.data.data;
  },

  // Check if current teacher is a class teacher
  isClassTeacher: async () => {
    try {
      const response = await api.get('/dashboard/class-teacher');
      return response.data.data?.class !== null && response.data.data?.class !== undefined;
    } catch (error) {
      return false;
    }
  },
};

export default dashboardService;