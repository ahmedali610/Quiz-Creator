import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, getDocs, setDoc, updateDoc, query, where } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OperationType, handleFirestoreError } from "@/lib/handleError";
import confetti from "canvas-confetti";
import { Progress } from "@/components/ui/progress";
import { Clock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { ThemeToggle } from "@/components/ThemeToggle";

export function QuizPlayer() {
  const { teamId, id } = useParams();
  const navigate = useNavigate();
  
  const [quiz, setQuiz] = useState<any>(null);
  const [assignment, setAssignment] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  
  const [started, setStarted] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [maxScore, setMaxScore] = useState(0);
  
  const timerRef = useRef<any>(null);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    async function fetchQuiz() {
      if (!id || !teamId) return;
      try {
        let isPastAttempt = false;
        let pastAttemptData: any = null;
        
        // Check if player already completed this quiz in this team
        const qSnap = await getDocs(query(
          collection(db, "quiz_attempts"),
          where("userId", "==", auth.currentUser?.uid),
          where("teamId", "==", teamId),
          where("quizId", "==", id)
        ));

        if (!qSnap.empty) {
          isPastAttempt = true;
          pastAttemptData = qSnap.docs[0].data();
          toast.info("You have already completed this quiz. Now reviewing your results.");
        }

        // Check assignment first
        const assignDoc = await getDoc(doc(db, `teams/${teamId}/assigned_quizzes`, id));
        if (!assignDoc.exists() && !isPastAttempt) {
          toast.error("This quiz is not assigned to your team.");
          navigate(`/teams/${teamId}`);
          return;
        }

        if (assignDoc.exists()) {
          const aData = assignDoc.data();
          if (!isPastAttempt && Date.now() > aData.expiresAt) {
            toast.error("This quiz session has expired.");
            navigate(`/teams/${teamId}`);
            return;
          }
          setAssignment(aData);
          setTimeLeft(Math.max(0, Math.floor((aData.expiresAt - Date.now()) / 1000)));
        }

        const qDoc = await getDoc(doc(db, "quizzes", id));
        if (qDoc.exists()) {
          setQuiz({ id: qDoc.id, ...qDoc.data() });
        }
        
        const snaps = await getDocs(collection(db, `quizzes/${id}/questions`));
        let qs = snaps.docs.map(d => ({id: d.id, ...d.data()}));
        // some questions might not have order field if not properly saved, but we sort anyway
        qs.sort((a:any,b:any) => a.order - b.order);
        setQuestions(qs);
        setMaxScore(qs.reduce((acc, q: any) => acc + (q.points || 1), 0));
        
        if (isPastAttempt) {
           setAnswers(pastAttemptData.answers || {});
           setScore(pastAttemptData.score || 0);
           setFinished(true);
           setStarted(true); // So we go straight to the end screen/questions
        }
        
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, "quiz/questions");
      }
    }
    fetchQuiz();
  }, [id, teamId, navigate]);

  useEffect(() => {
    if (!finished && assignment) {
      timerRef.current = setInterval(() => {
        const rem = Math.floor((assignment.expiresAt - Date.now()) / 1000);
        if (rem <= 0) {
          setTimeLeft(0);
        } else {
          setTimeLeft(rem);
        }
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [finished, assignment]);

  // Handle timeout safely using current state
  useEffect(() => {
    if (assignment && timeLeft === 0 && !finished) {
      if (started) {
         toast.error("Time is up! Submitting quiz...");
         finishQuiz();
      } else {
         toast.error("This quiz session has expired.");
         navigate(`/teams/${teamId}`);
      }
    }
    // Note: To avoid stale closure on finishQuiz, we rely on the component re-evaluation 
    // or just let it trigger once when timeLeft hits 0. We'll use the latest answers.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, assignment, finished, started]);

  const handleStart = () => setStarted(true);

  const handleAnswer = (val: string) => {
    const qId = questions[currentIdx].id;
    setAnswers(prev => ({ ...prev, [qId]: val }));
  };

  const nextQuestion = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      finishQuiz();
    }
  };

  const prevQuestion = () => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
    }
  };

  const finishQuiz = async () => {
    setFinished(true);
    let finalScore = 0;
    
    // Grade it
    questions.forEach(q => {
       const ans = answers[q.id];
       if (!ans) return;
       // Case-insensitive exact match for short answer
       if (q.type === 'short') {
          if (q.correctAnswer.toLowerCase().trim() === String(ans).toLowerCase().trim()) {
            finalScore += q.points;
          }
       } else {
          if (q.correctAnswer === ans) {
            finalScore += q.points;
          }
       }
    });
    
    setScore(finalScore);

    // Confetti if >= 80%
    if (finalScore / maxScore >= 0.8) {
      confetti({ particleCount: 150, zIndex: 1000, spread: 80, origin: { y: 0.6 } });
    }

    try {
       // Save Attempt
       const attemptId = crypto.randomUUID();
       await setDoc(doc(db, "quiz_attempts", attemptId), {
         quizId: quiz.id,
         teamId: teamId,
         userId: auth.currentUser?.uid,
         score: finalScore,
         maxScore,
         answers,
         completedAt: Date.now()
       });

       // Update Team Member doc safely. 
       // We'll calculate the new fields via a read-modify-write.
       const memberRef = doc(db, `teams/${teamId}/members`, auth.currentUser!.uid);
       const memDoc = await getDoc(memberRef);
       if (memDoc.exists()) {
          const mData = memDoc.data();
          const qScores = mData.quizScores || {};
          qScores[quiz.id] = finalScore; // Latest attempt overrides
          
          let updatedTotal = 0;
          for(const k in qScores) updatedTotal += qScores[k];
          
          await updateDoc(memberRef, {
             quizScores: qScores,
             totalScore: updatedTotal,
             quizzesCompleted: Object.keys(qScores).length
          });
       }
    } catch (e) {
       console.error("Failed to save attempt", e);
       toast.error("Failed to save your score. Leaderboard may not update.");
    }
  };

  if (!quiz || questions.length === 0) return <div className="p-8 text-slate-900 dark:text-white">Loading quiz...</div>;

  if (finished) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="min-h-screen bg-slate-50 dark:bg-[#0A0A0B] p-6 text-slate-900 dark:text-white flex flex-col items-center py-24 relative overflow-hidden"
      >
        <div className="absolute top-4 right-6 z-50">
          <ThemeToggle />
        </div>

        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-orange-600/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-3xl w-full space-y-12 relative z-10">
           <motion.div 
             initial={{ scale: 0.8, opacity: 0 }}
             animate={{ scale: 1, opacity: 1 }}
             transition={{ delay: 0.2, type: "spring", bounce: 0.5 }}
             className="text-center space-y-4"
           >
              <h1 className="text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-900 dark:from-white via-slate-800 dark:via-white to-white/50 tracking-tight">Quiz Completed!</h1>
              <div className="text-orange-500 text-7xl font-black drop-shadow-[0_0_25px_rgba(249,115,22,0.4)] tracking-tighter">{score} <span className="text-3xl text-slate-500 dark:text-zinc-500">/ {maxScore}</span></div>
           </motion.div>
           
           <div className="space-y-6 mt-12 w-full">
             <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-500 flex items-center gap-4">
                <span>Detailed Review</span>
                <div className="flex-1 h-px bg-white/10" />
             </h3>
             {questions.map((q, i) => {
                const ans = answers[q.id];
                const isCorrect = (q.type === 'short') 
                  ? String(q.correctAnswer).toLowerCase().trim() === String(ans || '').toLowerCase().trim()
                  : String(q.correctAnswer) === String(ans || '');
                
                return (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    key={q.id}
                  >
                    <Card className={`bg-white dark:bg-white/[0.02] backdrop-blur-md shadow-xl border overflow-hidden ${isCorrect ? 'border-green-500/20 shadow-green-900/10' : 'border-red-500/20 shadow-red-900/10'}`}>
                      <CardContent className="p-0 flex">
                        <div className={`w-2 shrink-0 ${isCorrect ? 'bg-green-500/80' : 'bg-red-500/80'}`} />
                        <div className="p-6 flex gap-4 w-full">
                          <div className="mt-1 shrink-0">{isCorrect ? <CheckCircle2 className="w-6 h-6 text-green-500" /> : <XCircle className="w-6 h-6 text-red-500" />}</div>
                          <div className="flex-1 overflow-hidden">
                            <div className="font-semibold text-slate-900 dark:text-slate-800 dark:text-white/90 text-lg leading-snug whitespace-pre-wrap">{q.text}</div>
                        
                        {q.type === 'mcq' && q.options && (
                          <div className="space-y-2 mt-4">
                            {q.options.map((opt: string, optIdx: number) => {
                               const isUserAns = String(optIdx) === String(ans || '');
                               const isActualCorrect = String(optIdx) === String(q.correctAnswer);
                               let optionClasses = "px-4 py-3 rounded-lg border text-sm flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 transition-colors ";
                               
                               if (isActualCorrect) {
                                  optionClasses += "bg-green-500/20 border-green-500/50 text-green-700 dark:text-green-200";
                               } else if (isUserAns && !isActualCorrect) {
                                  optionClasses += "bg-red-500/20 border-red-500/50 text-red-700 dark:text-red-200";
                               } else {
                                  optionClasses += "bg-white dark:bg-[#111215] border-slate-200 dark:border-white/5 text-slate-500 dark:text-zinc-400";
                               }
                               
                               return (
                                  <div key={optIdx} className={optionClasses}>
                                    <span className="font-medium">{opt}</span>
                                    <div className="flex items-center gap-3">
                                       {isUserAns && <span className="text-[10px] shrink-0 font-bold uppercase tracking-wider bg-black/10 dark:bg-white/10 px-2 py-1 rounded">Your Answer</span>}
                                       {isActualCorrect && <span className="text-[10px] shrink-0 font-bold uppercase tracking-wider text-green-700 dark:text-green-400 bg-green-500/20 dark:bg-green-500/10 px-2 py-1 rounded">Correct Answer</span>}
                                    </div>
                                  </div>
                               );
                            })}
                          </div>
                        )}

                        {q.type === 'tf' && (
                          <div className="space-y-2 mt-4">
                            {['True', 'False'].map((optText: string) => {
                               const optVal = optText.toLowerCase();
                               const isUserAns = optVal === String(ans || '');
                               const isActualCorrect = optVal === String(q.correctAnswer);
                               let optionClasses = "px-4 py-3 rounded-lg border text-sm flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 transition-colors ";
                               
                               if (isActualCorrect) {
                                  optionClasses += "bg-green-500/20 border-green-500/50 text-green-700 dark:text-green-200";
                               } else if (isUserAns && !isActualCorrect) {
                                  optionClasses += "bg-red-500/20 border-red-500/50 text-red-700 dark:text-red-200";
                               } else {
                                  optionClasses += "bg-white dark:bg-[#111215] border-slate-200 dark:border-white/5 text-slate-500 dark:text-zinc-400";
                               }
                               
                               return (
                                  <div key={optVal} className={optionClasses}>
                                    <span className="font-medium">{optText}</span>
                                    <div className="flex items-center gap-3">
                                       {isUserAns && <span className="text-[10px] shrink-0 font-bold uppercase tracking-wider bg-black/10 dark:bg-white/10 px-2 py-1 rounded">Your Answer</span>}
                                       {isActualCorrect && <span className="text-[10px] shrink-0 font-bold uppercase tracking-wider text-green-700 dark:text-green-400 bg-green-500/20 dark:bg-green-500/10 px-2 py-1 rounded">Correct Answer</span>}
                                    </div>
                                  </div>
                               );
                            })}
                          </div>
                        )}

                        {q.type === 'short' && (
                          <div className="mt-4 space-y-3">
                            <div className={`p-4 rounded-lg border text-sm flex flex-col gap-1 ${isCorrect ? 'bg-green-500/20 border-green-500/50 text-green-700 dark:text-green-200' : 'bg-red-500/20 border-red-500/50 text-red-700 dark:text-red-200'}`}>
                              <span className="font-bold uppercase tracking-wider text-[10px] opacity-70">Your Answer</span>
                              <span className="font-medium text-base">{ans || 'Skipped'}</span>
                            </div>
                            {!isCorrect && (
                              <div className="p-4 rounded-lg border bg-green-500/20 border-green-500/50 text-green-700 dark:text-green-200 text-sm flex flex-col gap-1">
                                <span className="font-bold uppercase tracking-wider text-[10px] opacity-70">Correct Answer</span>
                                <span className="font-medium text-base">{q.correctAnswer}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {q.explanation && (
                           <div className="mt-4 text-sm text-slate-600 dark:text-zinc-300 bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-lg leading-relaxed">
                              <span className="block font-bold text-[10px] uppercase tracking-wider text-indigo-400 mb-1">Explanation</span>
                              <div className="whitespace-pre-wrap">{q.explanation}</div>
                           </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
         })}
           </div>

           <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
             <Button onClick={() => navigate(`/teams/${teamId}`)} className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-slate-900 dark:text-white py-8 text-xl font-bold shadow-[0_0_40px_rgba(249,115,22,0.3)] rounded-2xl border border-slate-200 dark:border-white/10">
               Return to Team Leaderboard
             </Button>
           </motion.div>
        </div>
      </motion.div>
    );
  }

  if (!started) {
    return (
      <AnimatePresence>
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="min-h-screen bg-slate-50 dark:bg-[#0A0A0B] p-6 text-slate-900 dark:text-white flex flex-col items-center justify-center relative overflow-hidden"
        >
          <div className="absolute top-4 right-6 z-50">
            <ThemeToggle />
          </div>

          {/* Subtle background glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-600/10 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />
          
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5, ease: "easeOut" }}
            className="max-w-md w-full text-center space-y-8 relative z-10"
          >
             <h1 className="text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-900 dark:from-white via-slate-800 dark:via-white to-white/70 leading-tight tracking-tight">{quiz.title}</h1>
             {quiz.description && <p className="text-slate-500 dark:text-zinc-400 text-lg leading-relaxed">{quiz.description}</p>}
             
             <div className="grid grid-cols-2 gap-4">
               <motion.div whileHover={{ y: -2 }} className="bg-white dark:bg-white/[0.02] backdrop-blur-md p-6 rounded-3xl border border-slate-200 dark:border-white/5 flex flex-col items-center justify-center gap-3 shadow-xl">
                  <Clock className="w-8 h-8 text-orange-500" />
                  <span className="text-sm font-medium text-slate-500 dark:text-zinc-400">Time Limit: <br/><span className="text-slate-900 dark:text-white text-lg">{formatTime(timeLeft)}</span></span>
               </motion.div>
               
               <motion.div whileHover={{ y: -2 }} className="bg-white dark:bg-white/[0.02] backdrop-blur-md p-6 rounded-3xl border border-slate-200 dark:border-white/5 flex flex-col items-center justify-center gap-3 shadow-xl">
                  <div className="text-3xl font-black text-orange-500 drop-shadow-[0_0_15px_rgba(249,115,22,0.4)]">{questions.length}</div>
                  <span className="text-sm font-medium text-slate-500 dark:text-zinc-400">Questions <br/><span className="text-slate-900 dark:text-white text-lg">{maxScore} pts</span></span>
               </motion.div>
             </div>

             <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="pt-6">
               <Button onClick={handleStart} className="w-full h-16 rounded-2xl text-xl font-bold bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-slate-900 dark:text-white shadow-[0_0_40px_rgba(249,115,22,0.3)] border border-slate-200 dark:border-white/10 transition-all">
                 Start Quiz
               </Button>
             </motion.div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  const q = questions[currentIdx];
  const progress = ((currentIdx + 1) / questions.length) * 100;

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-[#0A0A0B] text-slate-900 dark:text-white">
      {/* Quiz Header */}
      <div className="h-16 px-6 border-b border-slate-200 dark:border-white/5 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-[#0A0A0B]/80 backdrop-blur-xl z-20">
         <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2 flex-nowrap pr-4">
           {questions.map((quest, idx) => {
             const isAns = !!answers[quest.id];
             const isCur = idx === currentIdx;
             return (
               <button
                 key={quest.id}
                 onClick={() => setCurrentIdx(idx)}
                 className={`flex items-center justify-center shrink-0 w-8 h-8 rounded-full text-xs font-bold transition-all duration-300 ${isCur ? 'bg-slate-900 dark:bg-white text-white dark:text-black ring-4 ring-slate-900/10 dark:ring-white/20' : isAns ? 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30' : 'bg-slate-100 dark:bg-white/[0.03] text-slate-500 dark:text-zinc-500 border border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/20 hover:text-slate-600 dark:hover:text-zinc-300'}`}
                 title={`Question ${idx + 1}`}
               >
                 {idx + 1}
               </button>
             );
           })}
         </div>
         <div className="flex items-center gap-4 shrink-0">
           <div className={`flex items-center gap-2 font-mono text-xl py-1.5 px-4 rounded-full border ${timeLeft < 60 ? 'border-red-500/30 text-red-600 dark:text-red-400 bg-red-500/10 animate-pulse' : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 bg-white dark:bg-white/5'}`}>
             <Clock className="w-4 h-4" />
             {formatTime(timeLeft)}
           </div>
           <ThemeToggle />
         </div>
      </div>
      <Progress value={progress} className="h-1 rounded-none bg-white/5" />

      {/* Question Content */}
      <div className="flex-1 overflow-auto p-6 flex flex-col max-w-3xl mx-auto w-full pt-12 relative overflow-x-hidden">
        <div className="absolute top-[20%] right-[-20%] w-[400px] h-[400px] bg-orange-600/5 rounded-full blur-[100px] pointer-events-none" />
        
        <AnimatePresence mode="wait">
         <motion.div 
           key={currentIdx}
           initial={{ opacity: 0, x: 20 }}
           animate={{ opacity: 1, x: 0 }}
           exit={{ opacity: 0, x: -20 }}
           transition={{ duration: 0.3, ease: "easeInOut" }}
           className="w-full flex-1 flex flex-col relative z-10"
         >
           <div className="flex justify-between items-start mb-10">
              <h2 className="text-3xl md:text-4xl font-bold leading-tight text-slate-900 dark:text-slate-800 dark:text-white/90 whitespace-pre-wrap">{q.text}</h2>
              <div className="shrink-0 ml-4 bg-orange-500/10 text-orange-500 text-xs font-bold px-3 py-1.5 rounded-md border border-orange-500/20 uppercase tracking-widest">
                 {q.points} pt
              </div>
           </div>

           <div className="space-y-4 flex-1">
              {q.type === 'mcq' && q.options?.map((opt: string, i: number) => (
                <motion.button 
                  whileHover={{ scale: answers[q.id] === String(i) ? 1 : 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  key={i} 
                  onClick={() => handleAnswer(String(i))}
                  className={`w-full text-left p-6 rounded-2xl border transition-all duration-300 ${answers[q.id] === String(i) ? 'border-orange-500/50 bg-orange-500/10 shadow-[0_0_30px_rgba(249,115,22,0.15)] text-slate-900 dark:text-white' : 'border-slate-200 dark:border-white/5 bg-white dark:bg-white/[0.02] hover:bg-slate-200 dark:bg-white/[0.04] hover:border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:text-white'}`}
                >
                  <div className="text-lg font-medium">{opt}</div>
                </motion.button>
              ))}

              {q.type === 'tf' && (
                <div className="grid grid-cols-2 gap-4">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => handleAnswer('true')} className={`p-8 text-center rounded-2xl border text-2xl font-bold transition-all duration-300 ${answers[q.id] === 'true' ? 'border-orange-500/50 bg-orange-500/10 shadow-[0_0_30px_rgba(249,115,22,0.15)] text-slate-900 dark:text-white' : 'border-slate-200 dark:border-white/5 bg-white dark:bg-white/[0.02] hover:bg-slate-200 dark:bg-white/[0.04] hover:border-slate-200 dark:border-white/10 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:text-white'}`}>True</motion.button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => handleAnswer('false')} className={`p-8 text-center rounded-2xl border text-2xl font-bold transition-all duration-300 ${answers[q.id] === 'false' ? 'border-orange-500/50 bg-orange-500/10 shadow-[0_0_30px_rgba(249,115,22,0.15)] text-slate-900 dark:text-white' : 'border-slate-200 dark:border-white/5 bg-white dark:bg-white/[0.02] hover:bg-slate-200 dark:bg-white/[0.04] hover:border-slate-200 dark:border-white/10 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:text-white'}`}>False</motion.button>
                </div>
              )}

              {q.type === 'short' && (
                <motion.input 
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  type="text" 
                  placeholder="Type your answer..." 
                  className="w-full bg-white dark:bg-white/[0.02] rounded-2xl border border-slate-200 dark:border-white/5 p-6 text-2xl focus:outline-none focus:border-orange-500/50 focus:bg-orange-500/5 transition-all text-slate-900 dark:text-white placeholder:text-zinc-600 shadow-inner"
                  value={answers[q.id] || ''}
                  onChange={e => handleAnswer(e.target.value)}
                  autoFocus
                />
              )}
           </div>

           {/* Footer Action */}
           <div className="pt-12 pb-8 flex justify-between items-center mt-auto">
              <Button 
                 variant="outline"
                 size="lg"
                 onClick={prevQuestion}
                 disabled={currentIdx === 0}
                 className="text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-white/10 hover:bg-white/5 hover:text-slate-900 dark:text-white text-lg px-8 h-14 bg-transparent rounded-2xl transition-all disabled:opacity-20 disabled:hover:bg-transparent"
              >
                 Previous
              </Button>
              <Button 
                size="lg" 
                onClick={nextQuestion} 
                disabled={!answers[q.id]}
                className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-slate-900 dark:text-white text-lg px-12 h-14 rounded-2xl shadow-[0_0_30px_rgba(249,115,22,0.3)] transition-all disabled:opacity-50 disabled:shadow-none font-bold disabled:from-slate-900 dark:from-white/10 disabled:to-white/10 disabled:text-slate-500 dark:text-zinc-500"
              >
                {currentIdx === questions.length - 1 ? 'Submit Quiz' : 'Next Question'}
              </Button>
           </div>
         </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
