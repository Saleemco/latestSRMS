import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sessionService } from "../../services/session.service";
import { termService } from "../../services/term.service";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Spinner } from "../../components/ui/Spinner";
import { PlusIcon, CalendarIcon, TrashIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import toast from "react-hot-toast";

export default function SessionManagement() {
  const [isCreating, setIsCreating] = useState(false);
  const [newSessionName, setNewSessionName] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [sessionToDelete, setSessionToDelete] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: sessionService.getAll,
  });

  const createMutation = useMutation({
    mutationFn: sessionService.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      setIsCreating(false);
      setNewSessionName("");
      setNewStartDate("");
      setNewEndDate("");
      toast.success(data.message || "Session and 3 terms created successfully!");
    },
    onError: (error: any) => {
      console.error("Create error:", error);
      const errorMsg = error.response?.data?.error || error.message || "Failed to create session";
      toast.error(errorMsg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: sessionService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      setSessionToDelete(null);
      toast.success("Session deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to delete session");
    },
  });

  const setActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      sessionService.update(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      toast.success("Session updated successfully");
    },
  });

  const setTermActiveMutation = useMutation({
    mutationFn: ({ termId, isActive }: { termId: string; isActive: boolean }) =>
      termService.update(termId, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      toast.success("Term activated successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to activate term");
    },
  });

  const handleCreate = () => {
    if (!newSessionName || !newStartDate || !newEndDate) {
      toast.error("Please fill in all fields");
      return;
    }
    
    if (sessions?.some((s: any) => s.name === newSessionName)) {
      toast.error(`Session "${newSessionName}" already exists!`);
      return;
    }
    
    createMutation.mutate({
      name: newSessionName,
      startDate: newStartDate,
      endDate: newEndDate,
      isActive: false,
      isArchived: false,
    });
  };

  const handleDelete = (session: any) => {
    if (session.isActive) {
      toast.error("Cannot delete an active session. Please set another session as active first.");
      return;
    }
    setSessionToDelete(session);
  };

  const confirmDelete = () => {
    if (sessionToDelete) {
      deleteMutation.mutate(sessionToDelete.id);
    }
  };

  const handleActivateTerm = (termId: string, termName: string, sessionName: string) => {
    // First deactivate all other terms in this session
    const session = sessions?.find((s: any) => 
      s.terms?.some((t: any) => t.id === termId)
    );
    
    if (session && session.terms) {
      // Deactivate all terms in this session first
      session.terms.forEach((term: any) => {
        if (term.isActive && term.id !== termId) {
          termService.update(term.id, { isActive: false }).catch(console.error);
        }
      });
    }
    
    // Then activate the selected term
    setTermActiveMutation.mutate({ termId, isActive: true });
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
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Academic Sessions</h1>
          <p className="text-gray-600">Each session automatically creates 3 terms. Click "Activate" to set a term as current.</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <PlusIcon className="w-4 h-4" />
          New Session
        </button>
      </div>

      {isCreating && (
        <Card>
          <h2 className="text-lg font-semibold mb-4">Create New Academic Session</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Session Name (e.g., 2024-2025)"
              value={newSessionName}
              onChange={(e) => setNewSessionName(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="date"
              value={newStartDate}
              onChange={(e) => setNewStartDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="date"
              value={newEndDate}
              onChange={(e) => setNewEndDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
            >
              {createMutation.isPending ? "Creating..." : "Create Session & Terms"}
            </button>
            <button
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </Card>
      )}

      {/* Delete Confirmation Modal */}
      {sessionToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete Session</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete <strong>{sessionToDelete.name}</strong>?
              <br />
              <span className="text-sm text-red-500">This will also delete all terms associated with this session!</span>
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setSessionToDelete(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete Session"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {sessions && sessions.length > 0 ? (
          sessions.map((session: any) => (
            <Card key={session.id} className="overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between p-4 border-b bg-gray-50">
                <div className="flex items-center gap-3">
                  <CalendarIcon className="w-6 h-6 text-blue-500" />
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{session.name}</h2>
                    <p className="text-sm text-gray-500">
                      {session.startDate ? new Date(session.startDate).toLocaleDateString() : 'N/A'} - {session.endDate ? new Date(session.endDate).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2 md:mt-0">
                  {session.isActive ? (
                    <Badge variant="success">Active Session</Badge>
                  ) : (
                    !session.isArchived && (
                      <button
                        onClick={() => setActiveMutation.mutate({ id: session.id, isActive: true })}
                        className="px-3 py-1 text-sm bg-gray-200 rounded-lg hover:bg-gray-300"
                      >
                        Set Session Active
                      </button>
                    )
                  )}
                  {!session.isActive && (
                    <button
                      onClick={() => handleDelete(session)}
                      className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                      title="Delete Session"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  )}
                  {session.isArchived && <Badge variant="secondary">Archived</Badge>}
                </div>
              </div>

              {/* Terms Section with Activation Buttons */}
              <div className="p-4">
                <h3 className="font-semibold text-gray-700 mb-3">Terms</h3>
                {session.terms && session.terms.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {session.terms.map((term: any) => (
                      <div key={term.id} className={`rounded-lg p-3 ${term.isActive ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                        <div className="flex justify-between items-center">
                          <span className={`font-medium ${term.isActive ? 'text-green-700' : 'text-gray-900'}`}>
                            {term.name}
                          </span>
                          {term.isActive ? (
                            <Badge variant="success">Current Term</Badge>
                          ) : (
                            <button
                              onClick={() => handleActivateTerm(term.id, term.name, session.name)}
                              disabled={setTermActiveMutation.isPending}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                            >
                              <CheckCircleIcon className="w-3 h-3" />
                              Activate
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {term.startDate ? new Date(term.startDate).toLocaleDateString() : 'N/A'} - {term.endDate ? new Date(term.endDate).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No terms found. Terms are auto-created when session is created.</p>
                )}
              </div>
            </Card>
          ))
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <CalendarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No academic sessions created yet</p>
            <button
              onClick={() => setIsCreating(true)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create First Session
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
