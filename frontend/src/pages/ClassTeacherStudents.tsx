import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { dashboardService } from "../services/dashboard.service";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Spinner } from "../components/ui/Spinner";
import { SearchBar } from "../components/ui/SearchBar";
import { ArrowLeftIcon, UserGroupIcon } from "@heroicons/react/24/outline";

const ClassTeacherStudents = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [className, setClassName] = useState("");

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        console.log("Fetching class teacher students...");
        // Use the dashboard service to get class teacher data first
        const dashboardData = await dashboardService.getClassTeacherDashboard();
        console.log("Dashboard data:", dashboardData);
        
        // Extract students from the dashboard data
        const studentsList = dashboardData?.data?.students || dashboardData?.students || [];
        const classInfo = dashboardData?.data?.class || dashboardData?.class;
        
        setStudents(studentsList);
        if (classInfo?.name) {
          setClassName(classInfo.name);
        }
      } catch (error) {
        console.error("Error fetching students:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, []);

  const filteredStudents = students.filter(student =>
    student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.admissionNo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/dashboard/class-teacher")}
          className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Homeroom Students</h1>
          <p className="text-gray-600">Class: {className || "Loading..."}</p>
        </div>
      </div>

      <Card>
        <div className="space-y-4">
          <SearchBar
            onSearch={setSearchTerm}
            placeholder="Search by name or admission number..."
          />
          
          {students.length === 0 ? (
            <div className="text-center py-8">
              <UserGroupIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No students found in your homeroom class</p>
              <p className="text-sm text-gray-400 mt-2">Make sure you are assigned as a class teacher for a class</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">#</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Student Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Admission No</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">Attendance</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">Avg Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredStudents.map((student, index) => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{student.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{student.admissionNo}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={student.attendanceRate >= 75 ? "success" : "danger"}>
                          {student.attendanceRate || 0}%
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={student.averageScore >= 50 ? "success" : "danger"}>
                          {student.averageScore || 0}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {filteredStudents.length !== students.length && (
            <p className="text-sm text-gray-500">
              Showing {filteredStudents.length} of {students.length} students
            </p>
          )}
        </div>
      </Card>
    </div>
  );
};

export default ClassTeacherStudents;
