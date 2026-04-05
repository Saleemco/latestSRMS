import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../ui/Card';
import { Spinner } from '../ui/Spinner';
import { Badge } from '../ui/Badge';
import { SearchBar } from '../ui/SearchBar';
import { dashboardService } from '../../services/dashboard.service';
import { classService } from '../../services/class.service';
import toast from 'react-hot-toast';
// Use Heroicons instead of lucide-react since you already have them
import {
  UserGroupIcon,
  UserPlusIcon,
  UserMinusIcon,
  AcademicCapIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

interface ClassType {
  id: string;
  name: string;
  section: string;
  classTeacherId?: string | null;
  classTeacher?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  _count?: {
    students: number;
    subjects: number;
  };
}

interface TeacherType {
  id: string;
  name: string;
  email: string;
  currentClass: string | null;
}

export const ClassTeacherAssignment = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState<ClassType | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherType | null>(null);
  const [showTeacherList, setShowTeacherList] = useState(false);

  // Fetch all classes
  const { data: classes, isLoading: classesLoading, refetch: refetchClasses } = useQuery({
    queryKey: ['classes'],
    queryFn: classService.getAll,
  });

  // Fetch available teachers
  const { data: teachers, isLoading: teachersLoading, refetch: refetchTeachers } = useQuery({
    queryKey: ['available-teachers'],
    queryFn: dashboardService.getAvailableTeachers,
  });

  // Filter classes by search
  const filteredClasses = classes?.filter((cls: ClassType) =>
    cls.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Assign class teacher mutation
  const assignMutation = useMutation({
    mutationFn: ({ classId, teacherId }: { classId: string; teacherId: string }) =>
      dashboardService.assignClassTeacher(classId, teacherId),
    onSuccess: () => {
      toast.success('Class teacher assigned successfully!');
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['available-teachers'] });
      setSelectedClass(null);
      setSelectedTeacher(null);
      setShowTeacherList(false);
      refetchClasses();
      refetchTeachers();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to assign class teacher');
    },
  });

  // Remove class teacher mutation
  const removeMutation = useMutation({
    mutationFn: (classId: string) => dashboardService.removeClassTeacher(classId),
    onSuccess: () => {
      toast.success('Class teacher removed successfully!');
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['available-teachers'] });
      refetchClasses();
      refetchTeachers();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to remove class teacher');
    },
  });

  const handleAssign = (classData: ClassType) => {
    setSelectedClass(classData);
    setShowTeacherList(true);
  };

  const handleSelectTeacher = (teacher: TeacherType) => {
    setSelectedTeacher(teacher);
  };

  const handleConfirmAssign = () => {
    if (selectedClass && selectedTeacher) {
      assignMutation.mutate({
        classId: selectedClass.id,
        teacherId: selectedTeacher.id,
      });
    }
  };

  const handleRemove = (classData: ClassType) => {
    if (window.confirm(`Are you sure you want to remove the class teacher for ${classData.name}?`)) {
      removeMutation.mutate(classData.id);
    }
  };

  const getStudentCount = (cls: ClassType) => {
    return cls._count?.students || 0;
  };

  const getClassName = (cls: ClassType) => {
    return cls.section ? `${cls.name} ${cls.section}` : cls.name;
  };

  // Show loading state
  if (classesLoading || teachersLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const totalClasses = classes?.length || 0;
  const withClassTeacher = classes?.filter((c: ClassType) => c.classTeacher).length || 0;
  const withoutClassTeacher = totalClasses - withClassTeacher;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Class Teacher Assignment</h1>
          <p className="text-gray-600">Assign teachers as class teachers for each class</p>
        </div>
        <button
          onClick={() => {
            refetchClasses();
            refetchTeachers();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <ArrowPathIcon className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <AcademicCapIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Classes</p>
              <p className="text-2xl font-bold text-gray-900">{totalClasses}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <UserGroupIcon className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">With Class Teacher</p>
              <p className="text-2xl font-bold text-green-600">{withClassTeacher}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <UserMinusIcon className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Without Class Teacher</p>
              <p className="text-2xl font-bold text-yellow-600">{withoutClassTeacher}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <div className="space-y-4">
          <SearchBar
            onSearch={setSearchTerm}
            placeholder="Search classes by name..."
          />
        </div>
      </Card>

      {/* Classes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClasses && filteredClasses.length > 0 ? (
          filteredClasses.map((cls: ClassType) => (
            <Card key={cls.id} className="hover:shadow-md transition-shadow">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{getClassName(cls)}</h3>
                    <p className="text-xs text-gray-400">{getStudentCount(cls)} students</p>
                  </div>
                  <Badge variant={cls.classTeacher ? 'success' : 'secondary'}>
                    {cls.classTeacher ? 'Assigned' : 'Unassigned'}
                  </Badge>
                </div>

                {cls.classTeacher ? (
                  <div className="bg-green-50 p-3 rounded-lg">
                    <p className="text-sm text-green-700 font-medium">Class Teacher</p>
                    <p className="font-semibold text-gray-900">
                      {cls.classTeacher.firstName} {cls.classTeacher.lastName}
                    </p>
                    <p className="text-xs text-gray-500">{cls.classTeacher.email}</p>
                  </div>
                ) : (
                  <div className="bg-yellow-50 p-3 rounded-lg">
                    <p className="text-sm text-yellow-700">No class teacher assigned</p>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  {cls.classTeacher ? (
                    <button
                      onClick={() => handleRemove(cls)}
                      disabled={removeMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50"
                    >
                      <UserMinusIcon className="w-4 h-4" />
                      Remove
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAssign(cls)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                    >
                      <UserPlusIcon className="w-4 h-4" />
                      Assign Class Teacher
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))
        ) : (
          <div className="col-span-full text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
            <AcademicCapIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Classes Found</h3>
            <p className="text-gray-500">
              {searchTerm ? 'No classes match your search criteria.' : 'No classes have been created yet.'}
            </p>
          </div>
        )}
      </div>

      {/* Teacher Selection Modal */}
      {showTeacherList && selectedClass && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Assign Class Teacher</h2>
                <p className="text-gray-600 mt-1">
                  Select a teacher to be the class teacher for <strong>{getClassName(selectedClass)}</strong>
                </p>
              </div>
              <button
                onClick={() => {
                  setShowTeacherList(false);
                  setSelectedTeacher(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="space-y-3">
                {teachers && teachers.length > 0 ? (
                  teachers
                    .filter((t: TeacherType) => t.currentClass !== getClassName(selectedClass))
                    .map((teacher: TeacherType) => (
                      <div
                        key={teacher.id}
                        onClick={() => handleSelectTeacher(teacher)}
                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                          selectedTeacher?.id === teacher.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-900">{teacher.name}</p>
                            <p className="text-sm text-gray-500">{teacher.email}</p>
                          </div>
                          {teacher.currentClass && (
                            <Badge variant="warning" className="text-xs">
                              Currently: {teacher.currentClass}
                            </Badge>
                          )}
                          {selectedTeacher?.id === teacher.id && (
                            <CheckCircleIcon className="w-5 h-5 text-blue-600" />
                          )}
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="text-center py-8">
                    <UserGroupIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No teachers available</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Please add teachers first before assigning class teachers.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowTeacherList(false);
                  setSelectedTeacher(null);
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAssign}
                disabled={!selectedTeacher || assignMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {assignMutation.isPending ? (
                  <>
                    <Spinner size="sm" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <UserPlusIcon className="w-4 h-4" />
                    Assign Class Teacher
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassTeacherAssignment;