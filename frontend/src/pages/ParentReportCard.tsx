import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { useTerm } from "../context/TermContext";
import { dashboardService } from "../services/dashboard.service";
import { Card } from "../components/ui/Card";
import { Spinner } from "../components/ui/Spinner";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import {
  ChartBarIcon,
  PrinterIcon,
  AcademicCapIcon,
  UserGroupIcon,
  BookOpenIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UserIcon,
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

interface SubjectResult {
  subjectId: string;
  subjectName: string;
  ca: number | null;
  exam: number | null;
  total: number | null;
  grade: string;
  remarks?: string;
}

interface TermResult {
  termId: string;
  termName: string;
  subjects: SubjectResult[];
  termAverage: number;
  termGrade: string;
  termPosition?: number;
  totalSubjects: number;
  subjectsPassed: number;
}

interface ReportCardData {
  student: {
    id: string;
    name: string;
    admissionNo: string;
    className: string;
  };
  session: {
    id: string;
    name: string;
  };
  terms: TermResult[];
  cumulativeAverage: number;
  cumulativeGrade: string;
  overallRemarks: string;
}

export const ParentReportCard = () => {
  const { user } = useAuth();
  const { sessions, selectedSession, setSelectedSession } = useTerm();
  const [selectedChild, setSelectedChild] = useState<string>("");
  const [currentTermIndex, setCurrentTermIndex] = useState(0);

  // Fetch parent's children
  const { data: childrenData, isLoading: childrenLoading, error: childrenError } = useQuery({
    queryKey: ["parent-children"],
    queryFn: async () => {
      console.log("📡 Fetching parent children...");
      const response = await dashboardService.getParentChildren();
      console.log("📡 Parent children response:", response);
      return response;
    },
    enabled: !!user,
  });

  const children = childrenData || [];

  // Fetch grades for selected child
  const { data: gradesData, isLoading: gradesLoading, error: gradesError } = useQuery({
    queryKey: ["child-grades", selectedChild, selectedSession?.id],
    queryFn: async () => {
      if (!selectedChild) return { data: [] };
      console.log(`📡 Fetching grades for child: ${selectedChild}, session: ${selectedSession?.id}`);
      const response = await dashboardService.getGradesByStudent(
        selectedChild,
        undefined,
        selectedSession?.id
      );
      console.log("📡 Grades response:", response);
      return response;
    },
    enabled: !!selectedChild,
  });

  const grades: Grade[] = gradesData?.data || [];

  // Generate report card data
  const reportCardData = useMemo(() => {
    if (!selectedChild || grades.length === 0) return null;

    const student = children.find((c: any) => c.id === selectedChild);
    if (!student) return null;

    // Group grades by term
    const termsMap = new Map<string, TermResult>();
    
    grades.forEach((grade) => {
      if (!grade.term) return;
      
      const termId = grade.term.id;
      const termName = grade.term.name;
      
      if (!termsMap.has(termId)) {
        termsMap.set(termId, {
          termId,
          termName,
          subjects: [],
          termAverage: 0,
          termGrade: "",
          totalSubjects: 0,
          subjectsPassed: 0,
        });
      }
      
      const termResult = termsMap.get(termId)!;
      let subjectResult = termResult.subjects.find(
        (s) => s.subjectId === grade.subjectId
      );
      
      if (!subjectResult) {
        subjectResult = {
          subjectId: grade.subjectId,
          subjectName: grade.subject.name,
          ca: null,
          exam: null,
          total: null,
          grade: "",
        };
        termResult.subjects.push(subjectResult);
      }
      
      const gradeType = grade.type || grade.category;
      if (gradeType === "CA" || grade.category === "CA") {
        subjectResult.ca = grade.score;
      } else if (gradeType === "EXAM" || grade.category === "EXAM") {
        subjectResult.exam = grade.score;
      }
      
      if (subjectResult.ca !== null && subjectResult.exam !== null) {
        subjectResult.total = subjectResult.ca + subjectResult.exam;
        subjectResult.grade = getGradeLetter(subjectResult.total);
      }
    });
    
    // Calculate term averages and sort terms
    const terms = Array.from(termsMap.values());
    terms.forEach((term) => {
      const validSubjects = term.subjects.filter((s) => s.total !== null);
      term.totalSubjects = validSubjects.length;
      term.subjectsPassed = validSubjects.filter((s) => (s.total || 0) >= 40).length;
      term.termAverage =
        validSubjects.length > 0
          ? validSubjects.reduce((sum, s) => sum + (s.total || 0), 0) / validSubjects.length
          : 0;
      term.termGrade = getGradeLetter(term.termAverage);
    });
    
    // Sort terms by name order
    const termOrder = ["First Term", "Second Term", "Third Term"];
    terms.sort((a, b) => termOrder.indexOf(a.termName) - termOrder.indexOf(b.termName));
    
    // Calculate cumulative average
    const validTerms = terms.filter((t) => t.termAverage > 0);
    const cumulativeAverage =
      validTerms.length > 0
        ? validTerms.reduce((sum, t) => sum + t.termAverage, 0) / validTerms.length
        : 0;
    
    // Generate remarks
    const getRemarks = (average: number, grade: string): string => {
      if (average >= 70) return "Excellent! Outstanding performance. Keep up the great work!";
      if (average >= 60) return "Very Good. Your child is doing well. Aim for excellence!";
      if (average >= 50) return "Good. Your child has potential to do even better with more effort.";
      if (average >= 45) return "Satisfactory. More dedication and practice will improve results.";
      if (average >= 40) return "Fair. Your child needs to work harder to meet expectations.";
      return "Needs Improvement. Please encourage your child to focus more on studies.";
    };
    
    return {
      student: {
        id: student.id,
        name: student.name,
        admissionNo: student.admissionNo,
        className: student.className,
      },
      session: selectedSession || { id: "", name: "Current Session" },
      terms,
      cumulativeAverage,
      cumulativeGrade: getGradeLetter(cumulativeAverage),
      overallRemarks: getRemarks(cumulativeAverage, getGradeLetter(cumulativeAverage)),
    };
  }, [selectedChild, grades, children, selectedSession]);

  const handlePrint = () => {
    window.print();
  };

  const handleChildSelect = (childId: string) => {
    setSelectedChild(childId);
    setCurrentTermIndex(0);
  };

  const nextTerm = () => {
    if (reportCardData && currentTermIndex < reportCardData.terms.length - 1) {
      setCurrentTermIndex(currentTermIndex + 1);
    }
  };

  const prevTerm = () => {
    if (currentTermIndex > 0) {
      setCurrentTermIndex(currentTermIndex - 1);
    }
  };

  if (childrenLoading || gradesLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
        <p className="ml-3 text-gray-600">Loading your data...</p>
      </div>
    );
  }

  // Show error if any
  if (childrenError || gradesError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Data</h3>
        <p className="text-red-600">Children error: {childrenError?.message || "None"}</p>
        <p className="text-red-600">Grades error: {gradesError?.message || "None"}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 print:space-y-2">
      {/* Debug Panel - Shows data status */}
      <div className="bg-gray-100 p-4 rounded-lg text-sm print:hidden">
        <h3 className="font-bold mb-2 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
          Debug Info:
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-gray-600">User Email:</p>
            <p className="font-mono text-xs">{user?.email || "Not logged in"}</p>
          </div>
          <div>
            <p className="text-gray-600">User Role:</p>
            <p className="font-mono text-xs">{user?.role || "Unknown"}</p>
          </div>
          <div>
            <p className="text-gray-600">Children Count:</p>
            <p className="font-mono text-xs font-bold">{children.length}</p>
          </div>
          <div>
            <p className="text-gray-600">Selected Child:</p>
            <p className="font-mono text-xs">{selectedChild || "None"}</p>
          </div>
          <div>
            <p className="text-gray-600">Grades Count:</p>
            <p className="font-mono text-xs">{grades.length}</p>
          </div>
          <div>
            <p className="text-gray-600">Selected Session:</p>
            <p className="font-mono text-xs">{selectedSession?.name || "None"}</p>
          </div>
        </div>
        {children.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-blue-600 hover:text-blue-700">
              View Children List ({children.length})
            </summary>
            <pre className="mt-2 text-xs overflow-auto max-h-40 bg-white p-2 rounded">
              {JSON.stringify(children, null, 2)}
            </pre>
          </details>
        )}
        {grades.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-blue-600 hover:text-blue-700">
              View Grades ({grades.length} records)
            </summary>
            <pre className="mt-2 text-xs overflow-auto max-h-40 bg-white p-2 rounded">
              {JSON.stringify(grades.slice(0, 5), null, 2)}
            </pre>
          </details>
        )}
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Child's Report Card</h1>
          <p className="text-gray-600">View your child's academic performance</p>
        </div>
        {reportCardData && (
          <div className="flex gap-3">
            <Button onClick={handlePrint} variant="primary" className="flex items-center gap-2">
              <PrinterIcon className="w-5 h-5" />
              Print Report Card
            </Button>
          </div>
        )}
      </div>

      {/* Child Selection */}
      <Card className="print:hidden">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Session Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Academic Session
              </label>
              <select
                value={selectedSession?.id || ""}
                onChange={(e) => {
                  const session = sessions.find((s) => s.id === e.target.value);
                  setSelectedSession(session || null);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Session</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name} {session.isActive ? "(Active)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Child Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Child
              </label>
              <select
                value={selectedChild}
                onChange={(e) => handleChildSelect(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a child</option>
                {children.map((child: any) => (
                  <option key={child.id} value={child.id}>
                    {child.name} - {child.className} ({child.admissionNo})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Report Card Content */}
      {reportCardData ? (
        <div className="bg-white rounded-lg shadow-lg print:shadow-none overflow-hidden">
          {/* School Header */}
          <div className="text-center py-6 border-b print:py-4">
            <h1 className="text-3xl font-bold text-blue-700 print:text-2xl">EXCELLENCE SCHOOL</h1>
            <p className="text-gray-600">123 Education Way, Lagos, Nigeria</p>
            <p className="text-gray-500 text-sm">Tel: +234 123 456 7890 | Email: info@excellenceschool.edu.ng</p>
            <h2 className="text-xl font-bold mt-4">STUDENT REPORT CARD</h2>
            <p className="text-gray-600">Academic Session: {reportCardData.session.name}</p>
          </div>

          {/* Student Information */}
          <div className="p-6 print:p-4 border-b">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Student Name</p>
                <p className="font-semibold text-gray-900">{reportCardData.student.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Admission Number</p>
                <p className="font-semibold text-gray-900">{reportCardData.student.admissionNo}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Class</p>
                <p className="font-semibold text-gray-900">{reportCardData.student.className}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Session</p>
                <p className="font-semibold text-gray-900">{reportCardData.session.name}</p>
              </div>
            </div>
          </div>

          {/* Term Navigation for Screen */}
          {reportCardData.terms.length > 0 && (
            <div className="border-b print:hidden">
              <div className="flex items-center justify-between px-4">
                <button
                  onClick={prevTerm}
                  disabled={currentTermIndex === 0}
                  className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeftIcon className="w-5 h-5" />
                </button>
                <div className="flex">
                  {reportCardData.terms.map((term, index) => (
                    <button
                      key={term.termId}
                      onClick={() => setCurrentTermIndex(index)}
                      className={`px-6 py-3 text-sm font-medium transition-colors ${
                        currentTermIndex === index
                          ? "border-b-2 border-blue-500 text-blue-600"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {term.termName}
                    </button>
                  ))}
                </div>
                <button
                  onClick={nextTerm}
                  disabled={currentTermIndex === reportCardData.terms.length - 1}
                  className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRightIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Term Result Table for Screen */}
          {reportCardData.terms.length > 0 && (
            <div className="p-6 print:hidden">
              {reportCardData.terms[currentTermIndex] && (
                <TermResultTable term={reportCardData.terms[currentTermIndex]} />
              )}
            </div>
          )}

          {/* All Terms for Print */}
          <div className="hidden print:block">
            {reportCardData.terms.map((term, index) => (
              <div key={term.termId}>
                {index > 0 && <div className="page-break"></div>}
                <TermResultTable term={term} />
              </div>
            ))}
          </div>

          {/* Cumulative Summary */}
          <div className="p-6 border-t bg-gray-50 print:p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <p className="text-sm text-gray-500">Overall Average</p>
                <p className="text-3xl font-bold text-blue-600">
                  {reportCardData.cumulativeAverage.toFixed(1)}%
                </p>
                <Badge
                  variant={
                    reportCardData.cumulativeGrade === "A"
                      ? "success"
                      : reportCardData.cumulativeGrade === "B" || reportCardData.cumulativeGrade === "C"
                      ? "warning"
                      : "danger"
                  }
                  className="mt-2"
                >
                  Grade: {reportCardData.cumulativeGrade}
                </Badge>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-gray-500">Parent/Guardian Remarks</p>
                <p className="text-gray-800 italic">{reportCardData.overallRemarks}</p>
                <div className="mt-3 pt-3 border-t">
                  <p className="text-sm text-gray-500">Parent's Signature</p>
                  <div className="h-8 border-b border-gray-400 w-48 mt-1"></div>
                  <p className="text-xs text-gray-400 mt-1">{new Date().toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg">
          {selectedChild ? (
            <>
              <ChartBarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Grades Found</h3>
              <p className="text-gray-500">
                No grades have been entered for your child in the selected session.
              </p>
              <p className="text-sm text-gray-400 mt-2">
                Selected child ID: {selectedChild}
              </p>
            </>
          ) : children.length === 0 ? (
            <>
              <UserIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Children Found</h3>
              <p className="text-gray-500">
                Your account is not linked to any students. Please contact the school administrator.
              </p>
            </>
          ) : (
            <>
              <UserIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Child</h3>
              <p className="text-gray-500">
                Please select a child from the dropdown above to view their report card.
              </p>
              <p className="text-sm text-gray-400 mt-2">
                Available children: {children.map((c: any) => c.name).join(", ")}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// Term Result Table Component
function TermResultTable({ term }: { term: TermResult }) {
  return (
    <div>
      <h3 className="text-lg font-bold text-gray-900 mb-4">{term.termName} Results</h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold">S/N</th>
              <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold">Subject</th>
              <th className="border border-gray-300 px-4 py-2 text-center text-sm font-semibold">CA (40)</th>
              <th className="border border-gray-300 px-4 py-2 text-center text-sm font-semibold">Exam (60)</th>
              <th className="border border-gray-300 px-4 py-2 text-center text-sm font-semibold">Total (100)</th>
              <th className="border border-gray-300 px-4 py-2 text-center text-sm font-semibold">Grade</th>
              <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold">Remarks</th>
             </tr>
          </thead>
          <tbody>
            {term.subjects.map((subject, idx) => (
              <tr key={subject.subjectId} className="hover:bg-gray-50">
                <td className="border border-gray-300 px-4 py-2 text-sm">{idx + 1}</td>
                <td className="border border-gray-300 px-4 py-2 text-sm font-medium">{subject.subjectName}</td>
                <td className="border border-gray-300 px-4 py-2 text-center text-sm">
                  {subject.ca !== null ? subject.ca : "-"}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-center text-sm">
                  {subject.exam !== null ? subject.exam : "-"}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-center text-sm font-semibold">
                  {subject.total !== null ? subject.total : "-"}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-center">
                  {subject.grade ? (
                    <Badge
                      variant={
                        subject.grade === "A"
                          ? "success"
                          : subject.grade === "B" || subject.grade === "C"
                          ? "warning"
                          : "danger"
                      }
                    >
                      {subject.grade}
                    </Badge>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-sm">
                  {getSubjectRemarks(subject.total)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-semibold">
              <td colSpan={4} className="border border-gray-300 px-4 py-2 text-right">
                Term Average:
              </td>
              <td className="border border-gray-300 px-4 py-2 text-center">
                {term.termAverage.toFixed(1)}%
              </td>
              <td className="border border-gray-300 px-4 py-2 text-center">
                <Badge
                  variant={
                    term.termGrade === "A"
                      ? "success"
                      : term.termGrade === "B" || term.termGrade === "C"
                      ? "warning"
                      : "danger"
                  }
                >
                  {term.termGrade}
                </Badge>
              </td>
              <td className="border border-gray-300 px-4 py-2 text-sm">
                {getTermRemarks(term.termAverage)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="mt-4 text-sm text-gray-500">
        <p>Summary: {term.subjectsPassed} out of {term.totalSubjects} subjects passed</p>
      </div>
    </div>
  );
}

// Helper functions
function getGradeLetter(score: number): string {
  if (score >= 70) return "A";
  if (score >= 60) return "B";
  if (score >= 50) return "C";
  if (score >= 45) return "D";
  if (score >= 40) return "E";
  return "F";
}

function getSubjectRemarks(score: number | null): string {
  if (score === null) return "Not graded";
  if (score >= 70) return "Excellent";
  if (score >= 60) return "Very Good";
  if (score >= 50) return "Good";
  if (score >= 45) return "Satisfactory";
  if (score >= 40) return "Fair";
  return "Needs Improvement";
}

function getTermRemarks(average: number): string {
  if (average >= 70) return "Excellent performance this term!";
  if (average >= 60) return "Very good performance. Keep it up!";
  if (average >= 50) return "Good effort. Aim higher next term!";
  if (average >= 45) return "Satisfactory. More effort needed.";
  if (average >= 40) return "Fair. Need to work harder.";
  return "Below average. Please focus more on your studies.";
}

export default ParentReportCard;