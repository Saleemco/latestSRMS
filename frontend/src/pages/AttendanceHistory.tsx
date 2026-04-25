import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { Badge } from '../components/ui/Badge';
import { 
  CalendarIcon, 
  ChartBarIcon, 
  UsersIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import api from '../services/api';

export const AttendanceHistory = () => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // Fetch attendance history
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['class-teacher-attendance-history', currentMonth, currentYear],
    queryFn: async () => {
      const response = await api.get('/class-teacher/attendance-history', {
        params: { month: currentMonth + 1, year: currentYear }
      });
      return response.data.data;
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return <CheckCircleIcon className="w-4 h-4 text-green-500" />;
      case 'ABSENT':
        return <XCircleIcon className="w-4 h-4 text-red-500" />;
      case 'LATE':
        return <ClockIcon className="w-4 h-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return <Badge variant="success" size="sm">Present</Badge>;
      case 'ABSENT':
        return <Badge variant="danger" size="sm">Absent</Badge>;
      case 'LATE':
        return <Badge variant="warning" size="sm">Late</Badge>;
      default:
        return <Badge variant="default" size="sm">{status}</Badge>;
    }
  };

  const changeMonth = (delta: number) => {
    let newMonth = currentMonth + delta;
    let newYear = currentYear;
    
    if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    }
    
    setCurrentMonth(newMonth);
    setCurrentYear(newYear);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const summary = data?.summary;
  const monthlySummary = data?.monthlySummary || [];
  const attendanceByDate = data?.attendanceByDate || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Attendance History</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Class: {data?.className || 'Loading...'}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Students</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{data?.totalStudents || 0}</p>
            </div>
            <UsersIcon className="w-8 h-8 text-blue-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Days Recorded</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary?.totalDays || 0}</p>
            </div>
            <CalendarIcon className="w-8 h-8 text-green-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Average Attendance</p>
              <p className="text-2xl font-bold text-purple-600">{summary?.averageAttendance || 0}%</p>
            </div>
            <ChartBarIcon className="w-8 h-8 text-purple-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">This Month</p>
              <p className="text-2xl font-bold text-indigo-600">
                {monthlySummary[0]?.attendanceRate || 0}%
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Monthly Trend */}
      <Card title="Monthly Attendance Trend">
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => changeMonth(-1)}>
                  <ChevronLeftIcon className="w-4 h-4" />
                </Button>
                <span className="text-lg font-semibold">
                  {new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
                <Button variant="secondary" size="sm" onClick={() => changeMonth(1)}>
                  <ChevronRightIcon className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {monthlySummary.map((month: any, idx: number) => (
                <div key={idx} className="flex items-center gap-4">
                  <div className="w-32 text-sm text-gray-600 dark:text-gray-400">{month.month}</div>
                  <div className="flex-1">
                    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 rounded-full flex items-center justify-end px-2 text-xs text-white"
                        style={{ width: `${month.attendanceRate}%` }}
                      >
                        {month.attendanceRate > 30 && `${month.attendanceRate}%`}
                      </div>
                    </div>
                  </div>
                  <div className="w-24 text-sm text-gray-600 dark:text-gray-400">
                    {month.present} / {month.total}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Daily Attendance Records */}
      <Card title="Daily Attendance Records">
        <div className="space-y-4">
          {attendanceByDate.length > 0 ? (
            attendanceByDate.map((day: any) => (
              <div key={day.date} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => setSelectedDate(selectedDate === day.date ? null : day.date)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 flex justify-between items-center"
                >
                  <div className="flex items-center gap-3">
                    <CalendarIcon className="w-5 h-5 text-gray-500" />
                    <span className="font-medium">
                      {new Date(day.date).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="success" size="sm">
                      P: {day.records.filter((r: any) => r.status === 'PRESENT').length}
                    </Badge>
                    <Badge variant="danger" size="sm">
                      A: {day.records.filter((r: any) => r.status === 'ABSENT').length}
                    </Badge>
                    <Badge variant="warning" size="sm">
                      L: {day.records.filter((r: any) => r.status === 'LATE').length}
                    </Badge>
                    <ChevronRightIcon className={`w-5 h-5 transition-transform ${selectedDate === day.date ? 'rotate-90' : ''}`} />
                  </div>
                </button>
                
                {selectedDate === day.date && (
                  <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-900/50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Student</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Admission No</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {day.records.map((record: any) => (
                          <tr key={record.studentId} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{record.studentName}</td>
                            <td className="px-4 py-2 text-sm text-gray-500">{record.admissionNo}</td>
                            <td className="px-4 py-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {getStatusIcon(record.status)}
                                <span>{record.status}</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              No attendance records found for this period
            </div>
          )}
        </div>
      </Card>

      {/* Student Attendance Summary Table */}
      <Card title="Student Attendance Summary">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Present</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Absent</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Late</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total Days</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {summary?.studentStats && Object.values(summary.studentStats).map((student: any) => (
                <tr key={student.admissionNo} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{student.name}</td>
                  <td className="px-4 py-3 text-center text-sm text-green-600">{student.present}</td>
                  <td className="px-4 py-3 text-center text-sm text-red-600">{student.absent}</td>
                  <td className="px-4 py-3 text-center text-sm text-yellow-600">{student.late}</td>
                  <td className="px-4 py-3 text-center text-sm text-gray-600">{student.totalDays}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={student.attendanceRate >= 75 ? 'success' : student.attendanceRate >= 50 ? 'warning' : 'danger'}>
                      {student.attendanceRate}%
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};