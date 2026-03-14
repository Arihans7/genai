import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, getDocs, addDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { JournalEntry, Insight } from '../types';
import { generateRelationshipInsights } from '../services/geminiService';
import { TrendingUp, Thermometer, Brain, Sparkles, RefreshCw, Heart } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  coupleId: string;
}

export const Insights: React.FC<Props> = ({ coupleId }) => {
  const [latestInsight, setLatestInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'couples', coupleId, 'insights'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setLatestInsight({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Insight);
      }
    });

    return () => unsubscribe();
  }, [coupleId]);

  const refreshInsights = async () => {
    setLoading(true);
    try {
      // Get last 20 entries for analysis
      const q = query(
        collection(db, 'couples', coupleId, 'journal'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const snapshot = await getDocs(q);
      const entries = snapshot.docs.map(d => d.data() as JournalEntry);

      if (entries.length < 3) {
        alert("Need at least 3 journal entries to generate insights.");
        return;
      }

      const analysis = await generateRelationshipInsights(entries);
      if (analysis) {
        await addDoc(collection(db, 'couples', coupleId, 'insights'), {
          coupleId,
          emotionalTemperature: analysis.emotionalTemperature,
          patterns: analysis.patterns,
          reflection: analysis.reflection,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error("Failed to refresh insights", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-stone-900 rounded-2xl flex items-center justify-center">
            <TrendingUp className="text-white w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-serif font-medium text-stone-900">Emotional Insights</h3>
            <p className="text-xs text-stone-500 font-serif italic">AI-powered reflections on your connection.</p>
          </div>
        </div>
        <button
          onClick={refreshInsights}
          disabled={loading}
          className="p-2 text-stone-400 hover:text-stone-900 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {!latestInsight ? (
        <div className="bg-white p-12 rounded-[32px] border border-black/5 text-center space-y-4">
          <Brain className="w-12 h-12 text-stone-200 mx-auto" />
          <div className="space-y-2">
            <p className="text-stone-600 font-serif italic">SoulLink is waiting for more shared moments.</p>
            <p className="text-xs text-stone-400 uppercase tracking-widest">Add a few journal entries to unlock insights</p>
          </div>
          <button
            onClick={refreshInsights}
            disabled={loading}
            className="px-6 py-2 bg-stone-900 text-white rounded-full text-sm font-medium hover:bg-stone-800 transition-colors"
          >
            Generate First Insight
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Temperature Card */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-8 rounded-[32px] border border-black/5 space-y-6"
          >
            <div className="flex items-center space-x-2 text-stone-400">
              <Thermometer className="w-4 h-4" />
              <span className="text-[10px] font-mono uppercase tracking-widest">Emotional Temperature</span>
            </div>
            <div className="space-y-2">
              <h4 className="text-4xl font-serif font-light text-stone-900">{latestInsight.emotionalTemperature}</h4>
              <p className="text-sm text-stone-500 leading-relaxed">
                Based on your recent interactions, your relationship feels {latestInsight.emotionalTemperature.toLowerCase()}.
              </p>
            </div>
          </motion.div>

          {/* Heartbeat Card */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05 }}
            className="bg-white p-8 rounded-[32px] border border-black/5 space-y-6"
          >
            <div className="flex items-center space-x-2 text-stone-400">
              <Heart className={`w-4 h-4 ${latestInsight.heartbeat === 'racing' ? 'animate-pulse text-red-400' : ''}`} />
              <span className="text-[10px] font-mono uppercase tracking-widest">The Pulse</span>
            </div>
            <div className="space-y-2">
              <h4 className="text-4xl font-serif font-light text-stone-900 capitalize">{latestInsight.heartbeat}</h4>
              <p className="text-sm text-stone-500 leading-relaxed">
                Your relationship heartbeat is {latestInsight.heartbeat}.
              </p>
              <div className="mt-4 p-4 bg-stone-50 rounded-2xl border border-stone-100">
                <p className="text-xs text-stone-400 uppercase tracking-widest mb-1">Suggested Activity</p>
                <p className="text-sm text-stone-700 font-serif italic">"{latestInsight.activitySuggestion}"</p>
              </div>
            </div>
          </motion.div>

          {/* Patterns Card */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white p-8 rounded-[32px] border border-black/5 space-y-6"
          >
            <div className="flex items-center space-x-2 text-stone-400">
              <TrendingUp className="w-4 h-4" />
              <span className="text-[10px] font-mono uppercase tracking-widest">Recurring Patterns</span>
            </div>
            <ul className="space-y-3">
              {latestInsight.patterns.map((pattern, i) => (
                <li key={i} className="flex items-start space-x-3 text-sm text-stone-600">
                  <div className="w-1.5 h-1.5 bg-stone-900 rounded-full mt-1.5 shrink-0" />
                  <span>{pattern}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Deep Reflection */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="md:col-span-2 bg-stone-900 p-10 rounded-[40px] text-white space-y-6 relative overflow-hidden"
          >
            <Sparkles className="absolute top-8 right-8 text-white/10 w-24 h-24" />
            <div className="relative z-10 space-y-6">
              <div className="flex items-center space-x-2 text-white/40">
                <Brain className="w-4 h-4" />
                <span className="text-[10px] font-mono uppercase tracking-widest">SoulLink Deep Reflection</span>
              </div>
              <p className="text-2xl font-serif font-light leading-relaxed italic text-stone-100">
                "{latestInsight.reflection}"
              </p>
              <div className="pt-4 border-t border-white/10">
                <p className="text-xs text-white/40 font-serif italic">
                  Generated on {new Date(latestInsight.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
