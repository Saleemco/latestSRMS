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
  CalendarIcon,
  ChartBarIcon,
  PlusIcon,
  ClipboardDocumentListIcon,
  PrinterIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  EyeIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline";
import { CombinedGradeEntryModal } from "../teachers/CombinedGradeEntryModal";
import { AttendanceMarker } from "../teachers/AttendanceMarker";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/Tabs";
import toast from "react-hot-toast";

export const ClassTeacherDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { terms, selectedTerm, selectedSession } = useTerm();
  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["class-teacher-dashboard"],
    queryFn: dashboardService.getClassTeacherDashboard,
    retry: 1,
  });

  const getTeacherName = () => {
    if (!user) return "Class Teacher";
    if (user.firstName) return user.firstName;
    if (user.name) return user.name;
    if (user.email) return user.email.split('@')[0];
    return "Class Teacher";
  };

  const myClass = data?.class;
  const students = data?.students || [];
  const todayAttendance = data?.todayAttendance || { 
    present: 0, absent: 0, late: 0, notMarked: 0, total: 0, percentage: 0 
  };
  const alerts = data?.alerts || { lowAttendance: [], lowPerformance: [], totalAlerts: 0 };
  const classSubjects = myClass?.subjects || [];

  const filteredStudents = useMemo(() => {
    if (!studentSearchTerm) return students;
    const term = studentSearchTerm.toLowerCase();
    return students.filter((student: any) =>
      student.name?.toLowerCase().includes(term) ||
      student.admissionNo?.toLowerCase().includes(term)
    );
  }, [students, studentSearchTerm]);

  const statsCards = [
    { name: "Total Students", value: myClass?.totalStudents || 0, icon: UsersIcon, color: "bg-blue-500" },
    { name: "Today's Attendance", value: `${todayAttendance.present}/${todayAttendance.total}`, icon: CalendarIcon, color: "bg-green-500", description: `${todayAttendance.percentage.toFixed(1)}% present` },
    { name: "Subjects", value: classSubjects.length, icon: BookOpenIcon, color: "bg-purple-500" },
    { name: "Class Average", value: myClass?.stats?.averageGrade || "N/A", icon: ChartBarIcon, color: "bg-yellow-500" },
  ];

  const handleCombinedGradeSubmit = async (gradeData: { 
    studentId: string; subjectId: string; termId: string; ca: any; exam: any;
  }) => {
    try {
      if (!gradeData.studentId || !gradeData.subjectId || !gradeData.termId) {
        toast.error("Missing required fields");
        return;
      }
      
      const caGrade = { ...gradeData.ca, studentId: gradeData.studentId, subjectId: gradeData.subjectId, termId: gradeData.termId, type: "CA", category: "CA" };
      const examGrade = { ...gradeData.exam, studentId: gradeData.studentId, subjectId: gradeData.subjectId, termId: gradeData.termId, type: "EXAM", category: "EXAM" };
      
      await dashboardService.submitGrade(caGrade);
      await dashboardService.submitGrade(examGrade);
      
      toast.success("Grades submitted successfully!");
      refetch();
      setShowGradeModal(false);
      setSelectedStudent(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to submit grades");
    }
  };

  const handleAttendanceSubmit = async (attendanceData: any) => {
    try {
      await dashboardService.markClassAttendance({
        date: attendanceData.date,
        attendances: attendanceData.attendances,
      });
      toast.success("Attendance recorded successfully!");
      refetch();
      setShowAttendanceModal(false);
    } catch (error) {
      toast.error("Failed to record attendance");
    }
  };

  const handleGenerateReportCards = async () => {
    try {
      toast.loading("Generating report cards...");
      await dashboardService.generateClassReportCards(myClass?.id);
      toast.dismiss();
      toast.success("Report cards generated!");
    } catch (error) {
      toast.dismiss();
      toast.error("Failed to generate report cards");
    }
  };

  const handleSendBulkNotification = async () => {
    try {
      toast.loading("Sending notifications...");
      await dashboardService.sendBulkParentNotification({
        classId: myClass?.id,
        message: "Please check your child's attendance and performance on the portal."
      });
      toast.dismiss();
      toast.success("Notifications sent to parents!");
    } catch (error) {
      toast.dismiss();
      toast.error("Failed to send notifications");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !myClass) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <ExclamationTriangleIcon className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Not Assigned as Class Teacher</h3>
        <p className="text-gray-600 mb-4">You are not currently assigned as a class teacher. Please contact the administrator.</p>
        <button 
          onClick={() => navigate("/dashboard/teacher")} 
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Go to Subject Teacher Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Class Info */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate("/dashboard/teacher")} 
              className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
              title="Switch to Subject Teacher View"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold">Class Teacher Dashboard</h1>
              <p className="text-indigo-100">Welcome back, Class Teacher {getTeacherName()}!</p>
            </div>
          </div>
          <Badge variant="white" className="text-lg px-4 py-2">{myClass.name}</Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div><p className="text-indigo-200 text-sm">Total Students</p><p className="text-2xl font-bold">{myClass.totalStudents}</p></div>
          <div><p className="text-indigo-200 text-sm">Today's Attendance</p><p className="text-2xl font-bold">{todayAttendance.percentage.toFixed(1)}%</p></div>
          <div><p className="text-indigo-200 text-sm">Class Average</p><p className="text-2xl font-bold">{myClass.stats?.averageGrade || 'N/A'}%</p></div>
          <div><p className="text-indigo-200 text-sm">Subjects</p><p className="text-2xl font-bold">{classSubjects.length}</p></div>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <button onClick={() => setShowAttendanceModal(true)} className="flex items-center justify-center gap-2 p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
          <CalendarIcon className="w-5 h-5" />Mark Attendance
        </button>
        <button onClick={() => setShowGradeModal(true)} className="flex items-center justify-center gap-2 p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <PlusIcon className="w-5 h-5" />Enter Grades
        </button>
        <button onClick={handleGenerateReportCards} className="flex items-center justify-center gap-2 p-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
          <PrinterIcon className="w-5 h-5" />Report Cards
        </button>
        <button onClick={handleSendBulkNotification} className="flex items-center justify-center gap-2 p-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
          <EnvelopeIcon className="w-5 h-5" />Notify Parents
        </button>
        <button onClick={() => navigate(`/class/${myClass.id}/results`)} className="flex items-center justify-center gap-2 p-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
          <ClipboardDocumentListIcon className="w-5 h-5" />View Results
        </button>
      </div>

      {/* Alert Section */}
      {alerts.totalAlerts > 0 && (
        <Card className="border-red-200 bg-red-50">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-800">Attention Needed</h3>
              {alerts.lowAttendance?.length > 0 && (
                <p className="text-sm text-red-700 mt-1">⚠️ {alerts.lowAttendance.length} student(s) have attendance below 75%</p>
              )}
              {alerts.lowPerformance?.length > 0 && (
                <p className="text-sm text-red-700">📉 {alerts.lowPerformance.length} student(s) have performance below 50%</p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((card) => (
          <Card key={card.name}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{card.name}</p>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                {card.description && <p className="text-xs text-gray-400 mt-1">{card.description}</p>}
              </div>
              <div className={`p-3 rounded-lg ${card.color}`}>
                <card.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Class Overview</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="Subjects in This Class">
              <div className="space-y-2">
                {classSubjects.length > 0 ? (
                  classSubjects.map((subject: any) => (
                    <div key={subject.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{subject.name}</p>
                        <p className="text-xs text-gray-500">Teacher: {subject.teacher || 'Not assigned'}</p>
                      </div>
                      <Badge variant="info">{subject.name}</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">No subjects assigned to this class</p>
                )}
              </div>
            </Card>

            <Card title="Today's Attendance">
              <div className="space-y-4">
                <div className="flex items-center justify-around">
                  <div className="text-center">
                    <CheckCircleIcon className="w-8 h-8 text-green-500 mx-auto" />
                    <p className="text-2xl font-bold text-green-600">{todayAttendance.present}</p>
                    <p className="text-xs text-gray-500">Present</p>
                  </div>
                  <div className="text-center">
                    <ClockIcon className="w-8 h-8 text-yellow-500 mx-auto" />
                    <p className="text-2xl font-bold text-yellow-600">{todayAttendance.late}</p>
                    <p className="text-xs text-gray-500">Late</p>
                  </div>
                  <div className="text-center">
                    <XCircleIcon className="w-8 h-8 text-red-500 mx-auto" />
                    <p className="text-2xl font-bold text-red-600">{todayAttendance.absent}</p>
                    <p className="text-xs text-gray-500">Absent</p>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${todayAttendance.percentage}%` }}
                  />
                </div>
                <p className="text-center text-sm text-gray-600">Attendance Rate: {todayAttendance.percentage.toFixed(1)}%</p>
                <button onClick={() => setShowAttendanceModal(true)} className="w-full py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200">
                  Mark/Update Attendance
                </button>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Students Tab */}
        <TabsContent value="students" className="mt-6">
          <Card title={`Students in ${myClass.name} (${students.length})`}>
            <div className="space-y-4">
              <SearchBar onSearch={setStudentSearchTerm} placeholder="Search students by name or admission number..." />
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">#</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Student Name</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Admission No</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Attendance</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Avg Score</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredStudents.map((student: any, index: number) => (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{student.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{student.admissionNo}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={parseFloat(student.attendanceRate) >= 75 ? "success" : "danger"} className="text-xs">
                            {student.attendanceRate}%
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={parseFloat(student.averageScore) >= 50 ? "success" : "danger"} className="text-xs">
                            {student.averageScore}%
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => { setSelectedStudent(student); setShowGradeModal(true); }} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Add Grade">
                            <PlusIcon className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance" className="mt-6">
          <Card title="Attendance Records">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Select Date:</label>
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
                <button onClick={() => setShowAttendanceModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Mark Attendance</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Student Name</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Admission No</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Overall Attendance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {students.map((student: any) => (
                      <tr key={student.id}>
                        <td className="px-4 py-3 text-sm text-gray-900">{student.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{student.admissionNo}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={parseFloat(student.attendanceRate) >= 90 ? "success" : parseFloat(student.attendanceRate) >= 75 ? "warning" : "danger"}>
                            {student.attendanceRate}% attendance
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <CombinedGradeEntryModal
        isOpen={showGradeModal}
        onClose={() => { setShowGradeModal(false); setSelectedStudent(null); }}
        onSubmit={handleCombinedGradeSubmit}
        students={students}
        subjects={classSubjects}
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

export default ClassTeacherDashboard;