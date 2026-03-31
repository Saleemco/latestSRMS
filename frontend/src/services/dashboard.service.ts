// dashboard.service.ts
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
};