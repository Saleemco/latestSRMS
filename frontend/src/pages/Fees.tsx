import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  DollarSign, 
  CreditCard, 
  TrendingUp, 
  Wallet,
  Eye,
  Edit,
  Trash2,
  Users,
  Trash,
  CheckSquare,
  Square,
  Filter,
  Calendar,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { feeService } from '../services/fee.service';
import { useAuth } from '../context/AuthContext';
import { useTerm } from '../context/TermContext';
import RecordPaymentModal from '../components/fees/RecordPaymentModal';
import CreateFeeModal from '../components/fees/CreateFeeModal';
import CreateBulkFeeModal from '../components/fees/CreateBulkFeeModal';
import EditFeeModal from '../components/fees/EditFeeModal';
import toast from 'react-hot-toast';

export default function Fees() {
  const { user } = useAuth();
  const { selectedTerm, terms, sessions, activeTerm, selectedSession, setSelectedSession, setSelectedTerm } = useTerm();
  const [selectedFee, setSelectedFee] = useState<any>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedFees, setSelectedFees] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [classFilter, setClassFilter] = useState<string>('');
  const [expandedMobileRows, setExpandedMobileRows] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const isBursar = user?.role === 'BURSAR';
  const canManageFees = isBursar;
  const canRecordPayments = isBursar;
  const canView = ['BURSAR', 'ADMIN', 'PRINCIPAL'].includes(user?.role || '');

  const { 
    data: fees, 
    isLoading: feesLoading, 
    refetch 
  } = useQuery({
    queryKey: ['fees', selectedTerm?.id, selectedSession?.id],
    queryFn: () => {
      return feeService.getAll({ 
        termId: selectedTerm?.id,
        sessionId: selectedSession?.id 
      });
    },
    enabled: canView,
  });

  const { 
    data: summary, 
    refetch: refetchSummary 
  } = useQuery({
    queryKey: ['fee-summary', selectedTerm?.id, selectedSession?.id],
    queryFn: () => {
      return feeService.getSummary(selectedTerm?.id, selectedSession?.id);
    },
    enabled: canView,
  });

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: () => feeService.getClasses(),
    enabled: canView,
  });

  const filteredFees = fees?.filter((fee: any) => {
    if (statusFilter && fee.status !== statusFilter) return false;
    if (classFilter && fee.student?.class?.id !== classFilter) return false;
    return true;
  });

  const uniqueClasses = [...new Map(fees?.map((fee: any) => [fee.student?.class?.id, {
    id: fee.student?.class?.id,
    name: fee.student?.class?.name
  }]).filter(Boolean)).values()];

  const toggleMobileRow = (feeId: string) => {
    const newSet = new Set(expandedMobileRows);
    if (newSet.has(feeId)) {
      newSet.delete(feeId);
    } else {
      newSet.add(feeId);
    }
    setExpandedMobileRows(newSet);
  };

  const handleRecordPayment = (fee: any) => {
    if (!canRecordPayments) {
      toast.error('Only Bursar can record payments');
      return;
    }
    setSelectedFee(fee);
    setIsPaymentModalOpen(true);
  };

  const handleEditFee = (fee: any) => {
    if (!canManageFees) {
      toast.error('Only Bursar can edit fees');
      return;
    }
    setSelectedFee(fee);
    setIsEditModalOpen(true);
  };

  const handleDeleteFee = async (feeId: string) => {
    if (!canManageFees) {
      toast.error('Only Bursar can delete fees');
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this fee record?')) return;
    
    try {
      await feeService.delete(feeId);
      queryClient.invalidateQueries({ queryKey: ['fees', selectedTerm?.id, selectedSession?.id] });
      queryClient.invalidateQueries({ queryKey: ['fee-summary', selectedTerm?.id, selectedSession?.id] });
      toast.success('Fee record deleted successfully');
      setSelectedFees(prev => prev.filter(id => id !== feeId));
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete fee record');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedFees.length === 0) {
      toast.error('Please select at least one fee to delete');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${selectedFees.length} fee record(s)? This action cannot be undone.`)) {
      return;
    }

    try {
      await feeService.bulkDelete(selectedFees);
      queryClient.invalidateQueries({ queryKey: ['fees', selectedTerm?.id, selectedSession?.id] });
      queryClient.invalidateQueries({ queryKey: ['fee-summary', selectedTerm?.id, selectedSession?.id] });
      toast.success(`${selectedFees.length} fee record(s) deleted successfully`);
      setSelectedFees([]);
      setIsBulkDeleteModalOpen(false);
    } catch (error: any) {
      console.error('❌ Bulk delete error:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to delete fee records');
    }
  };

  const handleSelectAll = () => {
    if (selectedFees.length === filteredFees?.length) {
      setSelectedFees([]);
    } else {
      setSelectedFees(filteredFees?.map((fee: any) => fee.id) || []);
    }
  };

  const handleSelectFee = (feeId: string) => {
    setSelectedFees(prev =>
      prev.includes(feeId)
        ? prev.filter(id => id !== feeId)
        : [...prev, feeId]
    );
  };

  const clearFilters = () => {
    setStatusFilter('');
    setClassFilter('');
    setShowFilters(false);
  };

  const handleRefresh = () => {
    refetch();
    refetchSummary();
    toast.success('Refreshing data...');
  };

  const handleCreateSuccess = () => {
    refetch();
    refetchSummary();
    queryClient.invalidateQueries({ queryKey: ['fees', selectedTerm?.id, selectedSession?.id] });
    queryClient.invalidateQueries({ queryKey: ['fee-summary', selectedTerm?.id, selectedSession?.id] });
    toast.success('Fee record created successfully');
    setIsCreateModalOpen(false);
  };

  const getStudentName = (fee: any) => {
    if (!fee.student) return 'No Student Linked';
    
    if (fee.student.user) {
      if (fee.student.user.firstName) {
        return `${fee.student.user.firstName} ${fee.student.user.lastName || ''}`.trim();
      }
      if (fee.student.user.name) return fee.student.user.name;
    }
    
    if (fee.student.name) return fee.student.name;
    return `Student (${fee.studentId?.slice(-4) || 'Unknown'})`;
  };

  const getStatusColor = (status: string) => {
    return status === 'PAID' ? 'bg-green-100 text-green-700' :
           status === 'PARTIALLY_PAID' ? 'bg-yellow-100 text-yellow-700' :
           status === 'PENDING' ? 'bg-orange-100 text-orange-700' :
           'bg-red-100 text-red-700';
  };

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-4">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <Eye className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-500">You don't have permission to view this page.</p>
      </div>
    );
  }

  if (feesLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Fee Management</h1>
          <p className="text-xs sm:text-sm text-gray-500">
            {isBursar ? 'Manage student fees and payments' : 'View student fees and payments'}
            {selectedTerm && (
              <span className="ml-2 text-blue-600 font-medium">
                - {selectedTerm.name} ({selectedTerm.academicYear || selectedTerm.session?.name})
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap w-full sm:w-auto">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden xs:inline">Refresh</span>
          </button>
          {canManageFees && selectedFees.length > 0 && (
            <button
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
            >
              <Trash className="w-4 h-4" />
              <span className="hidden xs:inline">Delete ({selectedFees.length})</span>
            </button>
          )}
          {canManageFees && (
            <>
              <button
                onClick={() => setIsBulkModalOpen(true)}
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
              >
                <Users className="w-4 h-4" />
                <span className="hidden xs:inline">Bulk Create</span>
              </button>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden xs:inline">Create Fee</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Session and Term Selection - Mobile Optimized */}
      <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filter:</span>
          </div>
          
          <select
            value={selectedSession?.id || ''}
            onChange={(e) => {
              const session = sessions.find(s => s.id === e.target.value);
              setSelectedSession(session || null);
            }}
            className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Sessions</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.name} {session.isActive ? '(Active)' : ''}
              </option>
            ))}
          </select>

          <select
            value={selectedTerm?.id || ''}
            onChange={(e) => {
              const term = terms.find(t => t.id === e.target.value);
              if (term) setSelectedTerm(term);
            }}
            className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            disabled={!selectedSession}
          >
            <option value="">All Terms</option>
            {terms.filter(t => t.sessionId === selectedSession?.id).map((term) => (
              <option key={term.id} value={term.id}>
                {term.name} {term.isActive ? '(Active)' : ''}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors w-full sm:w-auto justify-center"
          >
            <Filter className="w-4 h-4" />
            <span className="text-sm">Advanced Filters</span>
          </button>
        </div>

        {showFilters && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Statuses</option>
                <option value="PAID">Paid</option>
                <option value="PARTIALLY_PAID">Partially Paid</option>
                <option value="PENDING">Pending</option>
                <option value="OVERDUE">Overdue</option>
              </select>

              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Classes</option>
                {uniqueClasses.map((cls: any) => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>

              <button
                onClick={clearFilters}
                className="flex items-center justify-center gap-1 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
              >
                <X className="w-4 h-4" />
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Summary Cards - Mobile Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6">
        <div className="bg-white rounded-xl p-3 sm:p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="w-8 h-8 sm:w-12 sm:h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <DollarSign className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Expected</p>
              <p className="text-base sm:text-2xl font-bold text-gray-900">₦{summary?.totalExpected?.toLocaleString() || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-3 sm:p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="w-8 h-8 sm:w-12 sm:h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Wallet className="w-4 h-4 sm:w-6 sm:h-6 text-green-600" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Collected</p>
              <p className="text-base sm:text-2xl font-bold text-green-600">₦{summary?.totalCollected?.toLocaleString() || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-3 sm:p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="w-8 h-8 sm:w-12 sm:h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <CreditCard className="w-4 h-4 sm:w-6 sm:h-6 text-red-600" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Outstanding</p>
              <p className="text-base sm:text-2xl font-bold text-red-600">₦{summary?.totalOutstanding?.toLocaleString() || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-3 sm:p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="w-8 h-8 sm:w-12 sm:h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-4 h-4 sm:w-6 sm:h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Rate</p>
              <p className="text-base sm:text-2xl font-bold text-gray-900">{summary?.collectionRate?.toFixed(1) || 0}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="block sm:hidden space-y-3">
        {filteredFees && filteredFees.length > 0 ? (
          filteredFees.map((fee: any) => {
            const isExpanded = expandedMobileRows.has(fee.id);
            const studentName = getStudentName(fee);
            
            return (
              <div key={fee.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{studentName}</h3>
                      <p className="text-xs text-gray-500">{fee.student?.admissionNo || 'N/A'} | {fee.student?.class?.name || 'No Class'}</p>
                    </div>
                    {canManageFees && (
                      <button
                        onClick={() => handleSelectFee(fee.id)}
                        className="text-gray-500"
                      >
                        {selectedFees.includes(fee.id) ? (
                          <CheckSquare className="w-5 h-5 text-blue-600" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    )}
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Term:</span>
                      <span className="font-medium">{fee.term?.name || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total:</span>
                      <span className="font-bold">₦{fee.totalAmount?.toLocaleString() || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Paid:</span>
                      <span className="text-green-600 font-medium">₦{fee.amountPaid?.toLocaleString() || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Balance:</span>
                      <span className="text-red-600 font-medium">₦{fee.balance?.toLocaleString() || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Status:</span>
                      <span className={'px-2 py-1 text-xs font-medium rounded-full ' + getStatusColor(fee.status)}>
                        {fee.status || 'PENDING'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-2 mt-3 pt-2 border-t">
                    {canRecordPayments && fee.status !== 'PAID' && (
                      <button onClick={() => handleRecordPayment(fee)} className="p-1 text-green-600">
                        <Wallet className="w-4 h-4" />
                      </button>
                    )}
                    <button className="p-1 text-blue-600">
                      <Eye className="w-4 h-4" />
                    </button>
                    {canManageFees && (
                      <>
                        <button onClick={() => handleEditFee(fee)} className="p-1 text-yellow-600">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteFee(fee.id)} className="p-1 text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-8 text-gray-500">
            No fee records found for the selected filters.
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden sm:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-gray-50">
            <tr>
              {canManageFees && (
                <th className="px-4 py-3 text-center w-12">
                  <button onClick={handleSelectAll} className="text-gray-500">
                    {selectedFees.length === filteredFees?.length && filteredFees?.length > 0 ? (
                      <CheckSquare className="w-5 h-5" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Term</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredFees && filteredFees.length > 0 ? (
              filteredFees.map((fee: any) => {
                const studentName = getStudentName(fee);
                return (
                  <tr key={fee.id} className="hover:bg-gray-50">
                    {canManageFees && (
                      <td className="px-4 py-4 text-center">
                        <button onClick={() => handleSelectFee(fee.id)} className="text-gray-500">
                          {selectedFees.includes(fee.id) ? (
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>
                      </td>
                    )}
                    <td className="px-4 py-4">
                      <p className="font-medium text-gray-900">{studentName}</p>
                      <p className="text-xs text-gray-500">{fee.student?.admissionNo || 'N/A'} | {fee.student?.class?.name || 'No Class'}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">{fee.term?.name || 'N/A'}</td>
                    <td className="px-4 py-4 text-right font-medium">₦{fee.totalAmount?.toLocaleString() || 0}</td>
                    <td className="px-4 py-4 text-right text-green-600 font-medium">₦{fee.amountPaid?.toLocaleString() || 0}</td>
                    <td className="px-4 py-4 text-right text-red-600 font-medium">₦{fee.balance?.toLocaleString() || 0}</td>
                    <td className="px-4 py-4 text-center">
                      <span className={'px-2 py-1 text-xs font-medium rounded-full ' + getStatusColor(fee.status)}>
                        {fee.status || 'PENDING'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {canRecordPayments && fee.status !== 'PAID' && (
                          <button onClick={() => handleRecordPayment(fee)} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Record Payment">
                            <Wallet className="w-4 h-4" />
                          </button>
                        )}
                        <button className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="View Details">
                          <Eye className="w-4 h-4" />
                        </button>
                        {canManageFees && (
                          <>
                            <button onClick={() => handleEditFee(fee)} className="p-1 text-yellow-600 hover:bg-yellow-50 rounded" title="Edit">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteFee(fee.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={canManageFees ? 8 : 7} className="px-4 py-8 text-center text-gray-500">
                  No fee records found for the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modals - Keep existing modal code */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Bulk Delete</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete {selectedFees.length} fee record(s)? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setIsBulkDeleteModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={handleBulkDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Delete All</button>
            </div>
          </div>
        </div>
      )}

      {canManageFees && <CreateFeeModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onSuccess={handleCreateSuccess} />}
      {canManageFees && <CreateBulkFeeModal isOpen={isBulkModalOpen} onClose={() => setIsBulkModalOpen(false)} onSuccess={() => { refetch(); refetchSummary(); setIsBulkModalOpen(false); }} />}
      {selectedFee && canRecordPayments && <RecordPaymentModal isOpen={isPaymentModalOpen} onClose={() => { setIsPaymentModalOpen(false); setSelectedFee(null); }} onSuccess={() => { refetch(); refetchSummary(); setIsPaymentModalOpen(false); setSelectedFee(null); }} feeId={selectedFee.id} studentName={getStudentName(selectedFee)} totalAmount={selectedFee.totalAmount} amountPaid={selectedFee.amountPaid} balance={selectedFee.balance} />}
      {selectedFee && canManageFees && <EditFeeModal isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); setSelectedFee(null); }} onSuccess={() => { refetch(); refetchSummary(); setIsEditModalOpen(false); setSelectedFee(null); }} fee={selectedFee} />}
    </div>
  );
}
