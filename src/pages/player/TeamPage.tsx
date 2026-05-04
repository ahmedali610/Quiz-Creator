import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { collection, query, orderBy, onSnapshot, doc, getDoc, where } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OperationType, handleFirestoreError } from "@/lib/handleError";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "motion/react";
import { Trophy, PlayCircle, Star, Crown } from "lucide-react";

export function TeamPage() {
  const { id } = useParams();
  const [team, setTeam] = useState<any>(null);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<Record<string, any>>({});
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [myStats, setMyStats] = useState<any>(null);
  const [usersCache, setUsersCache] = useState<Record<string, any>>({});
  const prevTop3Ref = useRef<string[]>([]);
  
  useEffect(() => {
    if (!id || !auth.currentUser) return;
    
    // Team & My Stats
    getDoc(doc(db, "teams", id)).then(d => {
      if(d.exists()) setTeam({id: d.id, ...d.data()});
    });
    const unsubMyStats = onSnapshot(doc(db, `teams/${id}/members`, auth.currentUser.uid), doc => {
       if(doc.exists()) setMyStats(doc.data());
    });
    
    // Assigned Quizzes (from team subcollection)
    const unsubQuizzes = onSnapshot(query(collection(db, `teams/${id}/assigned_quizzes`)), snap => {
       const list = snap.docs.map(d => ({id: d.id, ...d.data()}));
       setQuizzes(list);
    }, err => handleFirestoreError(err, OperationType.GET, "assigned_quizzes"));

    // Fetch user's attempts in this team to check for completion
    const unsubAttempts = onSnapshot(query(collection(db, "quiz_attempts"), 
      where("userId", "==", auth.currentUser!.uid),
      where("teamId", "==", id)
    ), snap => {
       const atmp: Record<string, any> = {};
       snap.docs.forEach(docSnap => {
         const d = docSnap.data();
         atmp[d.quizId] = d;
       });
       setAttempts(atmp);
    });

    // Leaderboard (Real-time members)
    const unsubLeaderboard = onSnapshot(query(collection(db, `teams/${id}/members`), orderBy("totalScore", "desc")), async snap => {
       const members = snap.docs.map(d => ({id: d.id, ...d.data()}));
       setLeaderboard(members);
       
       // Detect if current user entered or moved up in top 3
       const top3Ids = members.slice(0,3).map((m: any) => m.userId);
       const prevTop3 = prevTop3Ref.current;
       
       const myId = auth.currentUser!.uid;
       const myCurrentIndex = top3Ids.indexOf(myId);
       const myPrevIndex = prevTop3.indexOf(myId);
       
       if (myCurrentIndex !== -1) {
         if (myPrevIndex === -1 || myCurrentIndex < myPrevIndex) {
           // I entered top 3, or moved up in top 3!
           confetti({ particleCount: 150, zIndex: 1000, spread: 80, origin: { y: 0.8 }, colors: ['#FFD700', '#F27D26', '#FFFFFF'] });
         }
       }
       prevTop3Ref.current = top3Ids;

       // Fetch user docs for usernames if missing
       const toFetch = members.filter((m: any) => !usersCache[m.userId]);
       if (toFetch.length > 0) {
         const newCache = {...usersCache};
         for(const m of toFetch as any[]) {
            const uDoc = await getDoc(doc(db, "users", m.userId));
            if(uDoc.exists()) newCache[m.userId] = uDoc.data();
         }
         setUsersCache(newCache);
       }
    }, err => handleFirestoreError(err, OperationType.GET, "members"));

    return () => { unsubMyStats(); unsubQuizzes(); unsubAttempts(); unsubLeaderboard(); };
  }, [id, usersCache]);

  if (!team || !myStats) return <div className="p-8 text-slate-500 dark:text-zinc-500">Loading team...</div>;

  const top3 = leaderboard.slice(0, 3);
  const others = leaderboard.slice(3);
  const myRank = leaderboard.findIndex((m: any) => m.userId === auth.currentUser?.uid) + 1;

  // Podium rendering helper
  const PodiumSpot = ({ member, rank, heightClass, colorClass }: any) => {
     if (!member) return <div className={`flex-1 ${heightClass} opacity-0 bg-white/5 mx-2 rounded-t-lg`} />;
     const isMe = member.userId === auth.currentUser?.uid;
     const user = usersCache[member.userId];
     
     return (
       <div className="flex-1 flex flex-col items-center justify-end mx-2">
         {rank === 1 && <Crown className="w-10 h-10 text-yellow-400 mb-4 drop-shadow-[0_0_20px_rgba(250,204,21,0.6)] motion-safe:animate-bounce" />}
         <div className="flex flex-col items-center mb-6 z-10 relative">
           <div className={`w-20 h-20 rounded-full border-4 ${colorClass} bg-slate-50 dark:bg-[#0A0A0B] flex items-center justify-center shadow-2xl relative`}>
              <span className="text-3xl font-black">{user?.username?.charAt(0).toUpperCase() || '?'}</span>
              {isMe && <div className="absolute -bottom-3 bg-gradient-to-r from-orange-500 to-orange-600 text-slate-900 dark:text-white text-[10px] px-3 py-1 rounded-full font-bold shadow-lg border border-orange-400/30">YOU</div>}
           </div>
           <div className="text-slate-900 dark:text-white font-bold mt-3 truncate w-24 text-center text-lg">{user?.username || 'Player'}</div>
           <div className="text-orange-500 font-black text-2xl drop-shadow-[0_0_10px_rgba(249,115,22,0.4)]">{member.totalScore}</div>
         </div>
         <motion.div 
           layoutId={`podium-${member.userId}`}
           className={`w-full ${heightClass} ${colorClass.replace('border-', 'bg-')}/20 border-t-[6px] ${colorClass} rounded-t-3xl relative overflow-hidden backdrop-blur-sm`}
           initial={{ opacity: 0, y: 50 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.5, ease: "easeOut" }}
         >
           <div className="absolute inset-0 bg-gradient-to-b from-slate-900 dark:from-white/10 to-transparent"></div>
           <div className="absolute inset-x-0 top-4 text-center text-5xl font-black text-slate-900 dark:text-white/20">{rank}</div>
         </motion.div>
       </div>
     );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0B] pb-12 pt-4 px-4 md:px-8">
       <div className="max-w-5xl mx-auto space-y-12">
          {/* Subtle background glow */}
          <div className="fixed top-[-20%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none z-0" />
          <div className="fixed bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-orange-600/5 rounded-full blur-[120px] pointer-events-none z-0" />
          
          <div className="relative z-10 w-full space-y-12">
            {/* 1. My Stats */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                 My Stats
              </h2>
        <div className="grid grid-cols-3 gap-4">
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
            <Card className="bg-white dark:bg-white/[0.02] backdrop-blur-md border-slate-200 dark:border-white/5 shadow-xl h-full rounded-3xl">
              <CardContent className="p-6 md:p-8">
                <div className="text-slate-500 dark:text-zinc-500 text-xs md:text-sm font-bold mb-2 uppercase tracking-widest">Total Score</div>
                <div className="text-4xl md:text-5xl font-black text-orange-500 drop-shadow-[0_0_15px_rgba(249,115,22,0.4)]">{myStats.totalScore}</div>
              </CardContent>
            </Card>
          </motion.div>
          
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
            <Card className="bg-white dark:bg-white/[0.02] backdrop-blur-md border-slate-200 dark:border-white/5 shadow-xl h-full rounded-3xl">
              <CardContent className="p-6 md:p-8">
                <div className="text-slate-500 dark:text-zinc-500 text-xs md:text-sm font-bold mb-2 uppercase tracking-widest">Quizzes</div>
                <div className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white">{myStats.quizzesCompleted}</div>
              </CardContent>
            </Card>
          </motion.div>
          
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
            <Card className="bg-white dark:bg-white/[0.02] backdrop-blur-md border-slate-200 dark:border-white/5 shadow-xl relative overflow-hidden h-full rounded-3xl">
              <CardContent className="p-6 md:p-8 relative z-10">
                <div className="text-slate-500 dark:text-zinc-500 text-xs md:text-sm font-bold mb-2 uppercase tracking-widest">Rank</div>
                <div className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white">#{myRank || '-'}</div>
              </CardContent>
              {myRank === 1 && <div className="absolute right-[-20px] top-[-20px] opacity-10"><Trophy className="w-40 h-40 text-yellow-400" /></div>}
            </Card>
          </motion.div>
        </div>
      </section>

      {/* 2. Quizzes */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center justify-between">
          Team Challenges
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quizzes.length === 0 && <div className="text-slate-500 dark:text-zinc-500 italic p-4 border border-slate-200 dark:border-white/5 rounded-lg">No quizzes assigned to your team yet.</div>}
          <AnimatePresence>
            {quizzes.map((aq, i) => {
              const isExpired = Date.now() > aq.expiresAt;
              const attempt = attempts[aq.quizId];
              const isCompleted = !!attempt;
              const canAccess = isCompleted || !isExpired;
              
              const cardContent = (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 + i*0.1 }}
                  whileHover={canAccess ? { scale: 1.02, y: -2 } : {}}
                  className="h-full"
                >
                  <Card className={`h-full bg-white dark:bg-white/[0.02] backdrop-blur-md transition-all rounded-3xl ${isExpired && !isCompleted ? 'opacity-50 grayscale border-slate-200 dark:border-white/5' : isCompleted ? 'border-green-500/20 shadow-[0_0_20px_rgba(34,197,94,0.1)]' : 'border-orange-500/20 hover:border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.1)]'}`}>
                    <CardContent className="p-6 md:p-8 flex items-center justify-between h-full">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{aq.quizTitle}</h3>
                        <div className="flex items-center gap-3">
                          {isExpired && !isCompleted ? (
                            <span className="text-[10px] bg-red-500/20 text-red-500 px-3 py-1 rounded-full uppercase font-bold tracking-widest border border-red-500/20">Expired</span>
                          ) : isCompleted ? (
                            <span className="text-[10px] bg-green-500/20 text-green-400 px-3 py-1 rounded-full uppercase font-bold tracking-widest border border-green-500/20">Completed</span>
                          ) : (
                            <span className="text-[10px] bg-orange-500/20 text-orange-500 px-3 py-1 rounded-full uppercase font-bold tracking-widest border border-orange-500/20 shadow-[0_0_10px_rgba(249,115,22,0.2)]">Active</span>
                          )}
                          {attempt && (
                            <p className="text-xs text-green-400 font-bold">Score: {attempt.score}/{attempt.maxScore}</p>
                          )}
                          {!attempt && (
                            <p className="text-xs text-slate-500 dark:text-zinc-500 font-medium">Expires {new Date(aq.expiresAt).toLocaleTimeString()}</p>
                          )}
                        </div>
                      </div>
                      {!isExpired && !isCompleted && (
                        <div className="bg-orange-500/10 hover:bg-orange-500 hover:text-slate-900 dark:text-white text-orange-500 rounded-full p-4 h-auto transition-all duration-300 ml-4 group">
                          <PlayCircle className="w-8 h-8 group-hover:scale-110 transition-transform" />
                        </div>
                      )}
                      {isCompleted && (
                        <div className="bg-green-500/10 text-green-500 rounded-full p-4 h-auto ml-4">
                          <Star className="w-8 h-8" fill="currentColor" />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );

            return canAccess ? (
              <Link key={aq.id} to={`/teams/${id}/quiz/${aq.quizId}`} className="block h-full">
                {cardContent}
              </Link>
            ) : (
              <div key={aq.id} className="h-full">
                {cardContent}
              </div>
            );
          })}
          </AnimatePresence>
        </div>
      </section>

      {/* 3. Leaderboard */}
      <section className="space-y-8 bg-white/[0.01] backdrop-blur-xl p-8 rounded-[40px] border border-slate-200 dark:border-white/5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-px bg-gradient-to-r from-transparent via-slate-800 dark:via-white/20 to-transparent" />
        <div className="absolute bottom-0 right-[-10%] w-[300px] h-[300px] bg-orange-600/5 rounded-full blur-[80px] pointer-events-none" />
        
        <div className="text-center relative z-10">
           <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-slate-900 dark:from-white to-white/40 tracking-tighter uppercase inline-block">Live Leaderboard</h2>
           <p className="text-orange-500 font-bold mt-2 tracking-widest text-sm uppercase">Total cumulative points 🔥</p>
        </div>

        {/* Podium */}
        <div className="flex items-end justify-center h-[300px] max-w-2xl mx-auto pt-8 relative z-10">
           {/* 2nd Place */}
           <PodiumSpot member={top3[1]} rank={2} heightClass="h-[70%]" colorClass="border-slate-300" />
           {/* 1st Place */}
           <PodiumSpot member={top3[0]} rank={1} heightClass="h-[100%]" colorClass="border-yellow-400" />
           {/* 3rd Place */}
           <PodiumSpot member={top3[2]} rank={3} heightClass="h-[50%]" colorClass="border-amber-700" />
        </div>

        {/* List */}
        {others.length > 0 && (
          <div className="max-w-2xl mx-auto space-y-2 mt-8">
             <AnimatePresence>
               {others.map((member, index) => {
                 const rank = index + 4;
                 const isMe = member.userId === auth.currentUser?.uid;
                 const user = usersCache[member.userId];
                 return (
                   <motion.div 
                     layout
                     initial={{ opacity: 0, scale: 0.95 }}
                     animate={{ opacity: 1, scale: 1 }}
                     key={member.id}
                     className={`flex items-center justify-between p-4 md:p-6 rounded-2xl transition-all ${isMe ? 'bg-orange-500/10 border border-orange-500/30 shadow-[0_0_20px_rgba(249,115,22,0.1)]' : 'bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 hover:bg-slate-200 dark:bg-white/[0.04]'}`}
                   >
                      <div className="flex items-center gap-4 md:gap-6">
                         <div className="w-8 text-center font-black text-slate-500 dark:text-zinc-500 text-xl">{rank}</div>
                         <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-[#0A0A0B] flex items-center justify-center font-bold text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 shadow-inner">
                            {user?.username?.charAt(0).toUpperCase()}
                         </div>
                         <div className="font-bold text-slate-900 dark:text-white text-lg">
                           {user?.username || 'Player'}
                           {isMe && <span className="ml-3 text-xs bg-gradient-to-r from-orange-500 to-orange-600 px-3 py-1 rounded-full text-slate-900 dark:text-white font-black tracking-widest shadow-lg">YOU</span>}
                         </div>
                      </div>
                      <div className="font-black text-2xl text-slate-900 dark:text-white tracking-tight">{member.totalScore}</div>
                   </motion.div>
                 )
               })}
             </AnimatePresence>
          </div>
        )}
      </section>
      </div>
      </div>
    </div>
  );
}
