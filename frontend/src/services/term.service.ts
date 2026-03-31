import api from './api';
import toast from 'react-hot-toast';

export interface Term {
  id: string;
  name: string;
  sessionId: string;
  session?: {
    id: string;
    name: string;
  };
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export const termService = {
  // ===== SESSION METHODS =====
  
  getAllSessions: async (): Promise<Session[]> => {
    try {
      const response = await api.get('/sessions');  // <-- Changed from /api/sessions
      return response.data?.data || [];
    } catch (error: any) {
      console.error('Error fetching sessions:', error);
      return [];
    }
  },

  getActiveSession: async (): Promise<Session | null> => {
    try {
      const response = await api.get('/sessions/active');  // <-- Changed from /api/sessions/active
      return response.data?.data || null;
    } catch (error: any) {
      console.error('Error fetching active session:', error);
      return null;
    }
  },

  createSession: async (data: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>): Promise<Session> => {
    try {
      const response = await api.post('/sessions', data);  // <-- Changed from /api/sessions
      toast.success('Academic year created successfully');
      return response.data.data;
    } catch (error: any) {
      console.error('Error creating session:', error);
      toast.error(error.response?.data?.error || 'Failed to create academic year');
      throw error;
    }
  },

  // ===== TERM METHODS =====
  
  getAll: async (sessionId?: string): Promise<Term[]> => {
    try {
      const params = sessionId ? { sessionId } : {};
      const response = await api.get('/terms', { params });  // <-- Changed from /api/terms
      return response.data?.data || [];
    } catch (error: any) {
      console.error('Error fetching terms:', error);
      return [];
    }
  },

  getActive: async (): Promise<Term | null> => {
    try {
      const response = await api.get('/terms/active');  // <-- Changed from /api/terms/active
      return response.data?.data || null;
    } catch (error: any) {
      console.error('Error fetching active term:', error);
      return null;
    }
  },

  create: async (data: { name: string; sessionId: string; startDate: string; endDate: string; isActive?: boolean }): Promise<Term> => {
    try {
      const response = await api.post('/terms', data);  // <-- Changed from /api/terms
      toast.success(response.data.message || 'Term created successfully');
      return response.data.data;
    } catch (error: any) {
      console.error('Error creating term:', error);
      toast.error(error.response?.data?.error || 'Failed to create term');
      throw error;
    }
  },

  update: async (id: string, data: Partial<Omit<Term, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Term> => {
    try {
      const response = await api.put(`/terms/${id}`, data);  // <-- Changed from /api/terms/${id}
      toast.success(response.data.message || 'Term updated successfully');
      return response.data.data;
    } catch (error: any) {
      console.error('Error updating term:', error);
      toast.error(error.response?.data?.error || 'Failed to update term');
      throw error;
    }
  },

  delete: async (id: string): Promise<void> => {
    try {
      await api.delete(`/terms/${id}`);  // <-- Changed from /api/terms/${id}
      toast.success('Term deleted successfully');
    } catch (error: any) {
      console.error('Error deleting term:', error);
      toast.error(error.response?.data?.error || 'Failed to delete term');
      throw error;
    }
  },

  setActive: async (id: string): Promise<Term> => {
    try {
      const response = await api.put(`/terms/${id}`, { isActive: true });  // <-- Changed from /api/terms/${id}
      toast.success('Term activated successfully');
      return response.data.data;
    } catch (error: any) {
      console.error('Error activating term:', error);
      toast.error('Failed to activate term');
      throw error;
    }
  }
};

export default termService;