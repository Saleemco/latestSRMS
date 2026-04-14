import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { TermProvider } from "../context/TermContext";
import { cn } from "../../utils/cn";  // ← Fixed: go up 2 levels from components/

export const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  return (
    <TermProvider>
      <div className="min-h-screen bg-gray-50 w-full overflow-x-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        <div className={cn(
          "flex flex-col min-h-screen transition-all duration-300 ease-in-out",
          "w-full overflow-x-hidden",
          "lg:ml-64"
        )}>
          <Header onMenuClick={() => setSidebarOpen(true)} />
          
          <main className="flex-1 w-full overflow-x-hidden">
            <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
              <div className="w-full max-w-full">
                <Outlet />
              </div>
            </div>
          </main>
        </div>
      </div>
    </TermProvider>
  );
};

export default Layout;