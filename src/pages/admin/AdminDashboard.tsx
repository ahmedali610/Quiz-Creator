import { useEffect, useState } from "react";
import { collection, getCountFromServer, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileQuestion, CheckCircle, Zap } from "lucide-react";
import { OperationType, handleFirestoreError } from "@/lib/handleError";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';

export function AdminDashboard() {
  const [stats, setStats] = useState({
    teams: 0,
    players: 0,
    quizzes: 0,
    attempts: 0
  });

  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      // Check role again to be absolutely sure
      const u = auth.currentUser;
      if (u) {
        const userDoc = await getDoc(doc(db, "users", u.uid));
        if (userDoc.exists() && userDoc.data().role !== "admin") {
          toast.error("You do not have administrative privileges. Actions may fail.");
        }
      }

      try {
        const [teamsSnap, playersSnap, quizzesSnap, attemptsSnap] = await Promise.all([
          getCountFromServer(collection(db, "teams")),
          getCountFromServer(collection(db, "users")),
          getCountFromServer(collection(db, "quizzes")),
          getCountFromServer(collection(db, "quiz_attempts"))
        ]);
        
        setStats({
          teams: teamsSnap.data().count,
          // Subtract 1 if admin is part of users list
          players: Math.max(0, playersSnap.data().count - 1), 
          quizzes: quizzesSnap.data().count,
          attempts: attemptsSnap.data().count
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, "multiple collections");
      }
    }
    fetchStats();
  }, []);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const qzSnap = await getDocs(query(collection(db, "quizzes"), where("status", "==", "published")));
        const quizzes = qzSnap.docs.map(d => ({id: d.id, title: d.data().title || "Untitled"}));
        
        const attemptsSnap = await getDocs(collection(db, "quiz_attempts"));
        const attempts = attemptsSnap.docs.map(d => ({id: d.id, ...d.data()} as any));
        
        const quizQuestions: Record<string, any[]> = {};
        await Promise.all(quizzes.map(async (q) => {
           const snap = await getDocs(collection(db, `quizzes/${q.id}/questions`));
           quizQuestions[q.id] = snap.docs.map(d => ({id: d.id, ...d.data()}));
        }));
        
        const data = quizzes.map(q => {
           const quizAttempts = attempts.filter(a => a.quizId === q.id);
           const questions = quizQuestions[q.id] || [];
           
           const attemptCount = quizAttempts.length;
           if (attemptCount === 0) return { title: q.title, attempts: 0, averageScore: 0, passRate: 0, mostMissedText: 'N/A' };
           
           let totalScorePercent = 0;
           let passCount = 0;
           
           const missedCount: Record<string, number> = {};
           questions.forEach(que => missedCount[que.id] = 0);
           
           quizAttempts.forEach(a => {
              const maxScore = a.maxScore || 1; 
              // Some old records may contain 0 maxScore. Handle gently.
              const score = a.score || 0;
              const pct = (score / maxScore) * 100;
              totalScorePercent += pct;
              if (pct >= 50) passCount++;
              
              // For missed questions:
              const userAnswers = a.answers || {};
              questions.forEach(que => {
                 const ans = userAnswers[que.id];
                 let isCorrect = false;
                 if (ans) {
                    if (que.type === 'short') {
                       isCorrect = que.correctAnswer.toLowerCase().trim() === String(ans).toLowerCase().trim();
                    } else {
                       isCorrect = que.correctAnswer === ans;
                    }
                 }
                 if (!isCorrect) {
                    missedCount[que.id]++;
                 }
              });
           });
           
           const avgScore = totalScorePercent / attemptCount;
           const passRate = (passCount / attemptCount) * 100;
           
           // Find most missed question
           let mostMissedId: string | null = null;
           let maxMisses = -1;
           for (const [qId, count] of Object.entries(missedCount)) {
              if (count > maxMisses) {
                 maxMisses = count;
                 mostMissedId = qId;
              }
           }
           
           const mostMissedQ = questions.find(que => que.id === mostMissedId);
           const mostMissedDisplay = (mostMissedQ && maxMisses > 0) ? `${mostMissedQ.text} (${maxMisses} misses)` : 'None';
           
           return {
              title: q.title,
              attempts: attemptCount,
              averageScore: Math.round(avgScore),
              passRate: Math.round(passRate),
              mostMissedText: mostMissedDisplay,
              mostMissedRaw: mostMissedQ ? mostMissedQ.text : 'None',
              maxMisses
           }
        });
        
        setAnalyticsData(data);
      } catch(err) {
        console.error("Failed to load analytics", err);
      } finally {
        setLoadingAnalytics(false);
      }
    }
    fetchAnalytics();
  }, []);

  const statItems = [
    { title: "Total Teams", value: stats.teams, icon: Users },
    { title: "Total Players", value: stats.players, icon: Zap },
    { title: "Total Quizzes", value: stats.quizzes, icon: FileQuestion },
    { title: "Quiz Attempts", value: stats.attempts, icon: CheckCircle },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-sans tracking-tight">Dashboard</h1>
        <p className="text-zinc-400 mt-2">Overview of all system activity.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statItems.map((stat) => (
          <Card key={stat.title} className="bg-[#1C1E23] border-white/5 text-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">{stat.title}</CardTitle>
              <stat.icon className="w-5 h-5 text-zinc-500" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold font-mono tracking-tighter">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Quiz Performance Analytics */}
      <Card className="bg-[#1C1E23] border-white/5 text-white">
        <CardHeader>
          <CardTitle>Quiz Performance Analytics (Published)</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingAnalytics ? (
            <div className="text-zinc-500 text-sm py-8 text-center animate-pulse">Loading analytics...</div>
          ) : analyticsData.length === 0 ? (
            <div className="text-zinc-500 text-sm">No published quizzes with data available.</div>
          ) : (
            <div className="space-y-8">
              {/* Chart */}
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis 
                      dataKey="title" 
                      stroke="#888" 
                      tick={{ fill: '#888' }} 
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="#888" 
                      tick={{ fill: '#888' }}
                      tickLine={false}
                      axisLine={false}
                      domain={[0, 100]}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#111215', borderColor: '#333', color: '#fff' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar dataKey="averageScore" name="Avg Score (%)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="passRate" name="Pass Rate (%)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Most Missed Questions Table */}
              <div className="mt-8 relative overflow-x-auto border border-white/10 rounded-lg">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-black/40 text-zinc-400 border-b border-white/10">
                    <tr>
                      <th className="px-6 py-4 font-medium">Quiz</th>
                      <th className="px-6 py-4 font-medium">Total Attempts</th>
                      <th className="px-6 py-4 font-medium">Most Frequently Missed Question</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 bg-[#1C1E23]">
                    {analyticsData.map((d, i) => (
                      <tr key={i} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 font-medium text-white">{d.title}</td>
                        <td className="px-6 py-4 "><span className="text-zinc-500">{d.attempts}</span></td>
                        <td className="px-6 py-4 text-zinc-300">
                          {d.mostMissedText}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Placeholder for recent activity feed */}
      <Card className="bg-[#1C1E23] border-white/5 text-white">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-zinc-500 text-sm">No recent activity to show.</div>
        </CardContent>
      </Card>
    </div>
  );
}
