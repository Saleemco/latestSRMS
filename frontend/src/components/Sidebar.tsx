import { Fragment, useMemo } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
    HomeIcon,
    UsersIcon,
    AcademicCapIcon,
    CurrencyDollarIcon,
    ChartBarIcon,
    Cog6ToothIcon,
    BookOpenIcon,
    DocumentTextIcon,
    UserGroupIcon,
    CalendarIcon,
    CheckCircleIcon,
    ClockIcon,
    ChatBubbleLeftRightIcon,
} from "@heroicons/react/24/outline";

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
    const { user } = useAuth();
    const location = useLocation();
    const isClassTeacherRoute = location.pathname.startsWith('/class-teacher');

    // Build navigation items dynamically based on user role
    const hasClassTeacherAccess = user?.role === "CLASS_TEACHER" || isClassTeacherRoute;
    const navigationItems = useMemo(() => {
        const items = [];

        // Dashboard - everyone sees this
        items.push({ name: "Dashboard", href: "/dashboard", icon: HomeIcon });

        // Students - different for Class Teachers vs others
        if (hasClassTeacherAccess) {
            items.push({ name: "My Students", href: "/class-teacher/students", icon: UsersIcon });
        } else if (user?.role === "TEACHER" || user?.role === "ADMIN" || user?.role === "PRINCIPAL") {
            items.push({ name: "Students", href: "/students", icon: UsersIcon });
        }

        // Teachers - only Admin/Principal
        if (user?.role === "ADMIN" || user?.role === "PRINCIPAL") {
            items.push({ name: "Teachers", href: "/teachers", icon: AcademicCapIcon });
        }

        // Parents - only Admin/Principal
        if (user?.role === "ADMIN" || user?.role === "PRINCIPAL") {
            items.push({ name: "Parents", href: "/parents", icon: UserGroupIcon });
        }

        // Classes - only Admin/Principal
        if (user?.role === "ADMIN" || user?.role === "PRINCIPAL") {
            items.push({ name: "Classes", href: "/classes", icon: AcademicCapIcon });
        }

        // Subjects - Admin, Principal, Teacher, Class Teacher
        if (user?.role === "ADMIN" || user?.role === "PRINCIPAL" || user?.role === "TEACHER" || hasClassTeacherAccess) {
            items.push({ name: "Subjects", href: "/subjects", icon: BookOpenIcon });
        }

        // Results - Admin, Principal, Teacher, Class Teacher
        if (user?.role === "ADMIN" || user?.role === "PRINCIPAL" || user?.role === "TEACHER" || hasClassTeacherAccess) {
            items.push({ name: "Enter Results", href: "/teacher-results", icon: ChartBarIcon });
        }

        // Report Card - everyone except Bursar
        if (user?.role !== "BURSAR") {
            let reportCardHref = "/teacher/report-card";
            if (user?.role === "PARENT") reportCardHref = "/parent/report-card";
            if (user?.role === "STUDENT") reportCardHref = "/student/report-card";
            items.push({ name: "Report Card", href: reportCardHref, icon: DocumentTextIcon });
        }

        // Fees - Admin, Principal, Bursar, Parent
        if (user?.role === "ADMIN" || user?.role === "PRINCIPAL" || user?.role === "BURSAR") {
            items.push({ name: "Fees", href: "/fees", icon: CurrencyDollarIcon });
        } else if (user?.role === "PARENT") {
            items.push({ name: "Fees", href: "/parent-fees", icon: CurrencyDollarIcon });
        }

        // CLASS TEACHER SPECIFIC FEATURES
        if (hasClassTeacherAccess) {
            items.push({ name: "Take Attendance", href: "/class-teacher/attendance", icon: CheckCircleIcon });
            items.push({ name: "Attendance History", href: "/attendance-history", icon: ClockIcon });
            items.push({ name: "Add Comments", href: "/class-teacher/comments", icon: ChatBubbleLeftRightIcon });
            items.push({ name: "Student Performance", href: "/class-teacher/performance", icon: ChartBarIcon });
        }

        // Sessions - only Admin/Principal
        if (user?.role === "ADMIN" || user?.role === "PRINCIPAL") {
            items.push({ name: "Sessions", href: "/admin/sessions", icon: CalendarIcon });
        }

        // Terms - only Admin/Principal
        if (user?.role === "ADMIN" || user?.role === "PRINCIPAL") {
            items.push({ name: "Terms", href: "/admin/terms", icon: CalendarIcon });
        }

        // Class Teacher Assignment - only Admin/Principal
        if (user?.role === "ADMIN" || user?.role === "PRINCIPAL") {
            items.push({ name: "Class Teacher", href: "/admin/class-teacher-assignment", icon: UserGroupIcon });
        }

        // Settings - only Admin/Principal
        if (user?.role === "ADMIN" || user?.role === "PRINCIPAL") {
            items.push({ name: "Settings", href: "/settings", icon: Cog6ToothIcon });
        }

        return items;
    }, [user?.role]);

    return (
        <>
            <Transition.Root show={isOpen} as={Fragment}>
                <Dialog as="div" className="relative z-50 lg:hidden" onClose={onClose}>
                    <Transition.Child
                        as={Fragment}
                        enter="transition-opacity ease-linear duration-300"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="transition-opacity ease-linear duration-300"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-gray-900/80 dark:bg-black/80" />
                    </Transition.Child>

                    <div className="fixed inset-0 flex">
                        <Transition.Child
                            as={Fragment}
                            enter="transition ease-in-out duration-300 transform"
                            enterFrom="-translate-x-full"
                            enterTo="translate-x-0"
                            leave="transition ease-in-out duration-300 transform"
                            leaveFrom="translate-x-0"
                            leaveTo="-translate-x-full"
                        >
                            <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
                                <Transition.Child
                                    as={Fragment}
                                    enter="ease-in-out duration-300"
                                    enterFrom="opacity-0"
                                    enterTo="opacity-100"
                                    leave="ease-in-out duration-300"
                                    leaveFrom="opacity-100"
                                    leaveTo="opacity-0"
                                >
                                    <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                                        <button type="button" className="-m-2.5 p-2.5" onClick={onClose}>
                                            <span className="sr-only">Close sidebar</span>
                                            <XMarkIcon className="h-6 w-6 text-white dark:text-gray-300" aria-hidden="true" />
                                        </button>
                                    </div>
                                </Transition.Child>
                                <SidebarContent navigation={navigationItems} />
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </Dialog>
            </Transition.Root>

            <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
                <SidebarContent navigation={navigationItems} />
            </div>
        </>
    );
};

const SidebarContent = ({ navigation }: { navigation: any[] }) => (
    <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white dark:bg-gray-900 px-6 pb-4 border-r border-gray-200 dark:border-gray-800 transition-colors">
        <div className="flex h-16 shrink-0 items-center">
            <img
                className="h-8 w-auto"
                src="/vite.svg"
                alt="School Management"
            />
            <span className="ml-2 text-xl font-semibold text-gray-900 dark:text-white transition-colors">SchoolMS</span>
        </div>
        <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
                <li>
                    <ul role="list" className="-mx-2 space-y-1">
                        {navigation.map((item) => (
                            <li key={item.name}>
                                <NavLink
                                    to={item.href}
                                    className={({ isActive }) => {
                                        return 'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold transition-colors ' +
                                            (isActive 
                                                ? 'bg-gray-50 dark:bg-gray-800 text-indigo-600 dark:text-indigo-400' 
                                                : 'text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-800');
                                    }}
                                >
                                    <item.icon className="h-6 w-6 shrink-0 text-gray-400 dark:text-gray-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" aria-hidden="true" />
                                    {item.name}
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                </li>
            </ul>
        </nav>
    </div>
);

export default Sidebar;