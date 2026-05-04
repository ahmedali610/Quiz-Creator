import { Outlet, Link } from "react-router-dom";
import { auth, db } from "../../lib/firebase";
import { signOut } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { ThemeToggle } from "@/components/ThemeToggle";

export function PlayerLayout() {
  const [username, setUsername] = useState<string>("");

  useEffect(() => {
    if (auth.currentUser) {
      getDoc(doc(db, "users", auth.currentUser.uid)).then(doc => {
         if(doc.exists()) setUsername(doc.data().username);
      });
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0B] text-slate-900 dark:text-white flex flex-col transition-colors duration-300">
      <header className="h-16 border-b border-slate-200 dark:border-white/10 flex items-center justify-between px-6 bg-white dark:bg-[#0A0A0B]/80 backdrop-blur-xl z-20">
        <Link to="/dashboard" className="text-xl font-black text-orange-500 tracking-tighter">QuizTeams</Link>
        <div className="flex items-center gap-4">
           {username && <span className="text-slate-500 dark:text-zinc-400 text-sm font-medium">@{username}</span>}
           <ThemeToggle />
           <Button variant="ghost" size="sm" onClick={() => signOut(auth)} className="text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white">Sign Out</Button>
        </div>
      </header>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
