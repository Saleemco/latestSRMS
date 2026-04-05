// services/class.service.ts
import api from './api';
import toast from 'react-hot-toast';

export interface Class {
  id: string;
  name: string;
  grade: number;
  section?: string;
  teacherId?: string | null;
  teacher?: {
    id: string;
    name: string;
    email: string;
  } | null;
  classTeacherId?: string | null;
  classTeacher?: {
    id: string;
    name: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  _count?: {
    students: number;
    subjects: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateClassData {
  name: string;
  section?: string;
  grade?: number;
  teacherId?: string | null;
  classTeacherId?: string | null;
}

export const classService = {
  // Get all classes
  getAll: async (): Promise<Class[]> => {
    try {
      console.log('📚 Fetching classes from API...');
      const response = await api.get('/classes');
      console.log('✅ Classes response:', response.data);
      console.log('📊 Number of classes:', response.data?.length || 0);
      
      // Log classes with class teachers for debugging
      if (response.data && response.data.length > 0) {
        const withClassTeacher = response.data.filter((c: Class) => c.classTeacher);
        console.log(`📊 Classes with class teachers: ${withClassTeacher.length}`);
        withClassTeacher.forEach((c: Class) => {
          console.log(`   - ${c.name}: ${c.classTeacher?.firstName} ${c.classTeacher?.lastName}`);
        });
      }
      
      return response.data || [];
    } catch (error: any) {
      console.error('❌ Error fetching classes:', error);
      toast.error('Failed to load classes');
      return [];
    }
  },

  // Get class by ID
  getById: async (id: string): Promise<Class> => {
    try {
      const response = await api.get(`/classes/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching class:', error);
      throw error;
    }
  },

  // Create new class
  create: async (data: CreateClassData): Promise<Class> => {
    try {
      console.log('📝 Creating class with data:', JSON.stringify(data, null, 2));
      const response = await api.post('/classes', data);
      console.log('✅ Create response:', response.data);
      toast.success('Class created successfully');
      return response.data;
    } catch (error: any) {
      console.error('❌ Error creating class:', error);
      
      if (error.response) {
        const errorMessage = error.response.data?.message || 
                            error.response.data?.error || 
                            'Failed to create class';
        toast.error(errorMessage);
      } else {
        toast.error('Failed to create class');
      }
      throw error;
    }
  },

  // Update class
  update: async (id: string, data: Partial<CreateClassData>): Promise<Class> => {
    try {
      const response = await api.put(`/classes/${id}`, data);
      toast.success('Class updated successfully');
      return response.data;
    } catch (error: any) {
      console.error('Error updating class:', error);
      toast.error(error.response?.data?.message || 'Failed to update class');
      throw error;
    }
  },

  // Delete class
  delete: async (id: string): Promise<void> => {
    try {
      await api.delete(`/classes/${id}`);
      toast.success('Class deleted successfully');
    } catch (error: any) {
      console.error('Error deleting class:', error);
      toast.error(error.response?.data?.message || 'Failed to delete class');
      throw error;
    }
  },

  // Assign class teacher (using the dedicated endpoint)
  assignClassTeacher: async (classId: string, teacherId: string): Promise<Class> => {
    try {
      console.log(`📝 Assigning teacher ${teacherId} to class ${classId}`);
      const response = await api.put(`/classes/${classId}/assign-teacher`, { teacherId });
      toast.success(response.data?.message || 'Class teacher assigned successfully');
      return response.data?.data || response.data;
    } catch (error: any) {
      console.error('Error assigning class teacher:', error);
      toast.error(error.response?.data?.message || 'Failed to assign class teacher');
      throw error;
    }
  },

  // Remove class teacher
  removeClassTeacher: async (classId: string): Promise<Class> => {
    try {
      console.log(`📝 Removing class teacher from class ${classId}`);
      const response = await api.put(`/classes/${classId}/assign-teacher`, { teacherId: null });
      toast.success(response.data?.message || 'Class teacher removed successfully');
      return response.data?.data || response.data;
    } catch (error: any) {
      console.error('Error removing class teacher:', error);
      toast.error(error.response?.data?.message || 'Failed to remove class teacher');
      throw error;
    }
  }
};

export default classService;