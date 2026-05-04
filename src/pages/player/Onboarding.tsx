import { useState } from "react";
import { auth, db } from "../../lib/firebase";
import { doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { OperationType, handleFirestoreError } from "@/lib/handleError";

export function Onboarding() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSetUsername = async (e: any) => {
    e.preventDefault();
    const regex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!regex.test(username)) {
      toast.error("Username must be 3-20 characters, alphanumeric & underscores only.");
      return;
    }
    
    setLoading(true);
    try {
      // Very basic uniqueness check
      const q = query(collection(db, "users"), where("username", "==", username));
      const snap = await getDocs(q);
      if (!snap.empty) {
        toast.error("Username is already taken.");
        setLoading(false);
        return;
      }

      await updateDoc(doc(db, "users", auth.currentUser!.uid), {
        username,
        updatedAt: Date.now()
      });
      const returnUrl = sessionStorage.getItem("returnUrl");
      if (returnUrl) {
         sessionStorage.removeItem("returnUrl");
         navigate(returnUrl);
      } else {
         navigate("/dashboard");
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser?.uid}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#1C1E23] p-8 rounded-2xl border border-white/5 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Choose your username</h1>
          <p className="text-zinc-400 text-sm">This is how you'll appear on the leaderboards.</p>
        </div>
        <form onSubmit={handleSetUsername} className="space-y-4">
          <Input 
            autoFocus
            placeholder="e.g. quiz_master_99" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="bg-black/50 border-white/10 text-white text-lg h-12"
          />
          <Button type="submit" className="w-full h-12 bg-[#F27D26] hover:bg-[#d96a1b] text-white" disabled={loading}>
            {loading ? "Saving..." : "Start Journey"}
          </Button>
        </form>
      </div>
    </div>
  );
}
