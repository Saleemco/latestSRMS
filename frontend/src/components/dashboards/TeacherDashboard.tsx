import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext";
import { useTerm } from "../../context/TermContext";
import { dashboardService } from "../../services/dashboard.service";
import { SearchBar } from "../ui/SearchBar";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Spinner } from "../ui/Spinner";
import {
  UsersIcon,
  BookOpenIcon,
  AcademicCapIcon,
  CalendarIcon,
  ChartBarIcon,
  PlusIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { CombinedGradeEntryModal } from "../teachers/CombinedGradeEntryModal";
import { AttendanceMarker } from "../teachers/AttendanceMarker";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/Tabs";
import toast from "react-hot-toast";

export const TeacherDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { terms, selectedTerm, selectedSession } = useTerm();
  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  const [gradeSearchTerm, setGradeSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["teacher-dashboard"],
    queryFn: dashboardService.getTeacherDashboard,
  });

  // Check if user is also a class teacher
  const { data: classTeacherData } = useQuery({
    queryKey: ["class-teacher-status"],
    queryFn: () => dashboardService.getClassTeacherDashboard(),
    retry: false,
    enabled: true,
  });

  const isClassTeacher = classTeacherData?.data?.hasClass === true || classTeacherData?.hasClass === true;

  const getTeacherName = () => {
    if (!user) return "Teacher";
    if (user.firstName) return user.firstName;
    if (user.name) return user.name;
    if (user.email) return user.email.split('@')[0];
    return "Teacher";
  };

  const students = data?.students || [];
  const grades = data?.recentGrades || [];
  const teacher = data?.teacher || { name: "", subjects: [], classes: [] };
  const stats = data?.stats || {
    totalStudents: 0,
    totalClasses: 0,
    totalSubjects: 0,
    todayAttendance: 0,
  };
  
  const filteredStudents = useMemo(() => {
    if (!studentSearchTerm) return students;
    const term = studentSearchTerm.toLowerCase();
    return students.filter((student: any) =>
      student.name?.toLowerCase().includes(term) ||
      student.admissionNo?.toLowerCase().includes(term) ||
      student.className?.toLowerCase().includes(term)
    );
  }, [students, studentSearchTerm]);
  
  const filteredGrades = useMemo(() => {
    if (!gradeSearchTerm) return grades;
    const term = gradeSearchTerm.toLowerCase();
    return grades.filter((grade: any) =>
      grade.studentName?.toLowerCase().includes(term) ||
      grade.subjectName?.toLowerCase().includes(term)
    );
  }, [grades, gradeSearchTerm]);

  const groupedGrades = useMemo(() => {
    const grouped = filteredGrades.reduce((acc: any, grade: any) => {
      const key = `${grade.studentName}-${grade.subjectName}`;
      if (!acc[key]) {
        acc[key] = {
          studentName: grade.studentName,
          subjectName: grade.subjectName,
          ca: null,
          exam: null,
          createdAt: grade.createdAt
        };
      }
      if (grade.type === 'CA') {
        acc[key].ca = grade.score;
      } else if (grade.type === 'EXAM') {
        acc[key].exam = grade.score;
      }
      return acc;
    }, {});
    return Object.values(grouped);
  }, [filteredGrades]);

  const handleCombinedGradeSubmit = async (gradeData: { 
    studentId: string; 
    subjectId: string; 
    termId: string;
    ca: any; 
    exam: any;
  }) => {
    try {
      if (!gradeData.studentId) {
        toast.error("Student ID is missing");
        return;
      }
      if (!gradeData.subjectId) {
        toast.error("Subject ID is missing");
        return;
      }
      if (!gradeData.termId) {
        toast.error("Term is required");
        return;
      }
      if (!gradeData.ca || !gradeData.exam) {
        toast.error("Both CA and Exam grades are required");
        return;
      }
      
      const caGrade = {
        ...gradeData.ca,
        studentId: gradeData.studentId,
        subjectId: gradeData.subjectId,
        termId: gradeData.termId,
        type: "CA",
        category: "CA"
      };
      
      const examGrade = {
        ...gradeData.exam,
        studentId: gradeData.studentId,
        subjectId: gradeData.subjectId,
        termId: gradeData.termId,
        type: "EXAM",
        category: "EXAM"
      };
      
      await dashboardService.submitGrade(caGrade);
      await dashboardService.submitGrade(examGrade);
      
      toast.success("Both CA and Exam grades submitted successfully!");
      refetch();
      setShowGradeModal(false);
      setSelectedStudent(null);
    } catch (error: any) {
      console.error("Grade submission error:", error);
      toast.error(error.message || "Failed to submit grades");
    }
  };

  const handleAttendanceSubmit = async (attendanceData: any) => {
    try {
      await dashboardService.submitAttendance(attendanceData);
      toast.success("Attendance recorded successfully!");
      refetch();
      setShowAttendanceModal(false);
    } catch (error) {
      toast.error("Failed to record attendance");
      console.error("Attendance submission error:", error);
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
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <p>Error loading dashboard: {error.message}</p>
      </div>
    );
  }

  const statsCards = [
    { name: "My Students", value: stats.totalStudents, icon: UsersIcon, color: "bg-blue-500" },
    { name: "My Classes", value: stats.totalClasses, icon: AcademicCapIcon, color: "bg-green-500" },
    { name: "Subjects", value: stats.totalSubjects, icon: BookOpenIcon, color: "bg-purple-500" },
    { name: "Today's Attendance", value: stats.todayAttendance, icon: CalendarIcon, color: "bg-yellow-500" },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header Section - Mobile Friendly */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Teacher Dashboard</h1>
          <p className="text-sm sm:text-base text-gray-600">Welcome back, {getTeacherName()}!</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {isClassTeacher && (
            <button
              onClick={() => navigate("/dashboard/class-teacher")}
              className="flex items-center justify-center gap-1 sm:gap-2 px-3 py-2 sm:px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm sm:text-base"
            >
              <AcademicCapIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden xs:inline">Class Teacher View</span>
            </button>
          )}
          <button
            onClick={() => setShowAttendanceModal(true)}
            className="flex items-center justify-center gap-1 sm:gap-2 px-3 py-2 sm:px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm sm:text-base"
          >
            <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden xs:inline">Mark Attendance</span>
          </button>
          <button
            onClick={() => setShowGradeModal(true)}
            className="flex items-center justify-center gap-1 sm:gap-2 px-3 py-2 sm:px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm sm:text-base"
          >
            <PlusIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden xs:inline">Enter Grade</span>
          </button>
        </div>
      </div>

      {/* Stats Cards - Mobile Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {statsCards.map((card) => (
          <Card key={card.name} className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">{card.name}</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">{card.value.toLocaleString()}</p>
              </div>
              <div className={`p-2 sm:p-3 rounded-lg ${card.color}`}>
                <card.icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Tabs - Mobile Optimized */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
          <TabsTrigger value="students" className="text-xs sm:text-sm">My Students</TabsTrigger>
          <TabsTrigger value="grades" className="text-xs sm:text-sm">Grades</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 sm:mt-6">
          {/* My Classes & Subjects - Mobile Card Layout */}
          <Card title="My Classes & Subjects">
            <div className="space-y-3 sm:space-y-4">
              {teacher.classes && teacher.classes.length > 0 ? (
                teacher.classes
                  .sort((a: any, b: any) => {
                    const order = ['JSS 1', 'JSS 2', 'JSS 3', 'SSS 1', 'SSS 2', 'SSS 3'];
                    const indexA = order.indexOf(a.name);
                    const indexB = order.indexOf(b.name);
                    if (indexA === -1 && indexB === -1) return a.name.localeCompare(b.name);
                    if (indexA === -1) return 1;
                    if (indexB === -1) return -1;
                    return indexA - indexB;
                  })
                  .map((cls: any) => {
                    const studentsInClass = students.filter((s: any) => s.className === cls.name);
                    const subjectsInClass = teacher.subjects?.filter((sub: any) => 
                      sub.className === cls.name || sub.class?.name === cls.name
                    ) || [];
                    
                    return (
                      <div key={cls.id} className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100">
                          <div>
                            <h3 className="font-bold text-base sm:text-lg text-gray-900">{cls.name}</h3>
                            <p className="text-xs sm:text-sm text-gray-500">
                              {studentsInClass.length} students • {subjectsInClass.length} subjects
                            </p>
                          </div>
                          <Badge variant="success" className="text-xs">{cls.name}</Badge>
                        </div>
                        
                        {subjectsInClass.length > 0 ? (
                          <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
                            {subjectsInClass.map((subject: any) => (
                              <div 
                                key={subject.id} 
                                className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                              >
                                <span className="font-medium text-sm sm:text-base text-gray-800">{subject.name}</span>
                                <Badge variant="info" className="text-xs">
                                  {subject.subjectCode || subject.code || subject.name?.substring(0, 3)}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs sm:text-sm text-gray-400 italic">No subjects assigned to this class</p>
                        )}
                      </div>
                    );
                  })
              ) : (
                <p className="text-gray-500 text-center py-4">No classes assigned yet</p>
              )}
            </div>
          </Card>

          {/* Quick Actions - Mobile Grid */}
          <Card title="Quick Actions" className="mt-4 sm:mt-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
              <button
                onClick={() => setActiveTab("students")}
                className="flex items-center justify-between p-2 sm:p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <UsersIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                  <span className="font-medium text-xs sm:text-sm">View Students</span>
                </div>
                <span className="text-blue-600 text-xs sm:text-sm hidden xs:inline">{stats.totalStudents}</span>
              </button>
              <button
                onClick={() => setShowGradeModal(true)}
                className="flex items-center justify-between p-2 sm:p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <ChartBarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                  <span className="font-medium text-xs sm:text-sm">Enter Grades</span>
                </div>
              </button>
              <button
                onClick={() => navigate("/teacher-results")}
                className="flex items-center justify-between p-2 sm:p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <ClipboardDocumentListIcon className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                  <span className="font-medium text-xs sm:text-sm">View Results</span>
                </div>
              </button>
              <button
                onClick={() => navigate("/teacher/report-card")}
                className="flex items-center justify-between p-2 sm:p-3 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <DocumentTextIcon className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                  <span className="font-medium text-xs sm:text-sm">Report Card</span>
                </div>
              </button>
              <button
                onClick={() => setShowAttendanceModal(true)}
                className="flex items-center justify-between p-2 sm:p-3 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors"
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600" />
                  <span className="font-medium text-xs sm:text-sm">Attendance</span>
                </div>
              </button>
            </div>
          </Card>

          {/* Recent Grades - Mobile Card Layout */}
          <Card title="Recent Grades Entered" className="mt-4 sm:mt-6">
            <div className="space-y-3 sm:space-y-4">
              <SearchBar
                onSearch={setGradeSearchTerm}
                placeholder="Search grades..."
              />
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {groupedGrades.length > 0 ? (
                  groupedGrades.map((group: any, index: number) => {
                    const caScore = group.ca || 0;
                    const examScore = group.exam || 0;
                    const totalScore = caScore + examScore;
                    const hasBoth = group.ca !== null && group.exam !== null;
                    
                    return (
                      <div key={index} className="p-3 sm:p-4 bg-gray-50 rounded-lg">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 sm:mb-3 gap-1">
                          <div>
                            <p className="font-bold text-gray-900 text-sm sm:text-base">{group.studentName}</p>
                            <p className="text-xs sm:text-sm text-gray-500">{group.subjectName}</p>
                          </div>
                          {hasBoth && (
                            <div className="text-left sm:text-right">
                              <span className={"px-2 py-1 text-xs sm:text-sm font-bold rounded-full " + (
                                totalScore >= 70 ? "bg-green-100 text-green-700" :
                                totalScore >= 50 ? "bg-yellow-100 text-yellow-700" :
                                "bg-red-100 text-red-700"
                              )}>
                                Total: {totalScore}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 sm:gap-3">
                          <div className="text-center p-2 bg-blue-50 rounded-lg">
                            <p className="text-xs text-gray-500 uppercase">CA</p>
                            <p className="text-base sm:text-lg font-bold text-blue-600">
                              {group.ca !== null ? group.ca : '-'}
                            </p>
                            <p className="text-xs text-gray-400">40%</p>
                          </div>
                          <div className="text-center p-2 bg-purple-50 rounded-lg">
                            <p className="text-xs text-gray-500 uppercase">EXAM</p>
                            <p className="text-base sm:text-lg font-bold text-purple-600">
                              {group.exam !== null ? group.exam : '-'}
                            </p>
                            <p className="text-xs text-gray-400">60%</p>
                          </div>
                          <div className="text-center p-2 bg-green-50 rounded-lg">
                            <p className="text-xs text-gray-500 uppercase">Total</p>
                            <p className="text-base sm:text-lg font-bold text-green-600">
                              {hasBoth ? totalScore : '-'}
                            </p>
                            <p className="text-xs text-gray-400">100%</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-6 sm:py-8">
                    <ChartBarIcon className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm sm:text-base text-gray-500">
                      {gradeSearchTerm ? "No grades found" : "No grades entered yet"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="students" className="mt-4 sm:mt-6">
          <Card title="My Students">
            <div className="space-y-3 sm:space-y-4">
              <SearchBar
                onSearch={setStudentSearchTerm}
                placeholder="Search students..."
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 max-h-96 overflow-y-auto">
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((student: any) => (
                    <div key={student.id} className="p-2 sm:p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm sm:text-base truncate">{student.name}</p>
                          <p className="text-xs text-gray-500 truncate">Admission: {student.admissionNo}</p>
                          <p className="text-xs text-gray-400 truncate">{student.className}</p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedStudent(student);
                            setShowGradeModal(true);
                          }}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 ml-2 flex-shrink-0"
                        >
                          Add Grade
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4 col-span-2 text-sm">
                    {studentSearchTerm ? "No students found" : "No students assigned"}
                  </p>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="grades" className="mt-4 sm:mt-6">
          <Card title="All Grades">
            <div className="space-y-3 sm:space-y-4">
              <SearchBar
                onSearch={setGradeSearchTerm}
                placeholder="Search grades..."
              />
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {groupedGrades.length > 0 ? (
                  groupedGrades.map((group: any, index: number) => {
                    const caScore = group.ca || 0;
                    const examScore = group.exam || 0;
                    const totalScore = caScore + examScore;
                    const hasBoth = group.ca !== null && group.exam !== null;
                    
                    return (
                      <div key={index} className="p-3 sm:p-4 bg-gray-50 rounded-lg">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 sm:mb-3 gap-1">
                          <div>
                            <p className="font-bold text-gray-900 text-sm sm:text-base">{group.studentName}</p>
                            <p className="text-xs sm:text-sm text-gray-500">{group.subjectName}</p>
                            <p className="text-xs text-gray-400 mt-1">{new Date(group.createdAt).toLocaleDateString()}</p>
                          </div>
                          {hasBoth && (
                            <div className="text-left sm:text-right">
                              <span className={"px-2 py-1 text-xs sm:text-sm font-bold rounded-full " + (
                                totalScore >= 70 ? "bg-green-100 text-green-700" :
                                totalScore >= 50 ? "bg-yellow-100 text-yellow-700" :
                                "bg-red-100 text-red-700"
                              )}>
                                Total: {totalScore}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 sm:gap-3">
                          <div className="text-center p-2 bg-blue-50 rounded-lg">
                            <p className="text-xs text-gray-500 uppercase">CA</p>
                            <p className="text-base sm:text-lg font-bold text-blue-600">
                              {group.ca !== null ? group.ca : '-'}
                            </p>
                            <p className="text-xs text-gray-400">40%</p>
                          </div>
                          <div className="text-center p-2 bg-purple-50 rounded-lg">
                            <p className="text-xs text-gray-500 uppercase">EXAM</p>
                            <p className="text-base sm:text-lg font-bold text-purple-600">
                              {group.exam !== null ? group.exam : '-'}
                            </p>
                            <p className="text-xs text-gray-400">60%</p>
                          </div>
                          <div className="text-center p-2 bg-green-50 rounded-lg">
                            <p className="text-xs text-gray-500 uppercase">Total</p>
                            <p className="text-base sm:text-lg font-bold text-green-600">
                              {hasBoth ? totalScore : '-'}
                            </p>
                            <p className="text-xs text-gray-400">100%</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-6 sm:py-8">
                    <ChartBarIcon className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm sm:text-base text-gray-500">No grades entered yet</p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <CombinedGradeEntryModal
        isOpen={showGradeModal}
        onClose={() => {
          setShowGradeModal(false);
          setSelectedStudent(null);
        }}
        onSubmit={handleCombinedGradeSubmit}
        students={students}
        subjects={teacher.subjects}
        selectedStudent={selectedStudent}
      />

      <AttendanceMarker
        isOpen={showAttendanceModal}
        onClose={() => setShowAttendanceModal(false)}
        onSubmit={handleAttendanceSubmit}
        students={students}
      />
    </div>
  );
};

export default TeacherDashboard;
