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

  // Get fees for parent's children - FIXED VERSION
  getParentFees: async () => {
    try {
      console.log('👪 Fetching parent fees from API...');
      const response = await api.get('/fees/parent');
      console.log('✅ Parent fees response:', response.data);
      
      const result = response.data?.data || { fees: [], totalOutstanding: 0 };
      
      // Ensure fees is an array
      const feesArray = Array.isArray(result.fees) ? result.fees : [];
      
      const feesByStudent: Record<string, any> = {};
      
      feesArray.forEach((fee: any) => {
        const studentId = fee.studentId;
        
        // Skip if no studentId
        if (!studentId) return;
        
        if (!feesByStudent[studentId]) {
          // Extract student info safely
          let firstName = 'Unknown';
          let lastName = '';
          let admissionNo = 'N/A';
          let classInfo = { name: 'No Class Assigned', section: '', grade: 0 };
          
          // Try to get student info from different possible locations in the response
          if (fee.student) {
            // Check for name in different formats
            if (fee.student.name) {
              const nameParts = fee.student.name.split(' ');
              firstName = nameParts[0] || 'Unknown';
              lastName = nameParts.slice(1).join(' ') || '';
            } else if (fee.student.firstName) {
              firstName = fee.student.firstName;
              lastName = fee.student.lastName || '';
            } else if (fee.student.user?.name) {
              const nameParts = fee.student.user.name.split(' ');
              firstName = nameParts[0] || 'Unknown';
              lastName = nameParts.slice(1).join(' ') || '';
            } else if (fee.student.user?.firstName) {
              firstName = fee.student.user.firstName;
              lastName = fee.student.user.lastName || '';
            }
            
            admissionNo = fee.student.admissionNo || 'N/A';
            
            if (fee.student.class) {
              classInfo = {
                name: fee.student.class.name || 'No Class Assigned',
                section: fee.student.class.section || '',
                grade: fee.student.class.grade || 0
              };
            }
          }
          
          feesByStudent[studentId] = {
            childId: studentId,
            childName: `${firstName} ${lastName}`.trim(),
            admissionNo: admissionNo,
            class: classInfo,
            fees: []
          };
        }
        
        // Add fee with safe default values - THIS PREVENTS THE toLocaleString ERROR
        feesByStudent[studentId].fees.push({
          id: fee.id || '',
          studentId: fee.studentId || '',
          termId: fee.termId || '',
          totalAmount: fee.totalAmount ?? 0,
          amountPaid: fee.amountPaid ?? 0,
          balance: fee.balance ?? 0,
          status: fee.status || 'UNPAID',
          term: fee.term ? {
            id: fee.term.id || '',
            name: fee.term.name || 'N/A',
            session: fee.term.session ? {
              id: fee.term.session.id || '',
              name: fee.term.session.name || 'N/A',
              year: fee.term.session.name || 'N/A'
            } : null
          } : null,
          payments: Array.isArray(fee.payments) ? fee.payments : []
        });
      });
      
      const groupedFees = Object.values(feesByStudent);
      console.log(`✅ Grouped ${groupedFees.length} children with fees`);
      
      // Calculate total outstanding safely
      const totalOutstanding = groupedFees.reduce((sum, child: any) => 
        sum + (child.fees?.reduce((childSum: number, fee: any) => 
          childSum + (fee.balance ?? 0), 0) ?? 0), 0
      );
      
      console.log(`💰 Total outstanding calculated: ${totalOutstanding}`);
      
      return {
        fees: groupedFees,
        totalOutstanding: totalOutstanding
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