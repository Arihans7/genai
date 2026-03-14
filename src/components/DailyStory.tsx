import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, limit, orderBy } from 'firebase/firestore';
import { DailyStory as DailyStoryType, JournalEntry } from '../types';
import { generateDailyStory } from '../services/geminiService';
import { Sparkles, Image as ImageIcon, Calendar } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  coupleId: string;
}

export const DailyStory: React.FC<Props> = ({ coupleId }) => {
  const [story, setStory] = useState<DailyStoryType | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const fetchStory = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'couples', coupleId, 'dailyStories'),
          where('date', '==', today),
          limit(1)
        );
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          setStory({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as DailyStoryType);
        }
      } catch (err) {
        console.error("Failed to fetch daily story", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStory();
  }, [coupleId, today]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      // Get recent journal entries for context
      const q = query(
        collection(db, 'couples', coupleId, 'journal'),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
      const snapshot = await getDocs(q);
      const entries = snapshot.docs.map(d => d.data() as JournalEntry);

      if (entries.length === 0) {
        alert("Please write some journal entries first to generate your story!");
        return;
      }

      const { prompt, imageUrl } = await generateDailyStory(entries);
      
      const newStory = {
        coupleId,
        imageUrl,
        prompt,
        reflection: "A visual representation of your journey today.",
        date: today,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'couples', coupleId, 'dailyStories'), newStory);
      setStory({ id: docRef.id, ...newStory } as DailyStoryType);
    } catch (err) {
      console.error("Failed to generate daily story", err);
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-stone-900 rounded-2xl flex items-center justify-center">
            <Calendar className="text-white w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-serif font-medium text-stone-900">My Story</h3>
            <p className="text-xs text-stone-500 font-serif italic">AI-generated daily visuals of your journey.</p>
          </div>
        </div>
        {!story && !isGenerating && (
          <button
            onClick={handleGenerate}
            className="flex items-center space-x-2 px-4 py-2 bg-stone-900 text-white rounded-full text-xs font-medium hover:bg-stone-800 transition-all shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate Today's Story</span>
          </button>
        )}
      </div>

      {isGenerating ? (
        <div className="aspect-video bg-stone-100 rounded-[32px] border border-stone-200 flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 border-4 border-stone-900/10 border-t-stone-900 rounded-full animate-spin" />
          <p className="text-stone-400 font-serif italic">SoulLink is painting your journey...</p>
        </div>
      ) : story ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative group"
        >
          <div className="aspect-video rounded-[32px] overflow-hidden shadow-xl border border-black/5">
            <img 
              src={story.imageUrl} 
              alt="Daily Story" 
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-8">
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-white/60">
                  <Sparkles className="w-3 h-3" />
                  <span className="text-[10px] font-mono uppercase tracking-widest">Generated Today</span>
                </div>
                <p className="text-white text-lg font-serif italic leading-relaxed">
                  "{story.prompt}"
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="aspect-video bg-stone-50 rounded-[32px] border border-dashed border-stone-300 flex flex-col items-center justify-center space-y-3 opacity-60">
          <ImageIcon className="w-10 h-10 text-stone-300" />
          <p className="text-stone-500 font-serif italic">No story generated for today yet.</p>
        </div>
      )}
    </div>
  );
};
