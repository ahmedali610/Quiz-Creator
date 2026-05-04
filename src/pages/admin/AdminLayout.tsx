import { Outlet, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, FileQuestion, LogOut } from "lucide-react";
import { auth } from "../../lib/firebase";
import { signOut } from "firebase/auth";

export function AdminLayout() {
  const location = useLocation();
  
  const navItems = [
    { name: "Dashboard", path: "/admin", icon: LayoutDashboard },
    { name: "Teams", path: "/admin/teams", icon: Users },
    { name: "Quizzes", path: "/admin/quizzes", icon: FileQuestion },
  ];

  return (
    <div className="min-h-screen bg-[#151619] text-white flex">
      {/* Sidebar */}
      <div className="w-64 border-r border-white/10 p-6 flex flex-col">
        <h2 className="text-xl font-black tracking-tight mb-10 text-[#F27D26]">QUIZ CONTROL</h2>
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const active = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
            return (
              <Link 
                key={item.name} 
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium text-sm
                  ${active ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            )
          })}
        </nav>
        <button 
          onClick={() => signOut(auth)}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors font-medium text-sm mt-auto"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
