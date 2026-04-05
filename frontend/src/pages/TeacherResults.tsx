import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { useTerm } from "../context/TermContext";
import { dashboardService } from "../services/dashboard.service";
import { SearchBar } from "../components/ui/SearchBar";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Spinner } from "../components/ui/Spinner";
import {
  ChartBarIcon,
  DocumentArrowDownIcon,
  FunnelIcon,
  AcademicCapIcon,
  UserGroupIcon,
  BookOpenIcon,
  ArrowPathIcon,
  XMarkIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";

interface Grade {
  id: string;
  score: number;
  percentage: number;
  gradeLetter: string;
  type: string;
  category: string;
  maxScore: number;
  remarks: string;
  studentId: string;
  student: {
    id: string;
    name: string;
    admissionNo: string;
    className: string;
  };
  subjectId: string;
  subject: {
    id: string;
    name: string;
  };
  termId: string;
  term?: {
    id: string;
    name: string;
    session?: {
      id: string;
      name: string;
    };
  };
  createdAt: string;
}

export const TeacherResults = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { terms, sessions, selectedTerm, selectedSession, setSelectedTerm, setSelectedSession } = useTerm();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  // First, fetch the teacher's dashboard to get the teacher ID
  const { data: teacherData, isLoading: teacherLoading } = useQuery({
    queryKey: ["teacher-dashboard"],
    queryFn: dashboardService.getTeacherDashboard,
    enabled: !!user,
  });

  const teacher = teacherData?.teacher;
  const teacherId = teacher?.id;

  // Fetch all grades for teacher's subjects
  const { data: gradesData, isLoading, error, refetch } = useQuery({
    queryKey: ["teacher-grades", teacherId, selectedTerm?.id, selectedSession?.id],
    queryFn: async () => {
      if (!teacherId) return { data: [] };
      const response = await dashboardService.getGradesByTeacher(
        teacherId,
        selectedTerm?.id,
        selectedSession?.id
      );
      return response;
    },
    enabled: !!teacherId,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (gradeId: string) => {
      return await dashboardService.deleteGrade(gradeId);
    },
    onSuccess: () => {
      toast.success("Grade deleted successfully!");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["teacher-grades"] });
    },
    onError: (error: any) => {
      console.error("Delete error:", error);
      toast.error(error.response?.data?.message || "Failed to delete grade");
    },
  });

  const grades: Grade[] = gradesData?.data || [];

  // Get unique classes and subjects from grades
  const uniqueClasses = useMemo(() => {
    const classes = new Set(grades.map((g) => g.student?.className).filter(Boolean));
    return Array.from(classes).sort();
  }, [grades]);

  const uniqueSubjects = useMemo(() => {
    const subjects = new Map();
    grades.forEach((g) => {
      if (g.subject) {
        subjects.set(g.subject.id, g.subject.name);
      }
    });
    return Array.from(subjects.entries()).map(([id, name]) => ({ id, name }));
  }, [grades]);

  // Filter and group grades - FIXED: direct filtering instead of useSearch
  const filteredResults = useMemo(() => {
    let filtered = grades;

    // Filter by search term - THIS IS THE SEARCH FUNCTIONALITY
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (g) =>
          g.student?.name?.toLowerCase().includes(term) ||
          g.student?.admissionNo?.toLowerCase().includes(term) ||
          g.subject?.name?.toLowerCase().includes(term)
      );
    }

    // Filter by class
    if (selectedClass) {
      filtered = filtered.filter((g) => g.student?.className === selectedClass);
    }

    // Filter by subject
    if (selectedSubject) {
      filtered = filtered.filter((g) => g.subject?.id === selectedSubject);
    }

    // Filter by selected term
    if (selectedTerm?.id) {
      filtered = filtered.filter((g) => g.termId === selectedTerm.id);
    }

    // Group by student-subject combination
    const grouped = filtered.reduce((acc: any, grade) => {
      const key = `${grade.studentId}-${grade.subjectId}`;
      if (!acc[key]) {
        acc[key] = {
          student: grade.student,
          subject: grade.subject,
          term: grade.term,
          ca: null,
          exam: null,
          finalScore: 0,
          finalGrade: "",
          createdAt: grade.createdAt,
          caId: null,
          examId: null,
        };
      }

      const gradeType = grade.type || grade.category;
      if (gradeType === "CA" || grade.category === "CA" || ["CLASSWORK", "HOMEWORK", "QUIZ", "ASSIGNMENT", "PROJECT", "MIDTERM"].includes(gradeType)) {
        acc[key].ca = grade;
        acc[key].caId = grade.id;
      } else if (gradeType === "EXAM" || grade.category === "EXAM") {
        acc[key].exam = grade;
        acc[key].examId = grade.id;
      }

      const caScore = acc[key].ca?.score || 0;
      const examScore = acc[key].exam?.score || 0;
      acc[key].finalScore = caScore + examScore;
      acc[key].finalGrade = getGradeLetter(acc[key].finalScore);

      return acc;
    }, {});

    return Object.values(grouped);
  }, [grades, searchTerm, selectedClass, selectedSubject, selectedTerm]);

  const handleDeleteGrade = (gradeId: string | null, type: string, studentName: string, subjectName: string) => {
    if (!gradeId) {
      toast.error(`No ${type} grade found to delete`);
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete the ${type} grade for ${studentName} (${subjectName})? This action cannot be undone.`
    );

    if (confirmed) {
      deleteMutation.mutate(gradeId);
    }
  };

  const handleDeleteBothGrades = (caId: string | null, examId: string | null, studentName: string, subjectName: string) => {
    const hasCA = caId;
    const hasExam = examId;
    
    if (!hasCA && !hasExam) {
      toast.error("No grades found to delete");
      return;
    }
    
    const confirmed = window.confirm(
      `Are you sure you want to delete ALL grades for ${studentName} (${subjectName})? This will remove both CA and Exam grades. This action cannot be undone.`
    );
    
    if (confirmed) {
      if (hasCA) deleteMutation.mutate(caId);
      if (hasExam) deleteMutation.mutate(examId);
    }
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const total = filteredResults.length;
    const withBoth = filteredResults.filter((r: any) => r.ca && r.exam).length;
    const onlyCA = filteredResults.filter((r: any) => r.ca && !r.exam).length;
    const onlyExam = filteredResults.filter((r: any) => !r.ca && r.exam).length;

    const averageScore =
      total > 0
        ? filteredResults.reduce((sum: number, r: any) => sum + r.finalScore, 0) / total
        : 0;

    const gradeDistribution = {
      A: filteredResults.filter((r: any) => r.finalScore >= 70).length,
      B: filteredResults.filter((r: any) => r.finalScore >= 60 && r.finalScore < 70).length,
      C: filteredResults.filter((r: any) => r.finalScore >= 50 && r.finalScore < 60).length,
      D: filteredResults.filter((r: any) => r.finalScore >= 45 && r.finalScore < 50).length,
      E: filteredResults.filter((r: any) => r.finalScore >= 40 && r.finalScore < 45).length,
      F: filteredResults.filter((r: any) => r.finalScore < 40).length,
    };

    const passRate = total > 0 
      ? ((gradeDistribution.A + gradeDistribution.B + gradeDistribution.C) / total) * 100 
      : 0;

    return { total, withBoth, onlyCA, onlyExam, averageScore, gradeDistribution, passRate };
  }, [filteredResults]);

  const handleExport = () => {
    try {
      const headers = ["Student Name", "Admission No", "Class", "Subject", "CA Score", "Exam Score", "Total", "Grade", "Term", "Session"];
      const rows = filteredResults.map((r: any) => [
        `"${r.student?.name || ""}"`,
        `"${r.student?.admissionNo || ""}"`,
        `"${r.student?.className || ""}"`,
        `"${r.subject?.name || ""}"`,
        r.ca?.score || "-",
        r.exam?.score || "-",
        r.finalScore,
        r.finalGrade,
        `"${r.term?.name || ""}"`,
        `"${r.term?.session?.name || ""}"`,
      ]);

      const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `results-${selectedTerm?.name || "all"}-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success(`${filteredResults.length} results exported successfully!`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export results");
    }
  };

  const handleRefresh = () => {
    refetch();
    toast.success("Refreshing data...");
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedClass("");
    setSelectedSubject("");
    setSelectedTerm(null);
    setSelectedSession(null);
    toast.success("Filters cleared");
  };

  if (teacherLoading || isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <ChartBarIcon className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Results</h3>
        <p className="text-red-600 mb-4">{(error as any).message || "Failed to load grades"}</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Student Results</h1>
          <p className="text-gray-600">View and manage student grades</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <ArrowPathIcon className="w-5 h-5" />
            Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={filteredResults.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <DocumentArrowDownIcon className="w-5 h-5" />
            Export to CSV
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <UserGroupIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Records</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <ChartBarIcon className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Complete Grades</p>
              <p className="text-2xl font-bold text-gray-900">{stats.withBoth}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <AcademicCapIcon className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Average Score</p>
              <p className="text-2xl font-bold text-gray-900">{stats.averageScore.toFixed(1)}%</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <BookOpenIcon className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pass Rate</p>
              <p className="text-2xl font-bold text-gray-900">{stats.passRate.toFixed(1)}%</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Grade Distribution */}
      <Card title="Grade Distribution">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {Object.entries(stats.gradeDistribution).map(([grade, count]) => (
            <div key={grade} className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-700">{grade}</div>
              <div className="text-sm text-gray-500">{count} students</div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                <div 
                  className={`h-1.5 rounded-full ${
                    grade === 'A' ? 'bg-green-500' :
                    grade === 'B' ? 'bg-blue-500' :
                    grade === 'C' ? 'bg-yellow-500' :
                    grade === 'D' ? 'bg-orange-500' :
                    grade === 'E' ? 'bg-red-400' : 'bg-red-600'
                  }`}
                  style={{ width: `${stats.total > 0 ? (count / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Filters */}
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1"
          >
            <FunnelIcon className="w-4 h-4" />
            {showFilters ? "Hide Filters" : "Show Filters"}
          </button>
        </div>
        
        {showFilters && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Session Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Academic Year
                </label>
                <select
                  value={selectedSession?.id || ""}
                  onChange={(e) => {
                    const session = sessions.find((s) => s.id === e.target.value);
                    setSelectedSession(session || null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Years</option>
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.name} {session.isActive ? "(Active)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Term Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Term
                </label>
                <select
                  value={selectedTerm?.id || ""}
                  onChange={(e) => {
                    const term = terms.find((t) => t.id === e.target.value);
                    setSelectedTerm(term || null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Terms</option>
                  {terms.map((term) => (
                    <option key={term.id} value={term.id}>
                      {term.name} {term.isActive ? "(Active)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Class Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Class
                </label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Classes</option>
                  {uniqueClasses.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject
                </label>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Subjects</option>
                  {uniqueSubjects.map((subj) => (
                    <option key={subj.id} value={subj.id}>
                      {subj.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search - This is the search bar */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <SearchBar
                onSearch={setSearchTerm}
                placeholder="Search by student name or admission number..."
                value={searchTerm}
              />
            </div>
          </div>
        )}

        {(selectedTerm || selectedSession || selectedClass || selectedSubject || searchTerm) && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={clearFilters}
              className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
            >
              <XMarkIcon className="w-4 h-4" />
              Clear All Filters
            </button>
          </div>
        )}
      </Card>

      {/* Results Table */}
      <Card title={`Results (${filteredResults.length} records)`}>
        {filteredResults.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">CA (40)</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Exam (60)</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Grade</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {(filteredResults as any[]).map((result: any, index: number) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{result.student?.name}</p>
                        <p className="text-xs text-gray-500">{result.student?.admissionNo}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{result.student?.className}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{result.subject?.name}</td>
                    <td className="px-4 py-3 text-center">
                      {result.ca ? (
                        <div className="relative group inline-block">
                          <span className="font-medium text-blue-600">{result.ca.score}</span>
                          <button
                            onClick={() => handleDeleteGrade(result.caId, 'CA', result.student?.name, result.subject?.name)}
                            disabled={deleteMutation.isPending}
                            className="ml-1 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete CA grade"
                          >
                            <TrashIcon className="w-3 h-3 inline" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {result.exam ? (
                        <div className="relative group inline-block">
                          <span className="font-medium text-purple-600">{result.exam.score}</span>
                          <button
                            onClick={() => handleDeleteGrade(result.examId, 'Exam', result.student?.name, result.subject?.name)}
                            disabled={deleteMutation.isPending}
                            className="ml-1 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete Exam grade"
                          >
                            <TrashIcon className="w-3 h-3 inline" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-bold text-gray-900">{result.finalScore}/100</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-1 text-xs font-bold rounded-full ${
                          result.finalScore >= 70
                            ? "bg-green-100 text-green-700"
                            : result.finalScore >= 50
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {result.finalGrade}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {result.ca && result.exam ? (
                        <Badge variant="success">Complete</Badge>
                      ) : result.ca ? (
                        <Badge variant="warning">CA Only</Badge>
                      ) : result.exam ? (
                        <Badge variant="warning">Exam Only</Badge>
                      ) : (
                        <Badge variant="secondary">None</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {(result.ca || result.exam) && (
                        <button
                          onClick={() => handleDeleteBothGrades(result.caId, result.examId, result.student?.name, result.subject?.name)}
                          disabled={deleteMutation.isPending}
                          className="p-1 text-red-600 hover:text-red-800 transition-colors"
                          title="Delete all grades for this student/subject"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <ChartBarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Results Found</h3>
            <p className="text-gray-500">
              {searchTerm || selectedClass || selectedSubject || selectedTerm || selectedSession
                ? "No grades match your current filters. Try adjusting your filters."
                : "No grades have been entered yet. Use the 'Enter Grade' button to add results."}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
};

function getGradeLetter(score: number): string {
  if (score >= 70) return "A";
  if (score >= 60) return "B";
  if (score >= 50) return "C";
  if (score >= 45) return "D";
  if (score >= 40) return "E";
  return "F";
}

export default TeacherResults;