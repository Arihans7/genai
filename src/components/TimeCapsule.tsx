import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { TimeCapsule as TimeCapsuleType } from '../types';
import { motion } from 'motion/react';
import { Lock, Unlock, Send, Calendar, Clock } from 'lucide-react';

interface Props {
  coupleId: string;
  userId: string;
}

export const TimeCapsule: React.FC<Props> = ({ coupleId, userId }) => {
  const [capsules, setCapsules] = useState<TimeCapsuleType[]>([]);
  const [content, setContent] = useState('');
  const [openDate, setOpenDate] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'couples', coupleId, 'timecapsules'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimeCapsuleType));
      setCapsules(data);
    });

    return unsubscribe;
  }, [coupleId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !openDate) return;

    try {
      await addDoc(collection(db, 'couples', coupleId, 'timecapsules'), {
        coupleId,
        authorId: userId,
        content,
        openDate: Timestamp.fromDate(new Date(openDate)),
        createdAt: serverTimestamp()
      });
      setContent('');
      setOpenDate('');
      setIsAdding(false);
    } catch (err) {
      console.error("Failed to add time capsule", err);
    }
  };

  const isLocked = (date: any) => {
    const now = new Date();
    const unlockDate = date instanceof Timestamp ? date.toDate() : new Date(date);
    return now < unlockDate;
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-medium text-stone-900">Time Capsule</h2>
          <p className="text-sm text-stone-500 font-serif italic">Messages for your future selves.</p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="w-10 h-10 bg-stone-900 rounded-2xl flex items-center justify-center text-white hover:bg-stone-800 transition-all shadow-md"
        >
          <Send className={`w-5 h-5 transition-transform ${isAdding ? 'rotate-45' : ''}`} />
        </button>
      </div>

      {isAdding && (
        <motion.form
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit}
          className="bg-white p-8 rounded-[32px] shadow-xl border border-stone-200 space-y-6"
        >
          <div className="space-y-2">
            <label className="text-[10px] font-mono uppercase tracking-widest text-stone-400">Your Message</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What do you want to tell your future selves?"
              className="w-full h-32 bg-stone-50 border-none rounded-2xl p-4 text-stone-900 placeholder-stone-400 focus:ring-2 focus:ring-stone-900 transition-all resize-none font-serif"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-mono uppercase tracking-widest text-stone-400">Unlock Date</label>
            <input
              type="date"
              value={openDate}
              onChange={(e) => setOpenDate(e.target.value)}
              className="w-full bg-stone-50 border-none rounded-2xl p-4 text-stone-900 focus:ring-2 focus:ring-stone-900 transition-all font-serif"
            />
          </div>
          <button
            type="submit"
            className="w-full py-4 bg-stone-900 text-white rounded-2xl font-medium hover:bg-stone-800 transition-all shadow-lg"
          >
            Seal Capsule
          </button>
        </motion.form>
      )}

      <div className="grid grid-cols-1 gap-6">
        {capsules.map((capsule) => {
          const locked = isLocked(capsule.openDate);
          const unlockDate = capsule.openDate instanceof Timestamp ? capsule.openDate.toDate() : new Date(capsule.openDate);

          return (
            <div
              key={capsule.id}
              className={`p-8 rounded-[32px] border transition-all ${
                locked 
                  ? 'bg-stone-50 border-stone-200 opacity-80' 
                  : 'bg-white border-stone-200 shadow-md hover:shadow-lg'
              }`}
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${locked ? 'bg-stone-200 text-stone-500' : 'bg-emerald-100 text-emerald-600'}`}>
                    {locked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-stone-400">
                      {locked ? 'Locked until' : 'Unlocked on'}
                    </p>
                    <p className="text-sm font-serif font-medium text-stone-900">
                      {unlockDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 text-stone-400">
                  <Clock className="w-4 h-4" />
                  <span className="text-[10px] font-mono">
                    {new Date(capsule.createdAt as any).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {locked ? (
                <div className="py-8 flex flex-col items-center justify-center space-y-2 text-stone-400">
                  <p className="font-serif italic">This memory is still maturing...</p>
                </div>
              ) : (
                <p className="text-stone-800 font-serif leading-relaxed text-lg">
                  {capsule.content}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
