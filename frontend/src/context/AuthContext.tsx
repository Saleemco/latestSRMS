import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../services/auth.service";
import { dashboardService } from "../services/dashboard.service";
import toast from "react-hot-toast";

// Define User type here instead of importing from types.ts
interface User {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  role: string;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface AuthContextType {
  user: User | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
  isClassTeacher: boolean;
  classTeacherClass: any;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClassTeacher, setIsClassTeacher] = useState(false);
  const [classTeacherClass, setClassTeacherClass] = useState(null);
  const navigate = useNavigate();

  // Helper function to format user data and extract firstName/lastName
  const formatUserData = (userData: any): User => {
    // If user already has firstName and lastName
    if (userData.firstName && userData.lastName) {
      return userData;
    }

    // If user has name field, split it into firstName and lastName
    if (userData.name) {
      const nameParts = userData.name.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      return {
        ...userData,
        firstName,
        lastName,
      };
    }

    // If only email is available
    if (userData.email) {
      const emailName = userData.email.split('@')[0];
      return {
        ...userData,
        firstName: emailName,
        lastName: '',
      };
    }

    return userData;
  };

  // Check if teacher is a class teacher
  const checkClassTeacherStatus = async (userData: User) => {
    console.log('🔍 AuthContext: Checking class teacher status for', userData.email, 'role:', userData.role);

    if (userData.role === 'TEACHER') {
      try {
        console.log('📡 AuthContext: Calling getClassTeacherStatus API...');
        const response = await dashboardService.getClassTeacherStatus();
        console.log('📡 AuthContext: API response:', response);

        const status = response?.data;
        console.log('📡 AuthContext: status data:', status);

        const hasClass = status?.isClassTeacher || false;
        console.log('✅ AuthContext: isClassTeacher =', hasClass);

        setIsClassTeacher(hasClass);
        setClassTeacherClass(status?.class || null);
      } catch (error) {
        console.error('❌ AuthContext: Error checking class teacher status:', error);
        setIsClassTeacher(false);
        setClassTeacherClass(null);
      }
    } else if (userData.role === 'CLASS_TEACHER') {
      console.log('✅ AuthContext: User has CLASS_TEACHER role');
      setIsClassTeacher(true);
    } else {
      console.log('ℹ️ AuthContext: User role is', userData.role, '- not a teacher');
      setIsClassTeacher(false);
      setClassTeacherClass(null);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      console.log('🚀 AuthContext: Initializing auth...');
      const token = localStorage.getItem("token");
      if (token) {
        try {
          const userData = await authService.getMe();
          const formattedUser = formatUserData(userData);
          console.log('✅ AuthContext: User loaded:', formattedUser.email, 'role:', formattedUser.role);
          setUser(formattedUser);
          await checkClassTeacherStatus(formattedUser);
        } catch (error) {
          console.error("❌ AuthContext: Init error:", error);
          localStorage.removeItem("token");
        }
      } else {
        console.log('ℹ️ AuthContext: No token found');
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    try {
      console.log('🔐 AuthContext: Logging in...');
      const response = await authService.login(credentials);

      if (response.token && response.user) {
        console.log('✅ AuthContext: Login successful for', response.user.email);
        localStorage.setItem("token", response.token);

        const formattedUser = formatUserData(response.user);
        setUser(formattedUser);
        await checkClassTeacherStatus(formattedUser);

        const displayName = formattedUser.firstName || formattedUser.name || 'User';
        toast.success(`Welcome back, ${displayName}!`);
        navigate("/dashboard");
      } else {
        toast.error("Login failed: Invalid server response");
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || "Login failed";
      toast.error(errorMessage);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
    setIsClassTeacher(false);
    setClassTeacherClass(null);
    toast.success("Logged out successfully");
    navigate("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isLoading,
        isAuthenticated: !!user,
        isClassTeacher,
        classTeacherClass,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthContext;