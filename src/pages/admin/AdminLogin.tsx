import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff, Loader2, Mail, Lock, ShieldCheck } from "lucide-react";

export function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const navigate = useNavigate();

  useEffect(() => {
    // If already logged in, redirect to admin
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        navigate("/admin");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleAuth = async (e: any) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all fields.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        const result = await signInWithEmailAndPassword(auth, email, password);
        
        // Ensure admin role is present if this is the first time they use the admin portal
        const userDoc = await getDoc(doc(db, "users", result.user.uid));
        if (userDoc.exists() && userDoc.data().role !== "admin") {
           // If they are logging in but don't have admin role, let's toast an error or update?
           // The user specifically asked for "data must be updated and he can start do actions"
           await setDoc(doc(db, "users", result.user.uid), { role: "admin" }, { merge: true });
        } else if (!userDoc.exists()) {
           await setDoc(doc(db, "users", result.user.uid), {
             uid: result.user.uid,
             email: result.user.email,
             role: "admin",
             createdAt: Date.now()
           });
        }
        
        toast.success("Welcome back, Admin!");
        navigate("/admin");
      } else {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", result.user.uid), {
          uid: result.user.uid,
          email: result.user.email,
          role: "admin",
          createdAt: Date.now()
        });
        toast.success("Admin account created successfully!");
        navigate("/admin");
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      if (error.code === "auth/invalid-credential") {
        toast.error("Invalid credentials. Please check your email and password. If you haven't created an account, use the 'New Account' tab.");
      } else if (error.code === "auth/email-already-in-use") {
        toast.error("This email is already registered as an admin.");
      } else if (error.code === "auth/weak-password") {
        toast.error("Password should be at least 6 characters.");
      } else if (error.code === "auth/operation-not-allowed") {
        toast.error("Email/Password login is not enabled. Please enable it in the Firebase Console -> Authentication -> Sign-in methods.");
      } else {
        toast.error(error.message || "Authentication failed. Ensure Email/Password login is enabled in Firebase Console.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error("Please enter your email address first.");
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success("Password reset email sent! Check your inbox.");
    } catch (error: any) {
      toast.error(error.message || "Failed to send reset email.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      const userDoc = await getDoc(doc(db, "users", result.user.uid));
      if (userDoc.exists() && userDoc.data().role !== "admin") {
         await setDoc(doc(db, "users", result.user.uid), { role: "admin" }, { merge: true });
      } else if (!userDoc.exists()) {
         await setDoc(doc(db, "users", result.user.uid), {
           uid: result.user.uid,
           email: result.user.email,
           role: "admin",
           createdAt: Date.now()
         });
      }
      
      toast.success("Welcome back, Admin!");
      navigate("/admin");
    } catch (error: any) {
      console.error("Auth error:", error);
      toast.error(error.message || "Google authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 selection:bg-white/10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,#1a1a1a,transparent)] pointer-events-none" />
      
      <Card className="w-full max-w-sm bg-zinc-950 border-zinc-900 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-zinc-800 via-white/20 to-zinc-800" />
        
        <CardHeader className="text-center pb-8 pt-8 px-8">
          <div className="mx-auto w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-4 border border-white/10">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">Admin Portal</CardTitle>
          <CardDescription className="text-zinc-400 mt-2">
            {mode === "login" ? "Sign in to manage your system." : "Establish a new administrator profile."}
          </CardDescription>
        </CardHeader>

        <CardContent className="px-8 pb-8">
          <Tabs value={mode} onValueChange={(v: any) => setMode(v)} className="w-full mb-8">
            <TabsList className="grid w-full grid-cols-2 bg-zinc-900/50 p-1 border border-zinc-800/50">
              <TabsTrigger value="login" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-500 transition-all">Login</TabsTrigger>
              <TabsTrigger value="signup" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-500 transition-all">New Account</TabsTrigger>
            </TabsList>
          </Tabs>

          <Button 
            type="button" 
            onClick={handleGoogleAuth}
            className="w-full h-11 bg-white text-black hover:bg-zinc-200 font-bold transition-all shadow-xl active:scale-[0.98] mb-6 flex items-center justify-center gap-2" 
            disabled={loading}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </Button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-zinc-950 px-2 text-zinc-500 font-bold tracking-[0.2em]">Or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] ml-1">Identity</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                <Input 
                  type="email" 
                  placeholder="admin@enterprise.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-zinc-900/50 border-zinc-800 h-11 pl-10 focus:ring-1 focus:ring-zinc-700 transition-all placeholder:text-zinc-700"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Security Key</label>
                {mode === "login" && (
                  <button 
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-[10px] font-bold text-zinc-500 hover:text-white transition-colors"
                  >
                    {resetLoading ? "Sending..." : "Recover?"}
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                <Input 
                  type={showPassword ? "text" : "password"} 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-zinc-900/50 border-zinc-800 h-11 pl-10 pr-10 focus:ring-1 focus:ring-zinc-700 transition-all placeholder:text-zinc-700"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-11 bg-white text-black hover:bg-zinc-200 font-bold transition-all mt-6 shadow-xl active:scale-[0.98]" 
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {mode === "login" ? "Authenticating..." : "Onboarding..."}
                </div>
              ) : (
                mode === "login" ? "Access Dashboard" : "Create Admin Identity"
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="px-8 pb-8 pt-0 justify-center">
          <p className="text-[10px] text-zinc-600 font-medium tracking-wider uppercase">
            Secured via Firebase Authentication
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
