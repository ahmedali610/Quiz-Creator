import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { toast } from "sonner";
import { OperationType, handleFirestoreError } from "@/lib/handleError";

export function LandingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handlePlayerLogin = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const userDocRef = doc(db, "users", result.user.uid);
      try {
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists()) {
          // Send to onboarding
          await setDoc(userDocRef, {
            uid: result.user.uid,
            email: result.user.email,
            role: "player",
            createdAt: Date.now()
          });
          navigate("/onboarding/username");
        } else {
          navigate("/dashboard");
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${result.user.uid}`);
      }
    } catch (error: any) {
      if (error.code === "auth/popup-closed-by-user") {
        toast.error("Sign in cancelled.");
      } else if (error.code === "auth/invalid-credential") {
        toast.error("Sign in failed: Invalid credentials provided.");
      } else {
        toast.error("Failed to sign in: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h1 className="text-6xl font-bold text-white tracking-tighter mb-4">QuizTeams</h1>
          <p className="text-zinc-400 text-lg">Compete in live team quizzes.</p>
        </div>
        <div className="space-y-4">
          <Button 
            className="w-full h-14 text-lg bg-[#F27D26] hover:bg-[#d96a1b] text-white"
            onClick={handlePlayerLogin}
            disabled={loading}
          >
            I'm a player (Sign in with Google)
          </Button>
          <div className="pt-4">
            <Link to="/admin/login">
              <Button variant="outline" className="w-full h-12 text-zinc-400 border-zinc-800 hover:bg-zinc-900 hover:text-white">
                Admin Login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
