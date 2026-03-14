import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { Milestone } from '../types';
import { motion } from 'motion/react';
import { Calendar, Plus, Trash2, Heart, Star, ShieldCheck } from 'lucide-react';

interface Props {
  coupleId: string;
}

export const Milestones: React.FC<Props> = ({ coupleId }) => {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newMilestone, setNewMilestone] = useState({
    title: '',
    date: '',
    type: 'other' as Milestone['type']
  });

  useEffect(() => {
    const q = query(
      collection(db, 'couples', coupleId, 'milestones'),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Milestone));
      setMilestones(data);
    });

    return unsubscribe;
  }, [coupleId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMilestone.title || !newMilestone.date) return;

    try {
      await addDoc(collection(db, 'couples', coupleId, 'milestones'), {
        ...newMilestone,
        coupleId
      });
      setNewMilestone({ title: '', date: '', type: 'other' });
      setIsAdding(false);
    } catch (err) {
      console.error("Failed to add milestone", err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'couples', coupleId, 'milestones', id));
    } catch (err) {
      console.error("Failed to delete milestone", err);
    }
  };

  const getIcon = (type: Milestone['type']) => {
    switch (type) {
      case 'anniversary': return <Heart className="w-5 h-5 text-rose-500" />;
      case 'first_date': return <Star className="w-5 h-5 text-amber-500" />;
      case 'resolved_conflict': return <ShieldCheck className="w-5 h-5 text-emerald-500" />;
      default: return <Calendar className="w-5 h-5 text-stone-500" />;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-medium text-stone-900">Milestones</h2>
          <p className="text-sm text-stone-500 font-serif italic">The chapters of your story.</p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="w-10 h-10 bg-stone-900 rounded-2xl flex items-center justify-center text-white hover:bg-stone-800 transition-all shadow-md"
        >
          <Plus className={`w-5 h-5 transition-transform ${isAdding ? 'rotate-45' : ''}`} />
        </button>
      </div>

      {isAdding && (
        <motion.form
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleAdd}
          className="bg-white p-8 rounded-[32px] shadow-xl border border-stone-200 space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-stone-400">Title</label>
              <input
                type="text"
                value={newMilestone.title}
                onChange={(e) => setNewMilestone({ ...newMilestone, title: e.target.value })}
                placeholder="e.g., Our First Trip"
                className="w-full bg-stone-50 border-none rounded-2xl p-4 text-stone-900 focus:ring-2 focus:ring-stone-900 transition-all font-serif"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-stone-400">Date</label>
              <input
                type="date"
                value={newMilestone.date}
                onChange={(e) => setNewMilestone({ ...newMilestone, date: e.target.value })}
                className="w-full bg-stone-50 border-none rounded-2xl p-4 text-stone-900 focus:ring-2 focus:ring-stone-900 transition-all font-serif"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-mono uppercase tracking-widest text-stone-400">Type</label>
            <div className="flex flex-wrap gap-3">
              {['anniversary', 'first_date', 'resolved_conflict', 'other'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setNewMilestone({ ...newMilestone, type: type as Milestone['type'] })}
                  className={`px-6 py-3 rounded-2xl text-xs font-medium transition-all ${
                    newMilestone.type === type 
                      ? 'bg-stone-900 text-white shadow-md' 
                      : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                  }`}
                >
                  {type.replace('_', ' ').toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <button
            type="submit"
            className="w-full py-4 bg-stone-900 text-white rounded-2xl font-medium hover:bg-stone-800 transition-all shadow-lg"
          >
            Save Milestone
          </button>
        </motion.form>
      )}

      <div className="space-y-4">
        {milestones.map((milestone, idx) => (
          <motion.div
            key={milestone.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="group bg-white p-6 rounded-[32px] border border-stone-200 flex items-center justify-between hover:shadow-md transition-all"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-stone-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                {getIcon(milestone.type)}
              </div>
              <div>
                <h4 className="font-serif font-medium text-stone-900">{milestone.title}</h4>
                <p className="text-xs text-stone-400 font-mono uppercase tracking-widest">
                  {new Date(milestone.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleDelete(milestone.id)}
              className="p-3 text-stone-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
