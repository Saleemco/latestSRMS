import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext";
import { dashboardService } from "../../services/dashboard.service";
import { SearchBar } from "../ui/SearchBar";
import { useSearch } from "../../hooks/useSearch";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Spinner } from "../ui/Spinner";
import {
  UsersIcon,
  UserGroupIcon,
  AcademicCapIcon,
  BookOpenIcon,
  BookmarkIcon,
  CurrencyDollarIcon,
  PlusIcon,
  XMarkIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import api from "../../services/api";

export const AdminDashboard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [teacherSearchTerm, setTeacherSearchTerm] = useState("");
  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  const [parentSearchTerm, setParentSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "TEACHER",
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: dashboardService.getAdminDashboard,
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      const response = await api.post("/auth/register", userData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      setShowCreateModal(false);
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        role: "TEACHER",
      });
      toast.success("User created successfully!");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to create user");
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await api.delete(`/users/${userId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      setUserToDelete(null);
      toast.success("User deleted successfully!");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to delete user");
    },
  });

  const getAdminName = () => {
    if (!user) return "Admin";
    if (user.firstName) return user.firstName;
    if (user.name) return user.name;
    if (user.email) return user.email.split('@')[0];
    return "Admin";
  };

  const teachers = data?.teachers || [];
  const students = data?.students || [];
  const recentUsers = data?.recentUsers || [];
  const recentParents = data?.recentParents || [];
  
  const filteredTeachers = useSearch(
    teachers,
    ['name', 'email'],
    (teacher: any, term: string) => {
      return teacher.name?.toLowerCase().includes(term) ||
             teacher.email?.toLowerCase().includes(term);
    }
  );
  
  const filteredStudents = useSearch(
    students,
    ['name', 'admissionNo', 'className'],
    (student: any, term: string) => {
      return student.name?.toLowerCase().includes(term) ||
             student.admissionNo?.toLowerCase().includes(term) ||
             student.className?.toLowerCase().includes(term);
    }
  );
  
  const filteredParents = useSearch(
    recentParents,
    ['name', 'email'],
    (parent: any, term: string) => {
      return parent.name?.toLowerCase().includes(term) ||
             parent.email?.toLowerCase().includes(term);
    }
  );

  const handleCreateUser = () => {
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
      toast.error("Please fill in all required fields");
      return;
    }

    createUserMutation.mutate({
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      password: formData.password,
      role: formData.role,
    });
  };

  const handleDeleteClick = (user: any) => {
    if (user.role === "ADMIN") {
      toast.error("Cannot delete Admin user");
      return;
    }
    if (user.email === "admin@school.com") {
      toast.error("Cannot delete the main Admin account");
      return;
    }
    setUserToDelete(user);
  };

  const confirmDelete = () => {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete.id);
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

  const stats = data?.stats || {
    totalStudents: 0,
    totalTeachers: 0,
    totalParents: 0,
    totalClasses: 0,
    totalSubjects: 0,
    totalExpected: 0,
    totalCollected: 0,
    outstanding: 0
  };

  const classDistribution = data?.classDistribution || [];

  const summaryCards = [
    { name: "Students", value: stats.totalStudents, icon: UsersIcon, color: "bg-blue-500" },
    { name: "Teachers", value: stats.totalTeachers, icon: UserGroupIcon, color: "bg-green-500" },
    { name: "Parents", value: stats.totalParents, icon: AcademicCapIcon, color: "bg-purple-500" },
    { name: "Classes", value: stats.totalClasses, icon: BookOpenIcon, color: "bg-yellow-500" },
    { name: "Subjects", value: stats.totalSubjects, icon: BookmarkIcon, color: "bg-red-500" },
  ];

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
      {/* Header with Create User Button */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600">Welcome back, {getAdminName()}! System Overview and Management</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
          Create User
        </button>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Create New User</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="First name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="Last name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="user@school.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  {roleOptions.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>

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

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Confirm Delete</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{userToDelete.name}</strong>?
              <br />
              <span className="text-sm text-red-500">This action cannot be undone.</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmDelete}
                disabled={deleteUserMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteUserMutation.isPending ? "Deleting..." : "Delete User"}
              </button>
              <button
                onClick={() => setUserToDelete(null)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {summaryCards.map((card) => (
          <Card key={card.name}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{card.name}</p>
                <p className="text-2xl font-bold text-gray-900">{card.value.toLocaleString()}</p>
              </div>
              <div className={`p-3 rounded-lg ${card.color}`}>
                <card.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Fee Summary, Class Distribution, Recent Users */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card title="Fee Summary">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Expected</span>
              <span className="font-bold">₦{stats.totalExpected.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Collected</span>
              <span className="font-bold text-green-600">₦{stats.totalCollected.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Outstanding</span>
              <span className="font-bold text-red-600">₦{stats.outstanding.toLocaleString()}</span>
            </div>
          </div>
        </Card>

        <Card title="Class Distribution">
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {classDistribution.length > 0 ? (
              classDistribution.map((cls: any) => (
                <div key={cls.name} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{cls.name}</span>
                  <div className="flex-1 mx-4">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${(cls.studentCount / stats.totalStudents) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-medium">{cls.studentCount}</span>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center">No class data available</p>
            )}
          </div>
        </Card>

        <Card title="Recent Users">
          <div className="space-y-3 max-h-80 overflow-y-auto">
            <SearchBar
              onSearch={(term) => {
                const filtered = recentUsers.filter((user: any) => 
                  user.name?.toLowerCase().includes(term.toLowerCase()) ||
                  user.email?.toLowerCase().includes(term.toLowerCase())
                );
              }}
              placeholder="Search users..."
              className="mb-2"
            />
            {recentUsers.length > 0 ? (
              recentUsers.map((user: any) => (
                <div key={user.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 text-xs rounded-full bg-gray-200">
                      {user.role}
                    </span>
                    {user.role !== "ADMIN" && user.email !== "admin@school.com" && (
                      <button
                        onClick={() => handleDeleteClick(user)}
                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                        title="Delete User"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center">No recent users</p>
            )}
          </div>
        </Card>
      </div>

      {/* Teachers, Students, Parents Sections */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card title="Teachers">
          <div className="space-y-4">
            <SearchBar
              onSearch={setTeacherSearchTerm}
              placeholder="Search teachers by name or email..."
            />
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredTeachers.filteredItems.length > 0 ? (
                filteredTeachers.filteredItems.map((teacher: any) => (
                  <div key={teacher.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">{teacher.name}</p>
                        <p className="text-sm text-gray-500">{teacher.email}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {teacher.classesCount || 0} Classes | {teacher.subjectsCount || 0} Subjects
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteClick(teacher)}
                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                        title="Delete Teacher"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">
                  {teacherSearchTerm ? "No teachers found" : "No teachers data"}
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card title="Students">
          <div className="space-y-4">
            <SearchBar
              onSearch={setStudentSearchTerm}
              placeholder="Search students by name or admission number..."
            />
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredStudents.filteredItems.length > 0 ? (
                filteredStudents.filteredItems.slice(0, 10).map((student: any) => (
                  <div key={student.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">{student.name}</p>
                        <p className="text-sm text-gray-500">Admission: {student.admissionNo}</p>
                        <p className="text-xs text-gray-400">Class: {student.className}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteClick(student)}
                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                        title="Delete Student"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">
                  {studentSearchTerm ? "No students found" : "No students data"}
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card title="Recent Parents">
          <div className="space-y-4">
            <SearchBar
              onSearch={setParentSearchTerm}
              placeholder="Search parents by name or email..."
            />
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredParents.filteredItems.length > 0 ? (
                filteredParents.filteredItems.map((parent: any) => (
                  <div key={parent.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">{parent.name}</p>
                        <p className="text-sm text-gray-500">{parent.email}</p>
                        <div className="mt-1">
                          <p className="text-xs text-gray-400">
                            Children: {parent.childrenCount || 0}
                          </p>
                        </div>
                        {parent.children && parent.children.length > 0 && (
                          <div className="mt-1 text-xs text-gray-500">
                            {parent.children.map((c: any, idx: number) => (
                              <span key={c.id}>
                                {c.name}
                                {idx < parent.children.length - 1 ? ', ' : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteClick(parent)}
                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                        title="Delete Parent"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <AcademicCapIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">
                    {parentSearchTerm ? "No parents found" : "No parent registrations yet"}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Parents will appear here when they register
                  </p>
                </div>
              )}
            </div>
            {parentSearchTerm && filteredParents.filteredItems.length > 0 && (
              <p className="text-xs text-gray-400">
                Found {filteredParents.filteredItems.length} parent(s)
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;