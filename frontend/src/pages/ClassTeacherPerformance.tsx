// frontend/src/pages/ClassTeacherPerformance.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { 
  ChartBarIcon, 
  AcademicCapIcon, 
  TrophyIcon,
  UserGroupIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import api from '../services/api';

interface Subject {
  name: string;
  score: number;
  percentage: number;
  gradeLetter: string;
}

interface Student {
  id: string;
  name: string;
  admissionNo: string;
  averageScore: number;
  gradeLetter: string;
  attendanceRate: number;
  subjects: Subject[];
}

export const ClassTeacherPerformance = () => {
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['class-teacher-students-performance'],
    queryFn: async () => {
      const response = await api.get('/class-teacher/students-performance');
      if (response.data.success) {
        return response.data.data;
      }
      return response.data;
    },
  });

  const toggleExpand = (studentId: string) => {
    setExpandedStudent(expandedStudent === studentId ? null : studentId);
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-green-600 dark:text-green-400';
      case 'B': return 'text-blue-600 dark:text-blue-400';
      case 'C': return 'text-yellow-600 dark:text-yellow-400';
      case 'D': return 'text-orange-600 dark:text-orange-400';
      case 'E': return 'text-red-600 dark:text-red-400';
      default: return 'text-red-600 dark:text-red-400';
    }
  };

  const getAttendanceColor = (rate: number) => {
    if (rate >= 80) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    if (rate >= 60) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
  };

  const getPerformanceCategory = (score: number) => {
    if (score >= 70) return { label: 'Excellent', color: 'success' };
    if (score >= 60) return { label: 'Very Good', color: 'info' };
    if (score >= 50) return { label: 'Good', color: 'info' };
    if (score >= 45) return { label: 'Satisfactory', color: 'warning' };
    if (score >= 40) return { label: 'Pass', color: 'warning' };
    return { label: 'Needs Improvement', color: 'danger' };
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
      <div className="text-center py-12">
        <div className="text-red-600 dark:text-red-400">
          <AcademicCapIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="mb-4">Failed to load performance data. Please make sure you are assigned as a class teacher.</p>
          <Button onClick={() => refetch()} variant="secondary">
            <ArrowPathIcon className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const students: Student[] = data?.students || [];
  const className = data?.className || 'Your Class';
  const totalStudents = data?.totalStudents || 0;

  // Calculate class statistics
  const classAverage = students.length > 0 
    ? students.reduce((sum, s) => sum + s.averageScore, 0) / students.length 
    : 0;
  
  const gradeDistribution = {
    A: students.filter(s => s.gradeLetter === 'A').length,
    B: students.filter(s => s.gradeLetter === 'B').length,
    C: students.filter(s => s.gradeLetter === 'C').length,
    D: students.filter(s => s.gradeLetter === 'D').length,
    E: students.filter(s => s.gradeLetter === 'E').length,
    F: students.filter(s => s.gradeLetter === 'F').length,
  };

  const topPerformers = [...students].sort((a, b) => b.averageScore - a.averageScore).slice(0, 3);
  const needsAttention = students.filter(s => s.averageScore < 40).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Student Performance</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Class: {className} • {totalStudents} Students
          </p>
        </div>
        <Button onClick={() => refetch()} variant="secondary" size="sm">
          <ArrowPathIcon className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Class Average</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{classAverage.toFixed(1)}%</p>
            </div>
            <ChartBarIcon className="w-8 h-8 text-blue-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Pass Rate</p>
              <p className="text-2xl font-bold text-green-600">
                {students.filter(s => s.averageScore >= 40).length}/{totalStudents}
              </p>
            </div>
            <TrophyIcon className="w-8 h-8 text-green-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Excellent (70%+)</p>
              <p className="text-2xl font-bold text-purple-600">{gradeDistribution.A}</p>
            </div>
            <AcademicCapIcon className="w-8 h-8 text-purple-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Needs Attention</p>
              <p className="text-2xl font-bold text-red-600">{needsAttention}</p>
            </div>
            <UserGroupIcon className="w-8 h-8 text-red-500" />
          </div>
        </Card>
      </div>

      {/* Grade Distribution */}
      <Card title="Grade Distribution">
        <div className="space-y-3">
          {Object.entries(gradeDistribution).map(([grade, count]) => (
            <div key={grade} className="flex items-center gap-3">
              <div className="w-12 text-lg font-bold text-gray-700 dark:text-gray-300">{grade}</div>
              <div className="flex-1">
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full flex items-center justify-end px-2 text-sm text-white ${
                      grade === 'A' ? 'bg-green-500' :
                      grade === 'B' ? 'bg-blue-500' :
                      grade === 'C' ? 'bg-yellow-500' :
                      grade === 'D' ? 'bg-orange-500' :
                      grade === 'E' ? 'bg-red-400' : 'bg-red-600'
                    }`}
                    style={{ width: totalStudents > 0 ? `${(count / totalStudents) * 100}%` : '0%' }}
                  >
                    {count > 0 && count > 2 && `${count}`}
                  </div>
                </div>
              </div>
              <div className="w-24 text-sm text-gray-600 dark:text-gray-400">
                {totalStudents > 0 ? ((count / totalStudents) * 100).toFixed(1) : 0}%
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Top Performers */}
      {topPerformers.length > 0 && (
        <Card title="🏆 Top Performers">
          <div className="space-y-3">
            {topPerformers.map((student, index) => (
              <div key={student.id} className="flex items-center justify-between p-3 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-yellow-500 text-white flex items-center justify-center font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{student.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Adm: {student.admissionNo}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{student.averageScore.toFixed(1)}%</p>
                  <Badge variant="success">{student.gradeLetter}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Students Performance Table */}
      <Card title="All Students Performance">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Admission No</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Average</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Grade</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Attendance</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    No students found in your class
                  </td>
                </tr>
              ) : (
                students.map((student) => {
                  const performance = getPerformanceCategory(student.averageScore);
                  return (
                    <>
                      <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                          {student.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {student.admissionNo}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-semibold">{student.averageScore.toFixed(1)}%</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-lg font-bold ${getGradeColor(student.gradeLetter)}`}>
                            {student.gradeLetter}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAttendanceColor(student.attendanceRate)}`}>
                            {student.attendanceRate}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={performance.color as any}>
                            {performance.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => toggleExpand(student.id)}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          >
                            {expandedStudent === student.id ? (
                              <ChevronUpIcon className="w-5 h-5 text-gray-500" />
                            ) : (
                              <ChevronDownIcon className="w-5 h-5 text-gray-500" />
                            )}
                          </button>
                        </td>
                      </tr>
                      {expandedStudent === student.id && (
                        <tr className="bg-gray-50 dark:bg-gray-800/30">
                          <td colSpan={7} className="px-4 py-4">
                            <div className="space-y-3">
                              <p className="font-medium text-gray-700 dark:text-gray-300 mb-2">📚 Subject Breakdown:</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {student.subjects && student.subjects.length > 0 ? (
                                  student.subjects.map((subject, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        {subject.name}
                                      </span>
                                      <div className="flex items-center gap-3">
                                        <div className="w-16 text-right">
                                          <span className="text-sm text-gray-600 dark:text-gray-400">
                                            {subject.score}/{subject.percentage}%
                                          </span>
                                        </div>
                                        <div className="w-12 text-center">
                                          <span className={`text-sm font-bold ${getGradeColor(subject.gradeLetter)}`}>
                                            {subject.gradeLetter}
                                          </span>
                                        </div>
                                        <div className="w-16">
                                          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div 
                                              className="h-full bg-blue-500 rounded-full"
                                              style={{ width: `${subject.percentage}%` }}
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="col-span-2 text-center text-gray-500 py-4">
                                    No subject grades available yet
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};