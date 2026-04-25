import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { Badge } from '../components/ui/Badge';
import toast from 'react-hot-toast';
import api from '../services/api';

interface Student {
  id: string;
  name: string;
  admissionNo: string;
  averageScore: number;
  gradeLetter: string;
  attendanceRate: number;
}

export const ClassTeacherComments = () => {
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [selectedTerm, setSelectedTerm] = useState<string>('');
  const [comment, setComment] = useState('');
  const [commentType, setCommentType] = useState('GENERAL');
  const queryClient = useQueryClient();

  // Fetch students
  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ['class-teacher-students-performance'],
    queryFn: async () => {
      const response = await api.get('/class-teacher/students-performance');
      return response.data.data;
    },
  });

  // Fetch terms
  const { data: termsData } = useQuery({
    queryKey: ['terms'],
    queryFn: async () => {
      const response = await api.get('/terms');
      return response.data.data;
    },
  });

  // Fetch existing comments
  const { data: commentsData, refetch: refetchComments } = useQuery({
    queryKey: ['class-teacher-comments', selectedStudent, selectedTerm],
    queryFn: async () => {
      if (!selectedStudent || !selectedTerm) return [];
      const response = await api.get(`/class-teacher/comments/${selectedStudent}?termId=${selectedTerm}`);
      return response.data.data;
    },
    enabled: !!selectedStudent && !!selectedTerm,
  });

  // Save comment mutation
  const saveCommentMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/class-teacher/comments', {
        studentId: selectedStudent,
        termId: selectedTerm,
        comment,
        type: commentType,
      });
      return response.data;
    },
    onSuccess: () => {
      refetchComments();
      toast.success('Comment saved successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to save comment');
    },
  });

  const handleStudentSelect = (studentId: string) => {
    setSelectedStudent(studentId);
    if (commentsData && commentsData.length > 0) {
      setComment(commentsData[0]?.comment || '');
    } else {
      setComment('');
    }
  };

  const handleSave = () => {
    if (!selectedStudent) {
      toast.error('Please select a student');
      return;
    }
    if (!selectedTerm) {
      toast.error('Please select a term');
      return;
    }
    if (!comment.trim()) {
      toast.error('Please enter a comment');
      return;
    }
    saveCommentMutation.mutate();
  };

  if (studentsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const students = studentsData?.students || [];
  const terms = termsData || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Report Card Comments</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Add termly comments for students in your class
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student Selection Panel */}
        <Card title="Select Student">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Select Term
              </label>
              <select
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
              >
                <option value="">Select a term</option>
                {terms.map((term: any) => (
                  <option key={term.id} value={term.id}>
                    {term.name} - {term.session?.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {students.map((student: Student) => (
                <button
                  key={student.id}
                  onClick={() => handleStudentSelect(student.id)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedStudent === student.id
                      ? 'bg-indigo-50 dark:bg-indigo-950 border-indigo-200 dark:border-indigo-800'
                      : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="font-medium text-gray-900 dark:text-white">{student.name}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Adm: {student.admissionNo}
                  </div>
                  <div className="flex gap-2 mt-1">
                    <Badge variant={student.gradeLetter === 'A' ? 'success' : 'info'} size="sm">
                      Avg: {student.averageScore}%
                    </Badge>
                    <Badge variant="default" size="sm">
                      Attendance: {student.attendanceRate}%
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Comment Entry Panel */}
        <Card title="Add Comment" className="lg:col-span-2">
          {selectedStudent && selectedTerm ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Comment Type
                </label>
                <select
                  value={commentType}
                  onChange={(e) => setCommentType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                >
                  <option value="GENERAL">General Comment</option>
                  <option value="STRENGTH">Strengths</option>
                  <option value="WEAKNESS">Areas for Improvement</option>
                  <option value="TEACHER_RECOMMENDATION">Teacher's Recommendation</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Comment
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter your comments about this student's performance..."
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  onClick={handleSave}
                  isLoading={saveCommentMutation.isPending}
                >
                  Save Comment
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              Please select a student and term to add a comment
            </div>
          )}
        </Card>
      </div>

      {/* Existing Comments Display */}
      {selectedStudent && selectedTerm && commentsData && commentsData.length > 0 && (
        <Card title="Previous Comments">
          <div className="space-y-3">
            {commentsData.map((comment: any) => (
              <div key={comment.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="info">{comment.type}</Badge>
                  <span className="text-xs text-gray-500">
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-gray-700 dark:text-gray-300">{comment.comment}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};