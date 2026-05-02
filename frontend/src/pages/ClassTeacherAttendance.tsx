import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api from '../services/api';

export const ClassTeacherAttendance = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendances, setAttendances] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['class-teacher-attendance', selectedDate],
    queryFn: async () => {
      console.log('📡 Fetching attendance for date:', selectedDate);
      const response = await api.get(`/class-teacher/attendance?date=${selectedDate}`);
      console.log('📡 Attendance response:', response.data);
      return response.data.data;
    },
  });

  const saveAttendanceMutation = useMutation({
    mutationFn: async () => {
      const attendanceList = Object.entries(attendances).map(([studentId, status]) => ({
        studentId,
        status,
      }));

      const payload = {
        date: selectedDate,
        attendances: attendanceList,
        classId: data?.classId,
      };

      console.log('📡 Saving attendance with payload:', payload);

      const response = await api.post('/class-teacher/attendance/bulk', payload);
      console.log('📡 Save response:', response.data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-teacher-attendance'] });
      toast.success('Attendance saved successfully!');
    },
    onError: (error: any) => {
      console.error('❌ Save attendance error:', error);
      console.error('❌ Error response:', error.response?.data);
      toast.error(error.response?.data?.error || error.response?.data?.message || 'Failed to save attendance');
    },
  });

  useEffect(() => {
    if (data?.students) {
      const initialAttendances: Record<string, string> = {};
      data.students.forEach((student: any) => {
        initialAttendances[student.studentId] = student.status || 'PRESENT';
      });
      setAttendances(initialAttendances);
      console.log('✅ Loaded attendances:', initialAttendances);
      console.log('✅ Class ID:', data?.classId);
    }
  }, [data]);

  const updateAttendance = (studentId: string, status: string) => {
    setAttendances(prev => ({ ...prev, [studentId]: status }));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Take Attendance</h1>
          <p className="text-gray-600 dark:text-gray-400">Class: {data?.className || 'Loading...'}</p>
          <p className="text-xs text-gray-500">Class ID: {data?.classId || 'N/A'}</p>
        </div>
        <div className="flex gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
          />
          <Button variant="secondary" onClick={() => refetch()}>Load Date</Button>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Admission No</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {data?.students?.map((student: any) => (
                <tr key={student.studentId} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {student.studentName}
                   </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {student.admissionNo}
                   </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => updateAttendance(student.studentId, 'PRESENT')}
                        className={`p-2 rounded-lg transition-colors ${
                          attendances[student.studentId] === 'PRESENT'
                            ? 'bg-green-100 dark:bg-green-900/30 ring-2 ring-green-500'
                            : 'bg-gray-100 dark:bg-gray-800 hover:bg-green-50'
                        }`}
                        title="Present"
                      >
                        <CheckCircleIcon className="w-5 h-5 text-green-600" />
                      </button>
                      <button
                        onClick={() => updateAttendance(student.studentId, 'ABSENT')}
                        className={`p-2 rounded-lg transition-colors ${
                          attendances[student.studentId] === 'ABSENT'
                            ? 'bg-red-100 dark:bg-red-900/30 ring-2 ring-red-500'
                            : 'bg-gray-100 dark:bg-gray-800 hover:bg-red-50'
                        }`}
                        title="Absent"
                      >
                        <XCircleIcon className="w-5 h-5 text-red-600" />
                      </button>
                      <button
                        onClick={() => updateAttendance(student.studentId, 'LATE')}
                        className={`p-2 rounded-lg transition-colors ${
                          attendances[student.studentId] === 'LATE'
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 ring-2 ring-yellow-500'
                            : 'bg-gray-100 dark:bg-gray-800 hover:bg-yellow-50'
                        }`}
                        title="Late"
                      >
                        <ClockIcon className="w-5 h-5 text-yellow-600" />
                      </button>
                      <span className="ml-2 text-sm font-medium">{attendances[student.studentId] || 'PRESENT'}</span>
                    </div>
                   </td>
                 </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={() => saveAttendanceMutation.mutate()} isLoading={saveAttendanceMutation.isPending}>
            Save Attendance
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ClassTeacherAttendance;