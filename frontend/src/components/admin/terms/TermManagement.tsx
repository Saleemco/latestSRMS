import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { termService, Term, Session } from '../../../services/term.service';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { Input } from '../../ui/Input';
import { Spinner } from '../../ui/Spinner';
import { Badge } from '../../ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../ui/Tabs';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  CalendarIcon,
  AcademicCapIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export const TermManagement = () => {
  const [activeTab, setActiveTab] = useState<'sessions' | 'terms'>('sessions');
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isTermModalOpen, setIsTermModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [editingTerm, setEditingTerm] = useState<Term | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  
  const [sessionForm, setSessionForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
    isActive: false
  });
  
  const [termForm, setTermForm] = useState({
    name: '',
    sessionId: '',
    startDate: '',
    endDate: '',
    isActive: false
  });

  const queryClient = useQueryClient();

  // Queries
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: termService.getAllSessions,
  });

  const { data: terms, isLoading: termsLoading } = useQuery({
    queryKey: ['terms', selectedSessionId],
    queryFn: () => termService.getAll(selectedSessionId),
    enabled: !!selectedSessionId || activeTab === 'terms',
  });

  // Mutations
  const createSessionMutation = useMutation({
    mutationFn: termService.createSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      setIsSessionModalOpen(false);
      resetSessionForm();
      toast.success('Academic year created successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create academic year');
    }
  });

  const createTermMutation = useMutation({
    mutationFn: termService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terms'] });
      setIsTermModalOpen(false);
      resetTermForm();
      toast.success('Term created successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create term');
    }
  });

  const updateTermMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => termService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terms'] });
      setIsTermModalOpen(false);
      setEditingTerm(null);
      resetTermForm();
      toast.success('Term updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update term');
    }
  });

  const deleteTermMutation = useMutation({
    mutationFn: termService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terms'] });
      toast.success('Term deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete term');
    }
  });

  const setActiveTermMutation = useMutation({
    mutationFn: termService.setActive,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terms'] });
      toast.success('Term activated successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to activate term');
    }
  });

  const resetSessionForm = () => {
    setSessionForm({ name: '', startDate: '', endDate: '', isActive: false });
    setEditingSession(null);
  };

  const resetTermForm = () => {
    setTermForm({ name: '', sessionId: selectedSessionId, startDate: '', endDate: '', isActive: false });
    setEditingTerm(null);
  };

  const handleOpenSessionModal = (session?: Session) => {
    if (session) {
      setEditingSession(session);
      setSessionForm({
        name: session.name,
        startDate: session.startDate.split('T')[0],
        endDate: session.endDate.split('T')[0],
        isActive: session.isActive
      });
    } else {
      resetSessionForm();
    }
    setIsSessionModalOpen(true);
  };

  const handleOpenTermModal = (term?: Term) => {
    if (term) {
      setEditingTerm(term);
      setTermForm({
        name: term.name,
        sessionId: term.sessionId,
        startDate: term.startDate.split('T')[0],
        endDate: term.endDate.split('T')[0],
        isActive: term.isActive
      });
    } else {
      resetTermForm();
    }
    setIsTermModalOpen(true);
  };

  const handleSessionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionForm.name || !sessionForm.startDate || !sessionForm.endDate) {
      toast.error('Please fill in all fields');
      return;
    }
    createSessionMutation.mutate({
      ...sessionForm,
      startDate: new Date(sessionForm.startDate).toISOString(),
      endDate: new Date(sessionForm.endDate).toISOString(),
    });
  };

  const handleTermSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!termForm.name || !termForm.sessionId || !termForm.startDate || !termForm.endDate) {
      toast.error('Please fill in all fields');
      return;
    }
    
    const submitData = {
      ...termForm,
      startDate: new Date(termForm.startDate).toISOString(),
      endDate: new Date(termForm.endDate).toISOString(),
    };
    
    if (editingTerm) {
      updateTermMutation.mutate({ id: editingTerm.id, data: submitData });
    } else {
      createTermMutation.mutate(submitData);
    }
  };

  const handleDeleteTerm = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      deleteTermMutation.mutate(id);
    }
  };

  const isLoading = sessionsLoading || termsLoading;

  if (isLoading && !sessions) {
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
          <h1 className="text-2xl font-bold text-gray-900">Academic Management</h1>
          <p className="text-gray-600">Manage academic years (sessions) and terms</p>
        </div>
        <Button onClick={() => activeTab === 'sessions' ? handleOpenSessionModal() : handleOpenTermModal()}>
          <PlusIcon className="h-5 w-5 mr-2" />
          Add {activeTab === 'sessions' ? 'Academic Year' : 'Term'}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <AcademicCapIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Academic Years</p>
              <p className="text-2xl font-bold text-gray-900">{sessions?.length || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <CalendarIcon className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Terms</p>
              <p className="text-2xl font-bold text-gray-900">{terms?.length || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <CheckCircleIcon className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Term</p>
              <p className="text-lg font-bold text-gray-900">
                {terms?.find(t => t.isActive)?.name || 'None'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'sessions' | 'terms')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="sessions">Academic Years (Sessions)</TabsTrigger>
          <TabsTrigger value="terms">Terms</TabsTrigger>
        </TabsList>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="mt-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Year Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">End Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sessions?.map((session) => (
                  <tr key={session.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{session.name}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {format(new Date(session.startDate), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {format(new Date(session.endDate), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4">
                      {session.isActive ? (
                        <Badge variant="success" className="bg-green-100 text-green-700">
                          Active
                        </Badge>
                      ) : session.isArchived ? (
                        <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                          Archived
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                          Inactive
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
                {(!sessions || sessions.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      No academic years found. Click "Add Academic Year" to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Terms Tab */}
        <TabsContent value="terms" className="mt-6">
          {/* Session Selector for Terms */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Academic Year
            </label>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose an academic year...</option>
              {sessions?.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name} {session.isActive ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          {selectedSessionId && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Term Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">End Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {terms?.map((term) => (
                    <tr key={term.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{term.name}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {format(new Date(term.startDate), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {format(new Date(term.endDate), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-6 py-4">
                        {term.isActive ? (
                          <Badge variant="success" className="bg-green-100 text-green-700">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                            Inactive
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {!term.isActive && (
                            <button
                              onClick={() => setActiveTermMutation.mutate(term.id)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded-lg"
                              title="Activate Term"
                            >
                              <CheckCircleIcon className="w-5 h-5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenTermModal(term)}
                            className="p-1 text-yellow-600 hover:bg-yellow-50 rounded-lg"
                            title="Edit Term"
                          >
                            <PencilIcon className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTerm(term.id, term.name)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded-lg"
                            title="Delete Term"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!terms || terms.length === 0) && selectedSessionId && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        No terms found for this academic year. Click "Add Term" to create one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Session Modal */}
      <Modal
        isOpen={isSessionModalOpen}
        onClose={() => {
          setIsSessionModalOpen(false);
          resetSessionForm();
        }}
        title="Add Academic Year"
      >
        <form onSubmit={handleSessionSubmit} className="space-y-4">
          <Input
            label="Academic Year Name"
            value={sessionForm.name}
            onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })}
            placeholder="e.g., 2025-2026"
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={sessionForm.startDate}
              onChange={(e) => setSessionForm({ ...sessionForm, startDate: e.target.value })}
              required
            />
            <Input
              label="End Date"
              type="date"
              value={sessionForm.endDate}
              onChange={(e) => setSessionForm({ ...sessionForm, endDate: e.target.value })}
              required
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="sessionIsActive"
              checked={sessionForm.isActive}
              onChange={(e) => setSessionForm({ ...sessionForm, isActive: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <label htmlFor="sessionIsActive" className="text-sm text-gray-700">
              Set as active academic year
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsSessionModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createSessionMutation.isPending}>
              Create Academic Year
            </Button>
          </div>
        </form>
      </Modal>

      {/* Term Modal */}
      <Modal
        isOpen={isTermModalOpen}
        onClose={() => {
          setIsTermModalOpen(false);
          resetTermForm();
        }}
        title={editingTerm ? 'Edit Term' : 'Add Term'}
      >
        <form onSubmit={handleTermSubmit} className="space-y-4">
          <Input
            label="Term Name"
            value={termForm.name}
            onChange={(e) => setTermForm({ ...termForm, name: e.target.value })}
            placeholder="e.g., First Term"
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Academic Year
            </label>
            <select
              value={termForm.sessionId}
              onChange={(e) => setTermForm({ ...termForm, sessionId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select academic year...</option>
              {sessions?.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={termForm.startDate}
              onChange={(e) => setTermForm({ ...termForm, startDate: e.target.value })}
              required
            />
            <Input
              label="End Date"
              type="date"
              value={termForm.endDate}
              onChange={(e) => setTermForm({ ...termForm, endDate: e.target.value })}
              required
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="termIsActive"
              checked={termForm.isActive}
              onChange={(e) => setTermForm({ ...termForm, isActive: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <label htmlFor="termIsActive" className="text-sm text-gray-700">
              Set as active term
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsTermModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createTermMutation.isPending || updateTermMutation.isPending}
            >
              {editingTerm ? 'Update Term' : 'Create Term'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default TermManagement;