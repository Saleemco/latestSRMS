import { Bars3Icon, BellIcon, ArrowRightOnRectangleIcon } from "@heroicons/react/24/outline";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { TermSelector } from "./ui/TermSelector";

interface HeaderProps {
  onMenuClick: () => void;
}

export const Header = ({ onMenuClick }: HeaderProps) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const getUserInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`;
    }
    if (user?.name) {
      return user.name.split(' ').map(n => n[0]).join('').substring(0, 2);
    }
    return user?.email?.[0]?.toUpperCase() || 'U';
  };

  const getUserName = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user?.name) {
      return user.name;
    }
    return user?.email?.split('@')[0] || 'User';
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm sm:px-6 lg:px-8">
      {/* Left side - Menu button for mobile */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
          onClick={onMenuClick}
        >
          <span className="sr-only">Open sidebar</span>
          <Bars3Icon className="h-6 w-6" aria-hidden="true" />
        </button>
        
        {/* Logo / Brand */}
        <div className="flex-shrink-0">
          <h1 className="text-lg font-bold text-gray-800">SchoolMS</h1>
        </div>
      </div>

      {/* Center - Term Selector */}
      <div className="flex-1 flex justify-center px-4">
        <TermSelector />
      </div>

      {/* Right side - User info and logout */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Notification Bell */}
        <button type="button" className="relative p-2 text-gray-400 hover:text-gray-500">
          <BellIcon className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
          <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-500"></span>
        </button>

        {/* User Info */}
        <div className="hidden sm:flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white">
            <span className="text-sm font-medium">{getUserInitials()}</span>
          </div>
          <span className="text-sm font-medium text-gray-700">{getUserName()}</span>
        </div>

        {/* Logout Button - Direct, no dropdown */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          <ArrowRightOnRectangleIcon className="h-5 w-5" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
};

export default Header;