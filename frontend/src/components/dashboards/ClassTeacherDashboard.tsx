import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { dashboardService } from "../../services/dashboard.service";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Spinner } from "../ui/Spinner";
import { ArrowLeftIcon, UsersIcon, BookOpenIcon, CalendarIcon, ChartBarIcon } from "@heroicons/react/24/outline";

export const ClassTeacherDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("Fetching class teacher dashboard...");
        const response = await dashboardService.getClassTeacherDashboard();
        console.log("Response:", response);
        setData(response?.data || response);
      } catch (err) {
        console.error("Error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <h2 className="text-xl font-bold text-red-700 mb-2">Error</h2>
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => navigate("/dashboard")}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const myClass = data?.class;
  const students = data?.students || [];
  const stats = data?.class?.stats || {};

  if (!myClass) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <h2 className="text-xl font-bold text-yellow-700 mb-2">No Class Assigned</h2>
        <p className="text-yellow-600">You are not assigned as a class teacher.</p>
        <button
          onClick={() => navigate("/dashboard")}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-2 bg-white/20 rounded-lg hover:bg-white/30"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold">Class Teacher Dashboard</h1>
        </div>
        <div className="flex justify-between items-center">
          <div>
            <p className="text-indigo-100">Welcome, {user?.name?.split(' ')[0] || 'Class Teacher'}</p>
            <p className="text-3xl font-bold mt-2">{myClass.name}</p>
          </div>
          <Badge variant="default" className="bg-white/20 text-white border-0 px-4 py-2">
            {myClass.totalStudents || 0} Students
          </Badge>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <div className="text-center">
            <UsersIcon className="w-8 h-8 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{myClass.totalStudents || 0}</p>
            <p className="text-sm text-gray-600">Total Students</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <BookOpenIcon className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{myClass.subjects?.length || 0}</p>
            <p className="text-sm text-gray-600">Subjects</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <CalendarIcon className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{stats.attendanceRate || 0}%</p>
            <p className="text-sm text-gray-600">Attendance Rate</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <ChartBarIcon className="w-8 h-8 text-purple-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{myClass.classAverage || 0}%</p>
            <p className="text-sm text-gray-600">Class Average</p>
          </div>
        </Card>
      </div>

      {/* Students List */}
      <Card title={`Students (${students.length})`}>
        {students.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">#</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Admission No</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Attendance</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Avg Score</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student, index) => (
                  <tr key={student.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">{index + 1}</td>
                    <td className="px-4 py-3 font-medium">{student.name}</td>
                    <td className="px-4 py-3 text-sm">{student.admissionNo}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={student.attendanceRate >= 75 ? "success" : "danger"}>
                        {student.attendanceRate}%
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={student.averageScore >= 50 ? "success" : "danger"}>
                        {student.averageScore}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No students found in this class</p>
        )}
      </Card>
    </div>
  );
};

export default ClassTeacherDashboard;
