import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Spinner } from "../components/ui/Spinner";
import { SearchBar } from "../components/ui/SearchBar";
import { TrashIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import api from "../services/api";

export const ParentsManagement = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [parentToDelete, setParentToDelete] = useState<any>(null);
  const queryClient = useQueryClient();

  // Fetch all parents with their children
  const { data: parents, isLoading, refetch } = useQuery({
    queryKey: ["parents-management"],
    queryFn: async () => {
      const response = await api.get("/parents");
      return response.data;
    },
  });

  // Delete parent mutation
  const deleteParentMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await api.delete(`/users/${userId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parents-management"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      setParentToDelete(null);
      toast.success("Parent deleted successfully!");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to delete parent");
    },
  });

  const filteredParents = useMemo(() => {
    if (!searchTerm) return parents || [];
    const term = searchTerm.toLowerCase();
    return (parents || []).filter((parent: any) =>
      parent.user?.name?.toLowerCase().includes(term) ||
      parent.user?.email?.toLowerCase().includes(term)
    );
  }, [parents, searchTerm]);

  const handleDelete = (parent: any) => {
    setParentToDelete(parent);
  };

  const confirmDelete = () => {
    if (parentToDelete) {
      deleteParentMutation.mutate(parentToDelete.userId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Parents Management</h1>
          <p className="text-gray-600">View and manage all parents in the system</p>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {parentToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Confirm Delete</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{parentToDelete.user?.name}</strong>?
              <br />
              <span className="text-sm text-red-500">
                This will also unlink all associated students.
              </span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmDelete}
                disabled={deleteParentMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteParentMutation.isPending ? "Deleting..." : "Delete Parent"}
              </button>
              <button
                onClick={() => setParentToDelete(null)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <Card>
        <div className="space-y-4">
          <SearchBar
            onSearch={setSearchTerm}
            placeholder="Search parents by name or email..."
          />
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">#</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Children</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredParents.length > 0 ? (
                  filteredParents.map((parent: any, index: number) => (
                    <tr key={parent.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{parent.user?.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{parent.user?.email}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {parent.students && parent.students.length > 0 ? (
                            parent.students.map((student: any) => (
                              <Badge key={student.id} variant="info" className="text-xs">
                                {student.user?.name || student.name}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400">No children</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleDelete(parent)}
                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                          title="Delete Parent"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      {searchTerm ? "No parents found matching your search" : "No parents found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <div className="text-sm text-gray-500">
            Total Parents: {filteredParents.length}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ParentsManagement;