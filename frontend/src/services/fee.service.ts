import api from './api';
import toast from 'react-hot-toast';

export interface StudentFee {
  id: string;
  studentId: string;
  termId: string;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  status: 'PAID' | 'PARTIALLY_PAID' | 'PENDING' | 'OVERDUE';
  receiptNo?: string;
  createdAt: string;
  updatedAt: string;
  student?: {
    id: string;
    admissionNo: string;
    user: {
      firstName: string;
      lastName: string;
      email: string;
      name?: string;
    };
    class?: {
      id: string;
      name: string;
      section: string;
    };
  };
  term?: {
    id: string;
    name: string;
    academicYear?: string;
    session?: {
      id: string;
      name: string;
      year?: string;
    };
  };
  payments?: Payment[];
}

export interface Payment {
  id: string;
  feeId: string;
  amount: number;
  date: string;
  method: 'CASH' | 'BANK_TRANSFER' | 'POS' | 'ONLINE' | 'CHEQUE' | 'MOBILE_MONEY';
  reference?: string;
  recordedBy?: {
    firstName: string;
    lastName: string;
  };
}

export interface CreateFeeData {
  studentId: string;
  termId: string;
  totalAmount: number;
}

export interface RecordPaymentData {
  amount: number;
  method: 'CASH' | 'BANK_TRANSFER' | 'POS' | 'ONLINE' | 'CHEQUE' | 'MOBILE_MONEY';
  reference?: string;
}

export interface FeeSummary {
  totalExpected: number;
  totalCollected: number;
  totalOutstanding: number;
  collectionRate: number;
}

export interface Class {
  id: string;
  name: string;
  section?: string;
  grade?: number;
  studentCount?: number;
}

export const feeService = {
  // Get all fees with optional term/session filters
  getAll: async (params?: { termId?: string; sessionId?: string }): Promise<StudentFee[]> => {
    try {
      console.log('💰 Fetching fees from API...', params);
      const queryParams = new URLSearchParams();
      if (params?.termId) queryParams.append('termId', params.termId);
      if (params?.sessionId) queryParams.append('sessionId', params.sessionId);
      
      const url = queryParams.toString() ? `/fees?${queryParams}` : '/fees';
      const response = await api.get(url);
      console.log('✅ Fees response:', response.data?.data?.length || response.data?.length || 0, 'fees');
      return response.data?.data || response.data || [];
    } catch (error: any) {
      console.error('❌ Error fetching fees:', error);
      toast.error('Failed to load fees');
      return [];
    }
  },

  // Get fee by ID
  getById: async (id: string): Promise<StudentFee> => {
    try {
      const response = await api.get('/fees/' + id);
      return response.data?.data || response.data;
    } catch (error: any) {
      console.error('Error fetching fee:', error);
      throw error;
    }
  },

  // Get fees by student
  getByStudent: async (studentId: string): Promise<StudentFee[]> => {
    try {
      const response = await api.get('/fees/student/' + studentId);
      return response.data?.data || [];
    } catch (error: any) {
      console.error('Error fetching student fees:', error);
      return [];
    }
  },

  // Get fees for parent's children - FIXED VERSION (no regrouping needed)
  getParentFees: async () => {
    try {
      console.log('👪 Fetching parent fees from API...');
      const response = await api.get('/fees/parent');
      console.log('✅ Parent fees response:', response.data);
      
      // The API already returns the data in the correct grouped format:
      // {
      //   data: {
      //     fees: [
      //       {
      //         childId: "...",
      //         childName: "...",
      //         admissionNo: "...",
      //         class: { name: "...", section: "...", grade: ... },
      //         fees: [...]
      //       }
      //     ],
      //     totalOutstanding: ...
      //   }
      // }
      
      const result = response.data?.data || { fees: [], totalOutstanding: 0 };
      
      console.log(`📊 Found ${result.fees?.length || 0} children with fee records`);
      
      // Return the data directly - no transformation needed
      return {
        fees: result.fees || [],
        totalOutstanding: result.totalOutstanding || 0
      };
    } catch (error: any) {
      console.error('❌ Error fetching parent fees:', error);
      toast.error('Failed to load fees');
      return { fees: [], totalOutstanding: 0 };
    }
  },

  // Create new fee record
  create: async (data: CreateFeeData): Promise<StudentFee> => {
    try {
      console.log('📝 Creating fee record:', data);
      const response = await api.post('/fees', data);
      console.log('✅ Fee created successfully:', response.data?.data);
      toast.success('Fee record created successfully');
      return response.data?.data || response.data;
    } catch (error: any) {
      console.error('❌ Error creating fee:', error);
      toast.error(error.response?.data?.message || 'Failed to create fee');
      throw error;
    }
  },

  // Bulk create fees by class
  bulkCreate: async (data: { classFees: Array<{ classId: string; amount: number; className?: string }>, termId: string }): Promise<any> => {
    try {
      console.log('📦 Bulk creating fees:', data);
      const response = await api.post('/fees/bulk', data);
      toast.success(response.data?.message || 'Bulk fees created successfully');
      return response.data;
    } catch (error: any) {
      console.error('❌ Error bulk creating fees:', error);
      toast.error(error.response?.data?.message || 'Failed to bulk create fees');
      throw error;
    }
  },

  // Record payment
  recordPayment: async (feeId: string, data: RecordPaymentData): Promise<Payment> => {
    try {
      console.log('💵 Recording payment for fee:', feeId, data);
      const response = await api.post('/fees/' + feeId + '/payments', data);
      toast.success('Payment recorded successfully');
      return response.data?.data || response.data;
    } catch (error: any) {
      console.error('❌ Error recording payment:', error);
      toast.error(error.response?.data?.message || 'Failed to record payment');
      throw error;
    }
  },

  // Update fee
  update: async (id: string, data: Partial<CreateFeeData>): Promise<StudentFee> => {
    try {
      const response = await api.put('/fees/' + id, data);
      toast.success('Fee updated successfully');
      return response.data?.data || response.data;
    } catch (error: any) {
      console.error('Error updating fee:', error);
      toast.error(error.response?.data?.message || 'Failed to update fee');
      throw error;
    }
  },

  // Delete single fee
  delete: async (id: string): Promise<void> => {
    try {
      await api.delete('/fees/' + id);
      toast.success('Fee deleted successfully');
    } catch (error: any) {
      console.error('Error deleting fee:', error);
      toast.error(error.response?.data?.message || 'Failed to delete fee');
      throw error;
    }
  },

  // Bulk delete fees
  bulkDelete: async (feeIds: string[]): Promise<void> => {
    try {
      console.log(`🗑️ Bulk deleting ${feeIds.length} fees...`);
      const response = await api.post('/fees/bulk-delete', { feeIds });
      console.log('✅ Bulk delete response:', response.data);
      toast.success(response.data?.message || `${feeIds.length} fee record(s) deleted successfully`);
    } catch (error: any) {
      console.error('❌ Error bulk deleting fees:', error);
      console.error('Error response:', error.response?.data);
      toast.error(error.response?.data?.message || error.message || 'Failed to delete fee records');
      throw error;
    }
  },

  // Get fee summary with optional term/session filters
  getSummary: async (termId?: string, sessionId?: string): Promise<FeeSummary> => {
    try {
      const params: any = {};
      if (termId) params.termId = termId;
      if (sessionId) params.sessionId = sessionId;
      
      const response = await api.get('/fees/summary', { params });
      return response.data?.data || {
        totalExpected: 0,
        totalCollected: 0,
        totalOutstanding: 0,
        collectionRate: 0
      };
    } catch (error: any) {
      console.error('Error fetching fee summary:', error);
      return {
        totalExpected: 0,
        totalCollected: 0,
        totalOutstanding: 0,
        collectionRate: 0
      };
    }
  },

  // Get all classes for filter
  getClasses: async (): Promise<Class[]> => {
    try {
      const response = await api.get('/classes');
      console.log('📚 Classes response:', response.data?.length || 0);
      return response.data || [];
    } catch (error: any) {
      console.error('Error fetching classes:', error);
      return [];
    }
  },

  // Generate receipt
  generateReceipt: async (feeId: string): Promise<Blob> => {
    try {
      const response = await api.get('/fees/receipt/' + feeId, {
        responseType: 'blob'
      });
      return response.data;
    } catch (error: any) {
      console.error('Error generating receipt:', error);
      toast.error('Failed to generate receipt');
      throw error;
    }
  }
};

export default feeService;