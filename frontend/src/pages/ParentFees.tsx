import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { feeService } from '../services/fee.service';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { ReceiptRefundIcon, ArrowPathIcon, EyeIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function ParentFees() {
  const [expandedChild, setExpandedChild] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['parent-fees'],
    queryFn: feeService.getParentFees,
  });

  const handleDownloadReceipt = async (feeId: string) => {
    try {
      const blob = await feeService.generateReceipt(feeId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'receipt-' + feeId + '.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Receipt downloaded successfully');
    } catch (error) {
      toast.error('Failed to download receipt');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-700 mb-4">Error loading fee records: {error.message}</p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          <ArrowPathIcon className="w-4 h-4 mr-2" />
          Retry
        </button>
      </div>
    );
  }

  const fees = data?.fees || [];
  const totalOutstanding = data?.totalOutstanding || 0;

  const getStatusColor = (status: string) => {
    return status === 'PAID' ? 'bg-green-100 text-green-700' :
           status === 'PARTIALLY_PAID' ? 'bg-yellow-100 text-yellow-700' :
           'bg-red-100 text-red-700';
  };

  const getStatusBadge = (status: string) => {
    const displayStatus = status === 'PARTIALLY_PAID' ? 'PARTIALLY PAID' : status;
    return <Badge variant={status === 'PAID' ? 'success' : status === 'PARTIALLY_PAID' ? 'warning' : 'danger'}>{displayStatus}</Badge>;
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">My Children's Fees</h1>
          <p className="text-sm sm:text-base text-gray-600">View and manage fees for all your children</p>
        </div>
        <button
          onClick={() => refetch()}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors self-end sm:self-auto"
          title="Refresh"
        >
          <ArrowPathIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Summary Card - Mobile Optimized */}
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <ReceiptRefundIcon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-600">Total Outstanding</p>
              <p className="text-xl sm:text-2xl font-bold text-red-600">
                ₦{totalOutstanding.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="text-xs sm:text-sm text-gray-500">
            {fees.length} child{fees.length !== 1 ? 'ren' : ''} with fee records
          </div>
        </div>
      </Card>

      {/* Mobile Card View */}
      <div className="block sm:hidden space-y-4">
        {fees.map((childData: any) => (
          <div key={childData.childId} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Child Header - Click to expand/collapse */}
            <button
              onClick={() => setExpandedChild(expandedChild === childData.childId ? null : childData.childId)}
              className="w-full p-4 bg-gray-50 hover:bg-gray-100 transition-colors flex justify-between items-center"
            >
              <div>
                <h3 className="font-semibold text-gray-900">{childData.childName}</h3>
                <p className="text-sm text-gray-500">{childData.class?.name || 'N/A'}</p>
                <p className="text-xs text-gray-400">Adm: {childData.admissionNo}</p>
              </div>
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform ${expandedChild === childData.childId ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {/* Fee Records - Expandable */}
            {(expandedChild === childData.childId || expandedChild === null) && (
              <div className="divide-y divide-gray-100">
                {childData.fees.map((fee: any) => (
                  <div key={fee.id} className="p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <Badge variant="info" className="text-xs">
                          {fee.term?.name || 'N/A'} - {fee.term?.session?.year || 'N/A'}
                        </Badge>
                      </div>
                      {fee.payments?.length > 0 && (
                        <button
                          onClick={() => handleDownloadReceipt(fee.id)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Download Receipt"
                        >
                          <ReceiptRefundIcon className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-gray-500">Total Fee</p>
                        <p className="font-semibold">₦{fee.totalAmount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Paid</p>
                        <p className="font-semibold text-green-600">₦{fee.amountPaid.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Balance</p>
                        <p className="font-semibold text-red-600">₦{fee.balance.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Status</p>
                        {getStatusBadge(fee.status)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        
        {fees.length === 0 && (
          <div className="text-center py-8">
            <ReceiptRefundIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No fee records found for your children</p>
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden sm:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Child</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Term</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Fee</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {fees.map((childData: any) => 
              childData.fees.map((fee: any, index: number) => {
                const showChildName = index === 0;
                
                return (
                  <tr key={fee.id} className="hover:bg-gray-50">
                    {showChildName && (
                      <td className="px-4 py-3" rowSpan={childData.fees.length}>
                        <div className="font-medium text-gray-900">{childData.childName}</div>
                        <div className="text-xs text-gray-500">Adm: {childData.admissionNo}</div>
                      </td>
                    )}
                    {showChildName && (
                      <td className="px-4 py-3" rowSpan={childData.fees.length}>
                        <span className="text-sm text-gray-600">
                          {childData.class?.name || 'N/A'} {childData.class?.section || ''}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {fee.term?.name || 'N/A'} - {fee.term?.session?.year || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium">₦{fee.totalAmount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-right text-green-600 font-medium">₦{fee.amountPaid.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-right text-red-600 font-medium">₦{fee.balance.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={'px-2 py-1 text-xs font-medium rounded-full ' + getStatusColor(fee.status)}>
                        {fee.status === 'PARTIALLY_PAID' ? 'PARTIALLY PAID' : fee.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {fee.payments?.length > 0 && (
                        <button
                          onClick={() => handleDownloadReceipt(fee.id)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Download Receipt"
                        >
                          <ReceiptRefundIcon className="h-5 w-5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
            {fees.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  No fee records found for your children
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
