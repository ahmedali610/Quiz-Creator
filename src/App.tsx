import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./lib/firebase";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/ThemeProvider";

// Layouts & Pages (Imports to be resolved)
import { LandingPage } from "./pages/LandingPage";
import { AdminLogin } from "./pages/admin/AdminLogin";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { AdminTeams } from "./pages/admin/AdminTeams";
import { AdminTeamDetail } from "./pages/admin/AdminTeamDetail";
import { AdminQuizzes } from "./pages/admin/AdminQuizzes";
import { AdminQuizBuilder } from "./pages/admin/AdminQuizBuilder";

import { PlayerLayout } from "./pages/player/PlayerLayout";
import { JoinTeam } from "./pages/player/JoinTeam";
import { Onboarding } from "./pages/player/Onboarding";
import { PlayerDashboard } from "./pages/player/PlayerDashboard";
import { TeamPage } from "./pages/player/TeamPage";
import { QuizPlayer } from "./pages/player/QuizPlayer";

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<"admin" | "player" | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubDoc: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        // Use real-time listener for user role
        unsubDoc = onSnapshot(doc(db, "users", u.uid), (docSnap) => {
          if (docSnap.exists()) {
            setRole(docSnap.data().role || "player");
          } else {
            setRole("player");
          }
          setLoading(false);
        });
      } else {
        setUser(null);
        setRole(null);
        if (unsubDoc) unsubDoc();
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubDoc) unsubDoc();
    };
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-black"><span className="text-white">Loading...</span></div>;
  }

  return (
    <ThemeProvider defaultTheme="dark" storageKey="app-theme">
      <Router>
        <Toaster />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          
          {/* Admin Routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={role === "admin" ? <AdminLayout /> : <Navigate to="/admin/login" />}>
            <Route index element={<AdminDashboard />} />
            <Route path="teams" element={<AdminTeams />} />
            <Route path="teams/:id" element={<AdminTeamDetail />} />
            <Route path="quizzes" element={<AdminQuizzes />} />
            <Route path="quizzes/new" element={<AdminQuizBuilder />} />
            <Route path="quizzes/:id/edit" element={<AdminQuizBuilder />} />
          </Route>

          {/* Player Routes */}
          <Route path="/join/:token" element={<JoinTeam />} />
          <Route path="/onboarding/username" element={user && role !== "admin" ? <Onboarding /> : <Navigate to="/" />} />
          
          <Route path="/" element={user && role !== "admin" ? <PlayerLayout /> : <Navigate to="/" />}>
            <Route path="dashboard" element={<PlayerDashboard />} />
            <Route path="teams/:id" element={<TeamPage />} />
          </Route>

          <Route path="/teams/:teamId/quiz/:id" element={user && role !== "admin" ? <QuizPlayer /> : <Navigate to="/" />} />
          
        </Routes>
      </Router>
    </ThemeProvider>
  );
}
