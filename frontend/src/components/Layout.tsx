import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { TermProvider } from "../context/TermContext";
import { TermSelector } from "./ui/TermSelector";

export const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Close sidebar on route change on mobile
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  return (
    <TermProvider>
      <div className="min-h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="lg:pl-64 flex flex-col flex-1">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 pb-8">
            <div className="py-4 sm:py-6">
              <div className="mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
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