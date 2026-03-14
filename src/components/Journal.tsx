import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, limit, getDocs, doc, updateDoc } from 'firebase/firestore';
import { JournalEntry, UserProfile, Milestone, Couple } from '../types';
import { analyzeJournalEntry, generateSpeech, generateImageFromPrompt } from '../services/geminiService';
import { Send, Sparkles, Heart, MessageSquare, AlertCircle, Volume2, VolumeX, Image as ImageIcon, Wand2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  coupleId: string;
  userProfile: UserProfile;
}

export const Journal: React.FC<Props> = ({ coupleId, userProfile }) => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [newEntry, setNewEntry] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [generatingImageId, setGeneratingImageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'couples', coupleId), (doc) => {
      if (doc.exists()) {
        setCouple({ id: doc.id, ...doc.data() } as Couple);
      }
    });
    return () => unsubscribe();
  }, [coupleId]);

  useEffect(() => {
    const q = query(collection(db, 'couples', coupleId, 'milestones'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMilestones(snapshot.docs.map(d => d.data() as Milestone));
    });
    return () => unsubscribe();
  }, [coupleId]);

  useEffect(() => {
    const q = query(
      collection(db, 'couples', coupleId, 'journal'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as JournalEntry[];
      setEntries(docs.reverse());
    });

    return () => unsubscribe();
  }, [coupleId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntry.trim() || isAnalyzing) return;

    setIsAnalyzing(true);
    const content = newEntry;
    setNewEntry('');

    try {
      // Analyze with Gemini, passing milestones, settings, and recent history
      const recentHistory = [...entries].slice(0, 10).reverse();
      const analysis = await analyzeJournalEntry(content, milestones, couple?.settings, recentHistory);

      await addDoc(collection(db, 'couples', coupleId, 'journal'), {
        coupleId,
        authorId: auth.currentUser?.uid,
        authorName: userProfile.displayName,
        content,
        mood: analysis.mood,
        reflection: analysis.reflection,
        sentimentScore: analysis.sentimentScore,
        conflictDetected: analysis.conflictDetected || false,
        coolingPrompt: analysis.coolingPrompt || null,
        suggestedImagePrompt: analysis.suggestedImagePrompt || null,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Failed to add entry", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleListen = async (entry: JournalEntry) => {
    if (playingAudioId === entry.id) {
      audioRef.current?.pause();
      setPlayingAudioId(null);
      return;
    }

    if (entry.audioData) {
      playAudio(entry.audioData, entry.id);
    } else {
      try {
        const audioBase64 = await generateSpeech(entry.reflection || "");
        if (audioBase64) {
          // Save audio data back to firestore for future use
          await updateDoc(doc(db, 'couples', coupleId, 'journal', entry.id), {
            audioData: audioBase64
          });
          playAudio(audioBase64, entry.id);
        }
      } catch (err) {
        console.error("Failed to generate speech", err);
      }
    }
  };

  const playAudio = (base64: string, id: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(`data:audio/mpeg;base64,${base64}`);
    audioRef.current = audio;
    setPlayingAudioId(id);
    audio.play();
    audio.onended = () => setPlayingAudioId(null);
  };

  const handleGenerateImage = async (entry: JournalEntry) => {
    if (!entry.suggestedImagePrompt || generatingImageId) return;
    
    setGeneratingImageId(entry.id);
    try {
      const imageUrl = await generateImageFromPrompt(entry.suggestedImagePrompt);
      
      // Update journal entry
      await updateDoc(doc(db, 'couples', coupleId, 'journal', entry.id), {
        generatedImageUrl: imageUrl
      });

      // Also save to Memory Wall
      await addDoc(collection(db, 'couples', coupleId, 'wallpapers'), {
        coupleId,
        entryId: entry.id,
        imageUrl,
        prompt: entry.suggestedImagePrompt,
        createdAt: serverTimestamp()
      });
    } catch (err: any) {
      console.error("Failed to generate image", err);
      if (err.message?.includes('429') || err.message?.includes('quota')) {
        setError("Image generation quota exceeded. Please try again later.");
      } else {
        setError("Failed to generate image. Please try again.");
      }
    } finally {
      setGeneratingImageId(null);
    }
  };

  const handleMagicPrompt = () => {
    setNewEntry("I'm feeling a bit nostalgic today. Do you remember when we first met at that coffee shop? It was raining outside. Can you visualize this memory for us? Also, I'm feeling a little stressed about work lately, any thoughts?");
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-[32px] shadow-sm border border-black/5 overflow-hidden relative">
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-50 text-red-600 px-6 py-3 rounded-full shadow-lg border border-red-100 flex items-center space-x-3"
          >
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-medium">{error}</span>
            <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-600 transition-colors">
              &times;
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="px-8 py-6 border-bottom border-stone-100 flex items-center justify-between bg-stone-50/50">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-stone-900 rounded-2xl flex items-center justify-center">
            <MessageSquare className="text-white w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-serif font-medium text-stone-900">
              {couple?.settings?.coupleMode ? 'Shared Journey' : 'Couple Journal'}
            </h3>
            <p className="text-xs text-stone-500 font-serif italic">
              {couple?.settings?.persona === 'spiritual' 
                ? 'Mindfulness and soul-work reflections.' 
                : 'A safe space for your shared emotions.'}
            </p>
          </div>
        </div>
      </div>

      {/* Entries */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-8 space-y-8 scroll-smooth"
      >
        <AnimatePresence initial={false}>
          {entries.map((entry, index) => (
            <React.Fragment key={entry.id}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex flex-col ${entry.authorId === auth.currentUser?.uid ? 'items-end' : 'items-start'}`}
              >
                <div className={`max-w-[80%] space-y-2`}>
                  <div className="flex items-center space-x-2 px-1">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-stone-400">
                      {entry.authorName}
                    </span>
                  </div>
                  
                  <div className={`p-5 rounded-3xl ${
                    entry.authorId === auth.currentUser?.uid 
                      ? 'bg-stone-900 text-white rounded-tr-none' 
                      : 'bg-stone-100 text-stone-900 rounded-tl-none'
                  }`}>
                    <p className="leading-relaxed">{entry.content}</p>
                  </div>

                  {entry.reflection && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-4 p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-2 relative group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 text-stone-400">
                          <Sparkles className="w-3 h-3" />
                          <span className="text-[10px] font-mono uppercase tracking-widest">SoulLink Reflection • {entry.mood}</span>
                        </div>
                        <button
                          onClick={() => handleListen(entry)}
                          className="p-1.5 text-stone-400 hover:text-stone-900 transition-colors bg-white rounded-full shadow-sm"
                          title="Listen to reflection"
                        >
                          {playingAudioId === entry.id ? (
                            <VolumeX className="w-3.5 h-3.5" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <p className="text-sm text-stone-600 font-serif italic leading-relaxed">
                        "{entry.reflection}"
                      </p>
                    </motion.div>
                  )}

                  {entry.conflictDetected && entry.coolingPrompt && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mt-4 p-6 bg-red-50 border border-red-100 rounded-[24px] space-y-3"
                    >
                      <div className="flex items-center space-x-2 text-red-400">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-[10px] font-mono uppercase tracking-widest">Conflict Diffuser Active</span>
                      </div>
                      <p className="text-sm text-red-900 font-serif italic">
                        "I sense some tension. Let's take a cooling period. {entry.coolingPrompt}"
                      </p>
                    </motion.div>
                  )}

                  {entry.generatedImageUrl ? (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mt-4 rounded-3xl overflow-hidden shadow-md border border-black/5 relative group"
                    >
                      <img src={entry.generatedImageUrl} alt="Generated Memory" className="w-full h-auto object-cover" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                        <p className="text-white text-xs font-serif italic line-clamp-2">"{entry.suggestedImagePrompt}"</p>
                      </div>
                    </motion.div>
                  ) : entry.suggestedImagePrompt ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-4"
                    >
                      <button
                        onClick={() => handleGenerateImage(entry)}
                        disabled={generatingImageId === entry.id}
                        className="flex items-center space-x-2 px-4 py-2 bg-stone-900 text-white rounded-full text-xs font-medium hover:bg-stone-800 transition-all shadow-sm disabled:opacity-50"
                      >
                        {generatingImageId === entry.id ? (
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <ImageIcon className="w-3.5 h-3.5" />
                        )}
                        <span>{generatingImageId === entry.id ? 'Painting memory...' : '✨ Visualize this memory'}</span>
                      </button>
                    </motion.div>
                  ) : null}
                </div>
              </motion.div>
            </React.Fragment>
          ))}
        </AnimatePresence>
        
        {entries.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
            <Heart className="w-12 h-12 text-stone-300" />
            <p className="text-stone-500 font-serif italic">Your journey begins here. Share your first thought.</p>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-6 bg-stone-50/50 border-t border-stone-100">
        <div className="relative flex items-center">
          <button
            type="button"
            onClick={handleMagicPrompt}
            className="absolute left-4 p-2 text-stone-400 hover:text-stone-900 transition-colors"
            title="Use Master Test Prompt"
          >
            <Wand2 className="w-5 h-5" />
          </button>
          <input
            type="text"
            value={newEntry}
            onChange={(e) => setNewEntry(e.target.value)}
            placeholder={isAnalyzing ? "SoulLink is reflecting..." : "How are you feeling today?"}
            disabled={isAnalyzing}
            className="w-full pl-14 pr-16 py-4 bg-white border border-stone-200 rounded-full focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!newEntry.trim() || isAnalyzing}
            className="absolute right-2 p-3 bg-stone-900 text-white rounded-full hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:bg-stone-300"
          >
            {isAnalyzing ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
