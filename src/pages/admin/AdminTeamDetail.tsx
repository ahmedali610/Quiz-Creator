import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, onSnapshot, collection, query, orderBy, setDoc, getDocs, getDoc, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { Download, Copy, Users, FileQuestion, ArrowLeft, Trash2, Plus, Clock, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { OperationType, handleFirestoreError } from "@/lib/handleError";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteDoc } from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export function AdminTeamDetail() {
  const { id } = useParams();
  const [team, setTeam] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [assignedQuizzes, setAssignedQuizzes] = useState<any[]>([]);
  const [availableQuizzes, setAvailableQuizzes] = useState<any[]>([]);
  const [usersCache, setUsersCache] = useState<Record<string, any>>({});
  
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedQuizId, setSelectedQuizId] = useState("");
  const [assignmentDuration, setAssignmentDuration] = useState("60");
  const [assigning, setAssigning] = useState(false);

  const [confirmRemoveMemberId, setConfirmRemoveMemberId] = useState<string | null>(null);
  const [confirmRemoveQuizId, setConfirmRemoveQuizId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const unsubTeam = onSnapshot(doc(db, "teams", id), (docObj) => {
      if (docObj.exists()) setTeam({ id: docObj.id, ...docObj.data() });
    }, (error) => handleFirestoreError(error, OperationType.GET, `teams/${id}`));

    const unsubMembers = onSnapshot(query(collection(db, `teams/${id}/members`), orderBy("totalScore", "desc")), async (snap) => {
      const membersData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMembers(membersData);

      // Fetch user details for the cache
      const newCache = { ...usersCache };
      let changed = false;
      for (const member of membersData as any[]) {
        if (!newCache[member.userId]) {
          const uDoc = await getDoc(doc(db, "users", member.userId));
          if (uDoc.exists()) {
            newCache[member.userId] = uDoc.data();
            changed = true;
          }
        }
      }
      if (changed) setUsersCache(newCache);
    }, error => handleFirestoreError(error, OperationType.GET, `teams/${id}/members`));

    const unsubQuizzes = onSnapshot(query(collection(db, `teams/${id}/assigned_quizzes`), orderBy("expiresAt", "desc")), (snap) => {
      setAssignedQuizzes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, error => handleFirestoreError(error, OperationType.GET, `teams/${id}/assigned_quizzes`));

    // Fetch global available quizzes
    const fetchAvailable = async () => {
      try {
        const q = query(collection(db, "quizzes"), where("status", "==", "published"));
        const snap = await getDocs(q);
        setAvailableQuizzes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (e) { handleFirestoreError(e, OperationType.GET, "quizzes"); }
    };
    fetchAvailable();

    return () => { unsubTeam(); unsubMembers(); unsubQuizzes(); };
  }, [id]);

  const handleRemoveMember = async (memberDocId: string) => {
    // Immediate UI feedback
    setMembers(prev => prev.filter(m => m.id !== memberDocId));

    try {
      await deleteDoc(doc(db, `teams/${id}/members`, memberDocId));
      toast.success("Player removed from team");
    } catch (error: any) {
      toast.error("Failed to remove player. Check your permissions.");
      handleFirestoreError(error, OperationType.DELETE, `teams/${id}/members/${memberDocId}`);
    }
  };

  const handleAssignQuiz = async () => {
    if (!selectedQuizId) { toast.error("Please select a quiz"); return; }
    const quiz = availableQuizzes.find(q => q.id === selectedQuizId);
    if (!quiz) return;

    setAssigning(true);
    try {
      const assignedAt = Date.now();
      const expiresAt = assignedAt + (parseInt(assignmentDuration) * 60 * 1000);
      
      await setDoc(doc(db, `teams/${id}/assigned_quizzes`, selectedQuizId), {
        quizId: selectedQuizId,
        quizTitle: quiz.title,
        assignedAt,
        expiresAt,
        durationMinutes: parseInt(assignmentDuration)
      });
      
      toast.success(`'${quiz.title}' assigned for ${assignmentDuration} minutes!`);
      setIsAssignDialogOpen(false);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, `teams/${id}/assigned_quizzes/${selectedQuizId}`);
      toast.error("Failed to assign quiz");
    } finally {
      setAssigning(false);
    }
  };

  const handleRemoveQuiz = async (assignedId: string) => {
    // Immediate UI feedback
    setAssignedQuizzes(prev => prev.filter(aq => aq.id !== assignedId));

    try {
      await deleteDoc(doc(db, `teams/${id}/assigned_quizzes`, assignedId));
      toast.success("Quiz unassigned");
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, `teams/${id}/assigned_quizzes/${assignedId}`);
    }
  };

  if (!team) return <div className="p-8 text-white">Loading...</div>;

  const inviteUrl = `${(import.meta as any).env.VITE_APP_URL || window.location.origin}/join/${team.inviteToken}`;

  const copyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    toast.success("Invite link copied to clipboard");
  };

  const downloadQR = () => {
    const svg = document.getElementById("qr-code");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      }
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `QR_${team.name}.png`;
      downloadLink.href = `${pngFile}`;
      downloadLink.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <Link to="/admin/teams" className="text-[#F27D26] hover:underline flex items-center gap-2 mb-4 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Back to Teams
        </Link>
        <h1 className="text-4xl font-bold tracking-tight text-white mb-2">{team.name}</h1>
        <p className="text-zinc-400">Team Management Dashboard</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-[#1C1E23] border-white/5 text-white">
            <CardHeader>
              <CardTitle>Invite Link & QR</CardTitle>
              <CardDescription className="text-zinc-400">Share this with players to let them join.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 flex flex-col items-center">
              <div className="bg-white p-4 rounded-xl">
                <QRCodeSVG id="qr-code" value={inviteUrl} size={150} />
              </div>
              
              <div className="flex w-full gap-2 text-xs">
                <Button onClick={copyLink} className="flex-1 bg-white/10 hover:bg-white/20 text-white h-9">
                  <Copy className="w-3 h-3 mr-2" /> Copy Link
                </Button>
                <Button onClick={downloadQR} className="bg-[#F27D26] hover:bg-[#d96a1b] text-white h-9">
                  <Download className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#1C1E23] border-white/5 text-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Active Quizzes</CardTitle>
                <CardDescription className="text-zinc-400">Assigned tests for this team.</CardDescription>
              </div>
              <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
                <DialogTrigger 
                  render={
                    <Button variant="ghost" size="icon" className="text-[#F27D26] hover:bg-[#F27D26]/10">
                      <Plus className="w-5 h-5" />
                    </Button>
                  }
                />
                <DialogContent className="bg-[#1C1E23] text-white border-white/10">
                  <DialogHeader>
                    <DialogTitle>Assign Global Quiz</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Select Published Quiz</Label>
                      <Select value={selectedQuizId} onValueChange={setSelectedQuizId}>
                        <SelectTrigger className="bg-black/50 border-white/10">
                          <SelectValue placeholder="Choose a quiz template" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1C1E23] border-white/10 text-white">
                          {availableQuizzes.map(q => (
                            <SelectItem key={q.id} value={q.id}>{q.title}</SelectItem>
                          ))}
                          {availableQuizzes.length === 0 && <div className="p-2 text-zinc-500 text-sm">No published quizzes found.</div>}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Duration (Minutes)</Label>
                      <Input type="number" value={assignmentDuration} onChange={e => setAssignmentDuration(e.target.value)} className="bg-black/50 border-white/10" />
                      <p className="text-[10px] text-zinc-500">The quiz will expire this many minutes after assignment.</p>
                    </div>
                    <Button onClick={handleAssignQuiz} disabled={assigning} className="w-full bg-[#F27D26] hover:bg-[#d96a1b] text-white">
                      {assigning ? "Assigning..." : "Activate for Team"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {assignedQuizzes.length === 0 ? (
                  <div className="text-center py-6 text-zinc-500 text-sm">No assignments yet.</div>
                ) : (
                  assignedQuizzes.map(aq => {
                    const isExpired = Date.now() > aq.expiresAt;
                    return (
                      <div key={aq.id} className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-black/20">
                        <div className="min-w-0">
                          <div className="font-bold text-sm truncate">{aq.quizTitle}</div>
                          <div className="text-[10px] flex items-center gap-2 mt-1">
                            <span className={isExpired ? "text-red-500 font-bold" : "text-green-500 font-bold"}>
                              {isExpired ? "EXPIRED" : "ACTIVE"}
                            </span>
                            <span className="text-zinc-500">Expires {new Date(aq.expiresAt).toLocaleTimeString()}</span>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" 
                          className={`shrink-0 h-8 w-8 transition-all ${confirmRemoveQuizId === aq.id ? 'text-red-500 bg-red-500/20' : 'text-zinc-600 hover:text-red-500'}`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (confirmRemoveQuizId === aq.id) {
                              handleRemoveQuiz(aq.id);
                              setConfirmRemoveQuizId(null);
                            } else {
                              setConfirmRemoveQuizId(aq.id);
                              setTimeout(() => setConfirmRemoveQuizId(null), 3000);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                          {confirmRemoveQuizId === aq.id && <span className="absolute -top-6 right-0 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap shadow-[0_0_10px_rgba(239,68,68,0.5)] z-10">Confirm remove</span>}
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-[#1C1E23] border-white/5 text-white lg:col-span-2">
          <Tabs defaultValue="list" className="w-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>Team Management</CardTitle>
                <CardDescription className="text-zinc-400">Members and Performance</CardDescription>
              </div>
              <TabsList className="bg-black/40 border border-white/5">
                <TabsTrigger value="list" className="data-[state=active]:bg-[#F27D26] data-[state=active]:text-white">List</TabsTrigger>
                <TabsTrigger value="leaders" className="data-[state=active]:bg-[#F27D26] data-[state=active]:text-white">Visual Leaders</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent>
              <TabsContent value="list" className="mt-0">
                {members.length === 0 ? (
                  <div className="text-center py-12 text-zinc-500">No members have joined yet.</div>
                ) : (
                  <div className="border border-white/10 rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-white/10 hover:bg-transparent">
                          <TableHead className="text-zinc-400">Player</TableHead>
                          <TableHead className="text-zinc-400">Identity</TableHead>
                          <TableHead className="text-zinc-400">Total Score</TableHead>
                          <TableHead className="text-zinc-400">Quizzes Done</TableHead>
                          <TableHead className="text-zinc-400 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {members.map((member) => {
                          const user = usersCache[member.userId];
                          return (
                            <TableRow key={member.id} className="border-white/10 hover:bg-white/5">
                              <TableCell>
                                <div className="font-bold text-white">{user?.username || "New Player"}</div>
                                <div className="text-xs text-zinc-500">{user?.email || "No email"}</div>
                              </TableCell>
                              <TableCell className="font-mono text-[10px] text-zinc-500">{member.userId.substring(0, 8)}...</TableCell>
                              <TableCell className="font-bold text-[#F27D26]">{member.totalScore || 0}</TableCell>
                              <TableCell>{member.quizzesCompleted || 0}</TableCell>
                              <TableCell className="text-right">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className={`relative h-8 w-8 transition-all ${confirmRemoveMemberId === member.id ? 'text-red-500 bg-red-500/20' : 'text-zinc-500 hover:text-red-500 hover:bg-red-500/10'}`}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (confirmRemoveMemberId === member.id) {
                                      handleRemoveMember(member.id);
                                      setConfirmRemoveMemberId(null);
                                    } else {
                                      setConfirmRemoveMemberId(member.id);
                                      setTimeout(() => setConfirmRemoveMemberId(null), 3000);
                                    }
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                  {confirmRemoveMemberId === member.id && <span className="absolute -top-6 right-0 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap shadow-[0_0_10px_rgba(239,68,68,0.5)] z-10">Confirm kick</span>}
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="leaders" className="mt-0">
                {members.length === 0 ? (
                  <div className="text-center py-12 text-zinc-500">Join players to see leadership stats.</div>
                ) : (
                  <div className="space-y-6">
                    <div className="h-[300px] w-full mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={members.slice(0, 10).map(m => ({
                            name: usersCache[m.userId]?.username || "Player",
                            score: m.totalScore || 0
                          }))}
                          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                          <XAxis 
                            dataKey="name" 
                            stroke="#888888" 
                            fontSize={12} 
                            tickLine={false} 
                            axisLine={false}
                            angle={-45}
                            textAnchor="end"
                            interval={0}
                          />
                          <YAxis 
                            stroke="#888888" 
                            fontSize={12} 
                            tickLine={false} 
                            axisLine={false} 
                            tickFormatter={(value) => `${value}`}
                          />
                          <Tooltip 
                            contentStyle={{ backgroundColor: "#1C1E23", borderColor: "#ffffff10", color: "#fff" }}
                            itemStyle={{ color: "#F27D26" }}
                          />
                          <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                            {members.slice(0, 10).map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={index === 0 ? "#F27D26" : index === 1 ? "#d96a1b" : index === 2 ? "#bf5d17" : "#333"} 
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {members.slice(0, 3).map((m, i) => (
                        <div key={m.id} className="bg-black/20 p-4 rounded-xl border border-white/5 flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xl ${
                            i === 0 ? "bg-[#F27D26] text-white" : 
                            i === 1 ? "bg-zinc-400 text-black" : 
                            "bg-orange-900/50 text-[#F27D26]"
                          }`}>
                            {i + 1}
                          </div>
                          <div>
                            <div className="font-bold text-sm truncate max-w-[120px]">{usersCache[m.userId]?.username || "Player"}</div>
                            <div className="text-[#F27D26] text-xs font-bold">{m.totalScore || 0} pts</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
