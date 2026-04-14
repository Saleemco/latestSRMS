import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Spinner } from "../ui/Spinner";
import { SearchBar } from "../ui/SearchBar";
import { TrashIcon, PlusIcon, XMarkIcon, UsersIcon, UserGroupIcon, AcademicCapIcon } from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import api from "../../services/api";

export const AdminDashboard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [teacherSearchTerm, setTeacherSearchTerm] = useState("");
  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  const [parentSearchTerm, setParentSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "TEACHER",
    classIds: [] as string[],
    subjectIds: [] as string[],
  });

  // Fetch all users
  const { data: allUsers, isLoading, refetch } = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      const response = await api.get("/users");
      return response.data;
    },
  });

  // Fetch classes for teacher assignment
  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const response = await api.get("/classes");
      return response.data;
    },
  });

  // Fetch subjects for teacher assignment
  const { data: subjects } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const response = await api.get("/subjects");
      return response.data;
    },
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      const response = await api.post("/auth/register", userData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      setShowCreateModal(false);
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        role: "TEACHER",
        classIds: [],
        subjectIds: [],
      });
      toast.success("User created successfully!");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to create user");
    },
  });

  // Filter by role
  const teachers = useMemo(() => {
    return (allUsers || []).filter((u: any) => u.role === "TEACHER");
  }, [allUsers]);

  const students = useMemo(() => {
    return (allUsers || []).filter((u: any) => u.role === "STUDENT");
  }, [allUsers]);

  const parents = useMemo(() => {
    return (allUsers || []).filter((u: any) => u.role === "PARENT");
  }, [allUsers]);

  // Search filters
  const filteredTeachers = teachers.filter((teacher: any) =>
    teacher.name?.toLowerCase().includes(teacherSearchTerm.toLowerCase()) ||
    teacher.email?.toLowerCase().includes(teacherSearchTerm.toLowerCase())
  );

  const filteredStudents = students.filter((student: any) =>
    student.name?.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
    student.email?.toLowerCase().includes(studentSearchTerm.toLowerCase())
  );

  const filteredParents = parents.filter((parent: any) =>
    parent.name?.toLowerCase().includes(parentSearchTerm.toLowerCase()) ||
    parent.email?.toLowerCase().includes(parentSearchTerm.toLowerCase())
  );

  const handleCreateUser = () => {
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
      toast.error("Please fill in all required fields");
      return;
    }

    const userData: any = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      password: formData.password,
      role: formData.role,
    };

    // Add classIds and subjectIds only for TEACHER role
    if (formData.role === "TEACHER") {
      userData.classIds = formData.classIds;
      userData.subjectIds = formData.subjectIds;
    }

    createUserMutation.mutate(userData);
  };

  const handleClassToggle = (classId: string) => {
    setFormData(prev => ({
      ...prev,
      classIds: prev.classIds.includes(classId)
        ? prev.classIds.filter(id => id !== classId)
        : [...prev.classIds, classId]
    }));
  };

  const handleSubjectToggle = (subjectId: string) => {
    setFormData(prev => ({
      ...prev,
      subjectIds: prev.subjectIds.includes(subjectId)
        ? prev.subjectIds.filter(id => id !== subjectId)
        : [...prev.subjectIds, subjectId]
    }));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const roleOptions = [
    { value: "ADMIN", label: "Admin" },
    { value: "PRINCIPAL", label: "Principal" },
    { value: "TEACHER", label: "Teacher" },
    { value: "BURSAR", label: "Bursar" },
    { value: "PARENT", label: "Parent" },
    { value: "STUDENT", label: "Student" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600">Welcome back, {user?.name || 'Admin'}!</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <PlusIcon className="w-5 h-5" />
          Create User
        </button>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 sticky top-0 bg-white pb-2">
              <h2 className="text-xl font-bold text-gray-900">Create New User</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="First Name"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <input
                type="email"
                placeholder="Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              />

              <input
                type="password"
                placeholder="Password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              />

              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value, classIds: [], subjectIds: [] })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                {roleOptions.map((role) => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>

              {/* Classes Selection - Only for Teachers */}
              {formData.role === "TEACHER" && classes && classes.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assign Classes</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 border rounded-lg p-3 max-h-40 overflow-y-auto">
                    {classes.map((cls: any) => (
                      <label key={cls.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={formData.classIds.includes(cls.id)}
                          onChange={() => handleClassToggle(cls.id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>{cls.name}</span>
                      </label>
                    ))}
                  </div>
                  {formData.classIds.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">Selected: {formData.classIds.length} classes</p>
                  )}
                </div>
              )}

              {/* Subjects Selection - Only for Teachers */}
              {formData.role === "TEACHER" && subjects && subjects.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assign Subjects</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 border rounded-lg p-3 max-h-40 overflow-y-auto">
                    {subjects.map((subject: any) => (
                      <label key={subject.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={formData.subjectIds.includes(subject.id)}
                          onChange={() => handleSubjectToggle(subject.id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>{subject.name}</span>
                      </label>
                    ))}
                  </div>
                  {formData.subjectIds.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">Selected: {formData.subjectIds.length} subjects</p>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCreateUser}
                  disabled={createUserMutation.isPending}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {createUserMutation.isPending ? "Creating..." : "Create User"}
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Teachers</p>
              <p className="text-2xl font-bold text-blue-600">{teachers.length}</p>
            </div>
            <UserGroupIcon className="w-8 h-8 text-blue-500" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Students</p>
              <p className="text-2xl font-bold text-green-600">{students.length}</p>
            </div>
            <UsersIcon className="w-8 h-8 text-green-500" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Parents</p>
              <p className="text-2xl font-bold text-purple-600">{parents.length}</p>
            </div>
            <AcademicCapIcon className="w-8 h-8 text-purple-500" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{allUsers?.length || 0}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Teachers Section */}
      <Card title={`Teachers (${filteredTeachers.length})`}>
        <div className="space-y-4">
          <SearchBar onSearch={setTeacherSearchTerm} placeholder="Search teachers by name or email..." />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
            {filteredTeachers.length > 0 ? (
              filteredTeachers.map((teacher: any) => (
                <div key={teacher.id} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                  <p className="font-medium text-gray-900">{teacher.name}</p>
                  <p className="text-sm text-gray-500">{teacher.email}</p>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4 col-span-3">
                {teacherSearchTerm ? "No teachers found matching your search" : "No teachers in the system"}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Students Section */}
      <Card title={`Students (${filteredStudents.length})`}>
        <div className="space-y-4">
          <SearchBar onSearch={setStudentSearchTerm} placeholder="Search students by name or email..." />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
            {filteredStudents.length > 0 ? (
              filteredStudents.map((student: any) => (
                <div key={student.id} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                  <p className="font-medium text-gray-900">{student.name}</p>
                  <p className="text-sm text-gray-500">{student.email}</p>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4 col-span-3">
                {studentSearchTerm ? "No students found matching your search" : "No students in the system"}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Parents Section */}
      <Card title={`Parents (${filteredParents.length})`}>
        <div className="space-y-4">
          <SearchBar onSearch={setParentSearchTerm} placeholder="Search parents by name or email..." />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
            {filteredParents.length > 0 ? (
              filteredParents.map((parent: any) => (
                <div key={parent.id} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                  <p className="font-medium text-gray-900">{parent.name}</p>
                  <p className="text-sm text-gray-500">{parent.email}</p>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4 col-span-3">
                {parentSearchTerm ? "No parents found matching your search" : "No parents in the system"}
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AdminDashboard;