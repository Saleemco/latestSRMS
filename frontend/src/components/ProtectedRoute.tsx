import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Spinner } from "./ui/Spinner";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  requireClassTeacher?: boolean;
}

export const ProtectedRoute = ({ children, allowedRoles, requireClassTeacher }: ProtectedRouteProps) => {
  const { user, isLoading, isClassTeacher } = useAuth();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check role-based access
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Check class teacher requirement
  if (requireClassTeacher && !isClassTeacher) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;