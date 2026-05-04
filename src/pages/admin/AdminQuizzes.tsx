import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { collection, query, orderBy, onSnapshot, addDoc } from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Clock, Users, PlayCircle, Edit, Trash2 } from "lucide-react";
import { OperationType, handleFirestoreError } from "@/lib/handleError";
import { deleteDoc, doc } from "firebase/firestore";
import { toast } from "sonner";

export function AdminQuizzes() {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const navigate = useNavigate();

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "quizzes"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setQuizzes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, error => handleFirestoreError(error, OperationType.GET, "quizzes"));
    return unsub;
  }, []);

  const handleDeleteQuiz = async (quizId: string) => {
    // Immediate UI feedback
    setQuizzes(prev => prev.filter(q => q.id !== quizId));

    try {
      await deleteDoc(doc(db, "quizzes", quizId));
      toast.success("Quiz deleted successfully");
    } catch (error: any) {
      toast.error("Failed to delete quiz. Check your permissions.");
      handleFirestoreError(error, OperationType.DELETE, `quizzes/${quizId}`);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quizzes</h1>
          <p className="text-zinc-400 mt-2">Manage your quizzes across all teams.</p>
        </div>
        
        <Link to="/admin/quizzes/new">
          <Button className="bg-[#F27D26] hover:bg-[#d96a1b] text-white">
            <Plus className="w-4 h-4 mr-2" />
            Create Quiz
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {quizzes.map(quiz => (
          <Card key={quiz.id} className="bg-[#1C1E23] border-white/5 text-white">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{quiz.title}</CardTitle>
                  <CardDescription className="text-zinc-400">
                    Status: <span className="capitalize">{quiz.status}</span>
                  </CardDescription>
                </div>
                  <div className="flex gap-1">
                    <Link to={`/admin/quizzes/${quiz.id}/edit`}>
                      <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white hover:bg-white/10">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={`transition-all ${confirmDeleteId === quiz.id ? 'text-red-500 bg-red-500/20' : 'text-zinc-500 hover:text-red-500 hover:bg-red-500/10'}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (confirmDeleteId === quiz.id) {
                          handleDeleteQuiz(quiz.id);
                          setConfirmDeleteId(null);
                        } else {
                          setConfirmDeleteId(quiz.id);
                          setTimeout(() => setConfirmDeleteId(null), 3000);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                      {confirmDeleteId === quiz.id && <span className="absolute -top-8 right-0 bg-red-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap shadow-lg">Click to confirm delete</span>}
                    </Button>
                  </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-zinc-400 flex items-center gap-4">
                 <div className="flex items-center gap-1">
                   <Clock className="w-4 h-4" />
                   <span>{quiz.timeLimitSeconds ? `${Math.round(quiz.timeLimitSeconds / 60)}m` : 'No limit'}</span>
                 </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {quizzes.length === 0 && (
          <div className="col-span-full py-12 text-center text-zinc-500">
            No quizzes created yet.
          </div>
        )}
      </div>
    </div>
  );
}
