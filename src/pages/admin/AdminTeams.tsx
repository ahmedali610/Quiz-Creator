import * as React from "react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, setDoc, doc, deleteDoc } from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Users, Trash2 } from "lucide-react";
import { OperationType, handleFirestoreError } from "@/lib/handleError";
import { toast } from "sonner";

export function AdminTeams() {
  const [teams, setTeams] = useState<any[]>([]);
  const [newTeamName, setNewTeamName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "teams"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setTeams(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "teams");
    });
    return unsub;
  }, []);

  const handleDeleteTeam = async (teamId: string) => {
    // Optimistic UI update (optional or manual filtering)
    setTeams(prev => prev.filter(t => t.id !== teamId));

    try {
      await deleteDoc(doc(db, "teams", teamId));
      toast.success("Team deleted successfully");
    } catch (error: any) {
      // Revert if failed (though onSnapshot will eventually bring it back if we don't)
      toast.error("Failed to delete team. Check your permissions.");
      handleFirestoreError(error, OperationType.DELETE, `teams/${teamId}`);
    }
  };

  const handleCreateTeam = async (e: any) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    setLoading(true);
    
    try {
      const inviteToken = crypto.randomUUID();
      const docRef = doc(collection(db, "teams"));
      await setDoc(docRef, {
        name: newTeamName.trim(),
        inviteToken,
        createdBy: auth.currentUser?.uid,
        createdAt: Date.now()
      });
      setIsDialogOpen(false);
      setNewTeamName("");
      toast.success("Team created successfully");
      navigate(`/admin/teams/${docRef.id}`);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.CREATE, "teams");
      toast.error("Failed to create team: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Teams</h1>
          <p className="text-zinc-400 mt-2">Manage all the teams participating in quizzes.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger 
            render={
              <Button className="bg-[#F27D26] hover:bg-[#d96a1b] text-white">
                <Plus className="w-4 h-4 mr-2" />
                Create Team
              </Button>
            }
          />
          <DialogContent className="bg-[#1C1E23] text-white border-white/10">
            <DialogHeader>
              <DialogTitle>Create New Team</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateTeam} className="space-y-4 pt-4">
              <Input 
                placeholder="Team Name" 
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                className="bg-black/50 border-white/10"
                required
              />
              <Button type="submit" className="w-full bg-white text-black hover:bg-zinc-200" disabled={loading}>
                {loading ? "Creating..." : "Create Team"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map(team => (
          <div key={team.id} className="relative group">
            <Link to={`/admin/teams/${team.id}`} className="block h-full">
              <Card className="bg-[#1C1E23] border-white/5 text-white hover:border-white/20 transition-colors cursor-pointer h-full">
                <CardHeader>
                  <CardTitle>{team.name}</CardTitle>
                  <CardDescription className="text-zinc-400">
                    Created {new Date(team.createdAt).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-zinc-400 text-sm gap-2">
                    <Users className="w-4 h-4" />
                    <span>Click to view members & details</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Button 
              variant="ghost" 
              size="icon" 
              className={`absolute top-4 right-4 transition-all z-10 ${confirmDeleteId === team.id ? 'opacity-100 text-red-500 bg-red-500/20' : 'opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-500 hover:bg-red-500/10'}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (confirmDeleteId === team.id) {
                  handleDeleteTeam(team.id);
                  setConfirmDeleteId(null);
                } else {
                  setConfirmDeleteId(team.id);
                  setTimeout(() => setConfirmDeleteId(null), 3000);
                }
              }}
            >
              <Trash2 className="w-4 h-4" />
              {confirmDeleteId === team.id && <span className="absolute -top-8 right-0 bg-red-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap shadow-lg">Click to confirm delete</span>}
            </Button>
          </div>
        ))}
        {teams.length === 0 && (
          <div className="col-span-full py-12 text-center text-zinc-500">
            No teams created yet.
          </div>
        )}
      </div>
    </div>
  );
}
