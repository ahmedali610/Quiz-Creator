import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc, collection, query, getDocs, writeBatch } from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OperationType, handleFirestoreError } from "@/lib/handleError";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Plus, GripVertical, Trash2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

// Dnd Kit Imports
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Question {
  id: string;
  type: 'mcq' | 'tf' | 'short';
  text: string;
  options?: string[];
  correctAnswer: string;
  points: number;
  explanation?: string;
}

function SortableQuestionItem({id, text, type, points, active, onClick, onDelete}: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({id});
  const style = { transform: CSS.Transform.toString(transform), transition };
  
  return (
    <div ref={setNodeRef} style={style} className={`flex items-center gap-2 p-3 rounded-lg border ${active ? 'border-[#F27D26] bg-[#F27D26]/10' : 'border-white/10 bg-black'} cursor-pointer`} onClick={onClick}>
      <div {...attributes} {...listeners} className="cursor-grab text-zinc-500 hover:text-white px-1">
        <GripVertical className="w-4 h-4" />
      </div>
      <div className="flex-1 overflow-hidden whitespace-nowrap overflow-ellipsis text-sm text-white">
        {text || "Untitled Question"}
      </div>
      <div className="text-xs text-zinc-500 uppercase">{type}</div>
      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-red-500 hover:text-red-400 hover:bg-red-500/10">
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

export function AdminQuizBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  // If no ID, we are creating new. We'll generate an ID immediately so we can auto-save.
  const [quizId] = useState(id || crypto.randomUUID());
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [timeLimit, setTimeLimit] = useState("10");
  const [status, setStatus] = useState("draft");
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeQId, setActiveQId] = useState<string | null>(null);

  useEffect(() => {
    // Fetch existing quiz if editing
    if (id) {
      const fetchQuiz = async () => {
        try {
          const qDoc = await getDoc(doc(db, "quizzes", id));
          if (qDoc.exists()) {
            const data = qDoc.data();
            setTitle(data.title);
            setDescription(data.description || "");
            setTimeLimit(data.timeLimitSeconds ? String(data.timeLimitSeconds / 60) : "10");
            setStatus(data.status);
          }
          const questionsSnap = await getDocs(query(collection(db, `quizzes/${id}/questions`)));
          const qList = questionsSnap.docs.map(d => ({id: d.id, ...d.data()} as Question));
          qList.sort((a: any, b: any) => a.order - b.order);
          setQuestions(qList);
          if (qList.length > 0) setActiveQId(qList[0].id);
        } catch(e) { handleFirestoreError(e, OperationType.GET, `quizzes/${id}`); }
      };
      fetchQuiz();
    }
  }, [id]);

  const handleDragEnd = (event: any) => {
    const {active, over} = event;
    if (active.id !== over.id) {
      setQuestions((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const addQuestion = () => {
    const newQ: Question = {
      id: crypto.randomUUID(), type: 'mcq', text: '', options: ['', '', '', ''], correctAnswer: '0', points: 1
    };
    setQuestions([...questions, newQ]);
    setActiveQId(newQ.id);
  };

  const updateActiveQ = (updates: Partial<Question>) => {
    if (!activeQId) return;
    setQuestions(questions.map(q => q.id === activeQId ? { ...q, ...updates } : q));
  };
  
  const deleteQuestion = (delId: string) => {
    const newQs = questions.filter(q => q.id !== delId);
    setQuestions(newQs);
    if (activeQId === delId) setActiveQId(newQs.length > 0 ? newQs[0].id : null);
  };

  const handleSave = async (publish: boolean) => {
    if (!title) { toast.error("Title is required"); return; }
    
    const newStatus = publish ? "published" : "draft";
    setStatus(newStatus);
    
    try {
      const batch = writeBatch(db);
      
      const quizRef = doc(db, "quizzes", quizId);
      batch.set(quizRef, {
        title, description, 
        timeLimitSeconds: parseInt(timeLimit) * 60,
        status: newStatus,
        createdBy: auth.currentUser?.uid,
        createdAt: Date.now()
      }, { merge: true });

      // Save questions
      // First delete old ones if this was an update? 
      // For simplicity, we assume we just overwrite. Ideally we should clean up deleted ones.
      questions.forEach((q, index) => {
        const qRef = doc(db, `quizzes/${quizId}/questions`, q.id);
        batch.set(qRef, { ...q, order: index });
      });

      await batch.commit();
      toast.success(publish ? "Quiz Published!" : "Draft Saved!");
      if (!id) navigate(`/admin/quizzes/${quizId}/edit`, { replace: true });
    } catch(e) {
      handleFirestoreError(e, OperationType.WRITE, `quizzes/${quizId}`);
    }
  };

  const activeQ = questions.find(q => q.id === activeQId);

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white">
      {/* Top Bar */}
      <div className="h-16 border-b border-white/10 px-6 flex items-center justify-between bg-[#151619] shrink-0">
         <div className="flex items-center gap-4">
           <Link to="/admin/quizzes" className="text-zinc-400 hover:text-white">
             <ArrowLeft className="w-5 h-5" />
           </Link>
           <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Quiz Title" className="bg-transparent border-0 text-xl font-bold font-sans w-[250px] focus-visible:ring-0 px-0 h-auto" />
         </div>
         <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => handleSave(false)} className="border-white/10 text-zinc-300 hover:text-white hover:bg-white/5">Save Draft</Button>
            <Button onClick={() => handleSave(true)} className="bg-[#F27D26] hover:bg-[#d96a1b] text-white">Publish Quiz</Button>
         </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Question List */}
        <div className="w-72 border-r border-white/10 flex flex-col bg-[#111215]">
          <div className="p-4 border-b border-white/10 flex justify-between items-center">
            <span className="font-semibold text-sm">Questions ({questions.length})</span>
            <Button size="sm" variant="ghost" onClick={addQuestion} className="h-8 px-2 text-[#F27D26] hover:bg-[#F27D26]/10 hover:text-[#F27D26]">
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={questions.map(q => q.id)} strategy={verticalListSortingStrategy}>
                {questions.map(q => (
                  <SortableQuestionItem 
                    key={q.id} id={q.id} text={q.text} type={q.type} points={q.points}
                    active={q.id === activeQId} 
                    onClick={() => setActiveQId(q.id)}
                    onDelete={() => deleteQuestion(q.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </div>

        {/* Center Panel: Editor */}
        <div className="flex-1 overflow-y-auto p-8 bg-[#0a0a0a]">
           {activeQ ? (
             <div className="max-w-2xl mx-auto space-y-8">
                <div className="space-y-4">
                  <div className="flex gap-4">
                     <Select value={activeQ.type} onValueChange={(val: any) => updateActiveQ({ type: val })}>
                        <SelectTrigger className="w-[180px] bg-[#1C1E23] border-white/10 text-white"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-[#1C1E23] border-white/10 text-white">
                          <SelectItem value="mcq">Multiple Choice</SelectItem>
                          <SelectItem value="tf">True / False</SelectItem>
                          <SelectItem value="short">Short Answer</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-2">
                        <Label className="text-zinc-400">Points</Label>
                        <Input type="number" value={activeQ.points} onChange={e => updateActiveQ({points: parseInt(e.target.value) || 0})} className="w-20 bg-[#1C1E23] border-white/10" />
                      </div>
                  </div>
                  
                  <textarea 
                    placeholder="Enter your question here..." 
                    className="w-full h-32 bg-[#1C1E23] border border-white/10 rounded-lg p-4 text-xl resize-none focus:outline-none focus:ring-1 focus:ring-[#F27D26]"
                    value={activeQ.text} onChange={e => updateActiveQ({text: e.target.value})}
                  />
                </div>

                {activeQ.type === 'mcq' && (
                  <div className="space-y-3">
                    <Label className="text-zinc-400 uppercase text-xs font-bold tracking-wider">Options</Label>
                    {(activeQ.options || []).map((opt, i) => (
                      <div key={i} className="flex gap-3 items-center">
                        <input type="radio" name="mcq-correct" checked={activeQ.correctAnswer === String(i)} onChange={() => updateActiveQ({correctAnswer: String(i)})} className="w-5 h-5 accent-[#F27D26]" />
                        <Input value={opt} onChange={e => {
                          const newOpts = [...(activeQ.options||[])]; newOpts[i] = e.target.value; updateActiveQ({options: newOpts});
                        }} placeholder={`Option ${i+1}`} className="flex-1 bg-[#1C1E23] border-white/10" />
                      </div>
                    ))}
                  </div>
                )}

                {activeQ.type === 'tf' && (
                  <div className="space-y-3">
                    <div className="flex gap-3 items-center">
                       <input type="radio" name="tf-correct" checked={activeQ.correctAnswer === 'true'} onChange={() => updateActiveQ({correctAnswer: 'true'})} className="w-5 h-5 accent-[#F27D26]" />
                       <div className="flex-1 p-3 rounded bg-[#1C1E23] border border-white/10">True</div>
                    </div>
                    <div className="flex gap-3 items-center">
                       <input type="radio" name="tf-correct" checked={activeQ.correctAnswer === 'false'} onChange={() => updateActiveQ({correctAnswer: 'false'})} className="w-5 h-5 accent-[#F27D26]" />
                       <div className="flex-1 p-3 rounded bg-[#1C1E23] border border-white/10">False</div>
                    </div>
                  </div>
                )}

                {activeQ.type === 'short' && (
                  <div className="space-y-3">
                    <Label className="text-zinc-400 uppercase text-xs font-bold tracking-wider">Accepted Answer(s)</Label>
                    <Input value={activeQ.options?.[0] || ''} onChange={e => updateActiveQ({options: [e.target.value], correctAnswer: e.target.value})} placeholder="e.g. Paris" className="bg-[#1C1E23] border-white/10" />
                    <p className="text-xs text-zinc-500">Case-insensitive exact match.</p>
                  </div>
                )}
             </div>
           ) : (
             <div className="h-full flex items-center justify-center text-zinc-500">
               Select or add a question to begin editing.
             </div>
           )}
        </div>

        {/* Right Panel: Settings / Preview */}
        <div className="w-80 border-l border-white/10 bg-[#111215] p-6 space-y-6 overflow-y-auto">
          <div>
            <Label className="text-zinc-400 text-xs uppercase font-bold tracking-wider mb-2 block">Quiz Settings</Label>
            <div className="space-y-4">
              <div>
                <Label className="text-sm">Time Limit (minutes)</Label>
                <Input type="number" value={timeLimit} onChange={e => setTimeLimit(e.target.value)} className="bg-black/50 border-white/10 mt-1" />
              </div>
              <div>
                <Label className="text-sm">Description</Label>
                <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-md mt-1 p-2 text-sm" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
