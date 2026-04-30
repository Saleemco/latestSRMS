import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from "./context/AuthContext";
import { TermProvider } from "./context/TermContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Students from "./pages/Students";
import Teachers from "./pages/Teachers";
import Classes from "./pages/Classes";
import Subjects from "./pages/Subjects";
import Results from "./pages/Results";
import Fees from "./pages/Fees";
import ParentFees from "./pages/ParentFees";
import TermManagement from "./components/admin/terms/TermManagement";
import SessionManagement from "./components/admin/SessionManagement";
import ClassTeacherAssignment from "./components/admin/ClassTeacherAssignment";
import NotFound from "./pages/NotFound";
import TeacherResults from "./pages/TeacherResults";
import ReportCard from "./pages/ReportCard";
import ParentReportCard from "./pages/ParentReportCard";
import { ClassTeacherDashboard } from "./components/dashboards/ClassTeacherDashboard";
import ClassTeacherStudents from "./pages/ClassTeacherStudents";
import Parents from "./pages/Parents";
import { ClassTeacherAttendance } from "./pages/ClassTeacherAttendance";
import { AttendanceHistory } from "./pages/AttendanceHistory";
import { ClassTeacherComments } from "./pages/ClassTeacherComments";
import { ClassTeacherPerformance } from "./pages/ClassTeacherPerformance";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <ThemeProvider>
          <AuthProvider>
            <TermProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                
                <Route path="/" element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }>
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  
                  {/* Class Teacher Dashboard */}
                  <Route path="dashboard/class-teacher" element={
                    <ProtectedRoute allowedRoles={['TEACHER', 'CLASS_TEACHER', 'ADMIN', 'PRINCIPAL']}>
                      <ClassTeacherDashboard />
                    </ProtectedRoute>
                  } />
                  
                  {/* Class Teacher Routes */}
                  <Route path="class-teacher/students" element={
                    <ProtectedRoute allowedRoles={['CLASS_TEACHER']}>
                      <ClassTeacherStudents />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="class-teacher/attendance" element={
                    <ProtectedRoute allowedRoles={['CLASS_TEACHER']}>
                      <ClassTeacherAttendance />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="attendance-history" element={
                    <ProtectedRoute allowedRoles={['CLASS_TEACHER']}>
                      <AttendanceHistory />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="class-teacher/comments" element={
                    <ProtectedRoute allowedRoles={['CLASS_TEACHER']}>
                      <ClassTeacherComments />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="class-teacher/performance" element={
                    <ProtectedRoute allowedRoles={['CLASS_TEACHER']}>
                      <ClassTeacherPerformance />
                    </ProtectedRoute>
                  } />
                  
                  {/* General Routes */}
                  <Route path="students" element={<Students />} />
                  <Route path="teachers" element={<Teachers />} />
                  <Route path="parents" element={<Parents />} />
                  <Route path="classes" element={<Classes />} />
                  <Route path="subjects" element={<Subjects />} />
                  <Route path="results" element={<Results />} />
                  
                  {/* Teacher Results */}
                  <Route path="teacher-results" element={
                    <ProtectedRoute allowedRoles={['TEACHER', 'CLASS_TEACHER', 'ADMIN', 'PRINCIPAL']}>
                      <TeacherResults />
                    </ProtectedRoute>
                  } />
                  
                  {/* Report Card Routes */}
                  <Route path="teacher/report-card" element={
                    <ProtectedRoute allowedRoles={['TEACHER', 'CLASS_TEACHER', 'ADMIN', 'PRINCIPAL']}>
                      <ReportCard />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="parent/report-card" element={
                    <ProtectedRoute allowedRoles={['PARENT']}>
                      <ParentReportCard />
                    </ProtectedRoute>
                  } />
                  
                  {/* Fee Routes */}
                  <Route path="fees" element={<Fees />} />
                  
                  <Route path="parent-fees" element={
                    <ProtectedRoute allowedRoles={['PARENT']}>
                      <ParentFees />
                    </ProtectedRoute>
                  } />
                  
                  {/* Admin Routes */}
                  <Route path="admin/terms" element={
                    <ProtectedRoute allowedRoles={['ADMIN', 'PRINCIPAL']}>
                      <TermManagement />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="admin/sessions" element={
                    <ProtectedRoute allowedRoles={['ADMIN', 'PRINCIPAL']}>
                      <SessionManagement />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="admin/class-teacher-assignment" element={
                    <ProtectedRoute allowedRoles={['ADMIN', 'PRINCIPAL']}>
                      <ClassTeacherAssignment />
                    </ProtectedRoute>
                  } />
                </Route>
                
                <Route path="*" element={<NotFound />} />
              </Routes>
            </TermProvider>
          </AuthProvider>
        </ThemeProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;