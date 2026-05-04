import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, query, where, getDocs, doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { OperationType, handleFirestoreError } from "@/lib/handleError";
import confetti from "canvas-confetti";

export function JoinTeam() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [team, setTeam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    async function fetchTeam() {
      if (!auth.currentUser) {
        // We can't check membership if not logged in, but we can still fetch team info
      }

      try {
        const q = query(collection(db, "teams"), where("inviteToken", "==", token));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const docData = snap.docs[0];
          const teamData = { id: docData.id, ...docData.data() };
          setTeam(teamData);

          // Check if already a member
          if (auth.currentUser) {
            const memberRef = doc(db, `teams/${teamData.id}/members`, auth.currentUser.uid);
            const memberSnap = await getDoc(memberRef);
            if (memberSnap.exists()) {
              // Already joined, redirect immediately
              navigate(`/teams/${teamData.id}`);
              return;
            }
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, "teams");
      } finally {
        setLoading(false);
      }
    }
    fetchTeam();
  }, [token, navigate]);

  const handleJoin = async () => {
    if (!team) return;
    
    setJoining(true);
    let loggedInUid = auth.currentUser?.uid;

    if (!loggedInUid) {
      try {
        const { signInWithPopup, GoogleAuthProvider } = await import("firebase/auth");
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        loggedInUid = result.user.uid;
        
        const userDocRef = doc(db, "users", result.user.uid);
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists()) {
          // Send to onboarding
          await setDoc(userDocRef, {
            uid: result.user.uid,
            email: result.user.email,
            role: "player",
            createdAt: Date.now()
          });
        }
      } catch (error: any) {
        toast.error("Sign in failed: " + error.message);
        setJoining(false);
        return;
      }
    }

    try {
      const memberRef = doc(db, `teams/${team.id}/members`, loggedInUid);
      const memberSnap = await getDoc(memberRef);
      
      if (!memberSnap.exists()) {
        await setDoc(memberRef, {
          userId: loggedInUid,
          teamId: team.id,
          totalScore: 0,
          quizzesCompleted: 0,
          joinedAt: Date.now()
        });
      }

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#F27D26', '#FFFFFF', '#0A0A0A']
      });
      
      const userDocRef = doc(db, "users", loggedInUid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists() && !userDoc.data().username) {
         sessionStorage.setItem("returnUrl", `/teams/${team.id}`);
         navigate("/onboarding/username");
      } else {
         navigate(`/teams/${team.id}`);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `teams/${team.id}/members`);
      toast.error("Could not join team.");
    } finally {
      setJoining(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0B] flex items-center justify-center text-zinc-500">Loading invite...</div>;

  if (!team) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0B] flex flex-col items-center justify-center space-y-4">
        <h1 className="text-slate-900 dark:text-white text-2xl font-bold">Invalid or expired invite link</h1>
        <Button onClick={() => navigate("/")} variant="outline">Go Home</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0B] flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-sm bg-white dark:bg-[#1C1E23] border-slate-200 dark:border-white/5 text-slate-900 dark:text-white">
        {team.coverUrl && (
           <img src={team.coverUrl} className="w-full h-32 object-cover rounded-t-lg" alt="Team Cover" />
        )}
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-3xl font-bold">{team.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-4 text-center">
          <p className="text-zinc-400">You've been invited to join this team!</p>
          <Button 
            className="w-full bg-[#F27D26] hover:bg-[#d96a1b] text-white text-lg h-12"
            onClick={handleJoin}
            disabled={joining}
          >
            {joining ? "Joining..." : auth.currentUser ? "Join Team" : "Sign in & Join Team"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
