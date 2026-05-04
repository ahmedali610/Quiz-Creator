import { useEffect, useState } from "react";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, ArrowRight } from "lucide-react";
import { OperationType, handleFirestoreError } from "@/lib/handleError";

export function PlayerDashboard() {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUserTeams() {
      if (!auth.currentUser) return;
      try {
        // Find all "members" documents where userId is this user.
        // Wait, Firestore doesn't support collectionGroup queries properly without indexes, 
        // and our blueprint has /teams/{teamId}/members/{userId}.
        // However, I can just use a Collection Group query if I had an index. 
        // But since we can't easily rely on collectionGroup without manual index, 
        // let's do a trick: we don't have collectionGroup indexed.
        // I will instead fetch ALL teams and then check membership, OR 
        // if this app has too many teams, we can't.
        // Actually, we CAN use a collectionGroup query using `collectionGroup(db, 'members')` with a where.
        // Oh wait, without an index, it might fail. Let's try it.
        const snap = await getDocs(query(collection(db, "teams")));
        const joinedTeams = [];
        
        // This is not scalable for 100k teams, but AI Studio is an MVP environment.
        for (const tDoc of snap.docs) {
           const memberDoc = await getDoc(doc(db, `teams/${tDoc.id}/members`, auth.currentUser.uid));
           if(memberDoc.exists()) {
             joinedTeams.push({ id: tDoc.id, ...tDoc.data(), membership: memberDoc.data() });
           }
        }
        setTeams(joinedTeams);
      } catch (error) {
         handleFirestoreError(error, OperationType.GET, "teams/members");
      } finally {
        setLoading(false);
      }
    }
    loadUserTeams();
  }, []);

  if (loading) return <div className="p-8 text-zinc-500">Loading your teams...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-white mb-2">My Teams</h1>
        <p className="text-zinc-400">Teams you have joined via invite.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map(team => (
          <Link key={team.id} to={`/teams/${team.id}`}>
            <Card className="bg-[#1C1E23] border-white/5 text-white hover:border-[#F27D26]/50 transition-colors h-full cursor-pointer relative overflow-hidden group">
              <CardHeader>
                <CardTitle>{team.name}</CardTitle>
                <CardDescription className="text-zinc-400">
                  Joined {new Date(team.membership.joinedAt).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center mt-4">
                  <div className="text-sm font-medium text-zinc-300">
                    Score: <span className="text-white font-bold">{team.membership.totalScore}</span>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-[#F27D26] group-hover:text-white transition-colors">
                     <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}

        {teams.length === 0 && (
          <div className="col-span-full text-center py-20 bg-[#1C1E23] border border-white/5 rounded-2xl border-dashed">
            <Users className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No teams yet</h3>
            <p className="text-zinc-400">You need an invite link from an admin to join a team.</p>
          </div>
        )}
      </div>
    </div>
  );
}
