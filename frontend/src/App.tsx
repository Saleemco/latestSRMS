import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from "./context/AuthContext";
import { TermProvider } from "./context/TermContext";
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
import Parents from "./pages/Parents";  // ADD THIS IMPORT

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
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
                
                {/* Class Teacher Dashboard Route */}
                <Route path="dashboard/class-teacher" element={
                  <ProtectedRoute allowedRoles={['TEACHER', 'CLASS_TEACHER', 'ADMIN', 'PRINCIPAL']}>
                    <ClassTeacherDashboard />
                  </ProtectedRoute>
                } />
                
                {/* Class Teacher Students Route - shows only homeroom students */}
                <Route path="class-teacher/students" element={
                  <ProtectedRoute allowedRoles={['CLASS_TEACHER']}>
                    <ClassTeacherStudents />
                  </ProtectedRoute>
                } />
                
                <Route path="students" element={<Students />} />
                <Route path="teachers" element={<Teachers />} />
                <Route path="parents" element={<Parents />} />  {/* ADD THIS ROUTE */}
                <Route path="classes" element={<Classes />} />
                <Route path="subjects" element={<Subjects />} />
                <Route path="results" element={<Results />} />
                
                {/* Teacher Results - accessible by ADMIN, PRINCIPAL, TEACHER, CLASS_TEACHER */}
                <Route path="teacher-results" element={
                  <ProtectedRoute allowedRoles={['TEACHER', 'CLASS_TEACHER', 'ADMIN', 'PRINCIPAL']}>
                    <TeacherResults />
                  </ProtectedRoute>
                } />
                
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
                
                <Route path="fees" element={<Fees />} />
                
                <Route path="parent-fees" element={
                  <ProtectedRoute allowedRoles={['PARENT']}>
                    <ParentFees />
                  </ProtectedRoute>
                } />
                
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
      </Router>
    </QueryClientProvider>
  );
}

export default App;