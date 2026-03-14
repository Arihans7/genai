import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, query, orderBy, limit, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, Couple, JournalEntry, Milestone } from './types';
import { Auth } from './components/Auth';
import { CoupleSetup } from './components/CoupleSetup';
import { Journal } from './components/Journal';
import { Insights } from './components/Insights';
import { Milestones } from './components/Milestones';
import { MemoryWall } from './components/MemoryWall';
import { TimeCapsule } from './components/TimeCapsule';
import { DailyStory } from './components/DailyStory';
import { ErrorBoundary } from './components/ErrorBoundary';
import { generateVisualMoodPrompt } from './services/geminiService';
import { Heart, MessageSquare, TrendingUp, LogOut, Share2, Calendar, Image as ImageIcon, Settings, Users, Wind, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'journal' | 'insights' | 'milestones' | 'wall' | 'capsule'>('journal');
  const [visualMood, setVisualMood] = useState('Soft minimalist nature, warm morning light, peaceful atmosphere');
  const [showSettings, setShowSettings] = useState(false);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [bgStyle, setBgStyle] = useState('from-stone-200 via-stone-100 to-stone-200');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || 'Anonymous',
            email: firebaseUser.email || '',
            photoURL: firebaseUser.photoURL || undefined,
          };
          await setDoc(userRef, newProfile);
          setUserProfile(newProfile);
        } else {
          setUserProfile(userSnap.data() as UserProfile);
        }
      } else {
        setUserProfile(null);
        setCouple(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        setUserProfile(doc.data() as UserProfile);
      }
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!userProfile?.coupleId) {
      setCouple(null);
      return;
    }
    const unsubscribe = onSnapshot(doc(db, 'couples', userProfile.coupleId), (doc) => {
      if (doc.exists()) {
        setCouple({ id: doc.id, ...doc.data() } as Couple);
      }
    });
    return () => unsubscribe();
  }, [userProfile?.coupleId]);

  useEffect(() => {
    if (!userProfile?.coupleId) return;
    const q = query(collection(db, 'couples', userProfile.coupleId, 'milestones'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMilestones(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Milestone)));
    });
    return () => unsubscribe();
  }, [userProfile?.coupleId]);

  // Dynamic Background & Visual Engine
  useEffect(() => {
    if (!userProfile?.coupleId) return;
    
    const q = query(
      collection(db, 'couples', userProfile.coupleId, 'journal'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) return;
      const entries = snapshot.docs.map(d => d.data() as JournalEntry);
      
      // Visual Mood Prompt
      const prompt = await generateVisualMoodPrompt(entries);
      setVisualMood(prompt);

      // Sentiment-based Background Change
      const latestEntry = entries[0];
      const sentiment = (latestEntry as any).sentimentScore || 0.5;
      if (sentiment > 0.8) {
        setBgStyle('from-orange-100 via-rose-50 to-amber-100'); // Pastel Warm Gradients
      } else if (sentiment < 0.3) {
        setBgStyle('from-slate-300 via-blue-200 to-slate-400'); // Deep Blue Rain vibes
      } else {
        setBgStyle('from-stone-200 via-stone-100 to-stone-200'); // Neutral
      }
    });

    return () => unsubscribe();
  }, [userProfile?.coupleId]);

  const toggleSetting = async (key: 'coupleMode' | 'persona') => {
    if (!couple) return;
    const currentSettings = couple.settings || { coupleMode: false, persona: 'default' };
    const newSettings = { ...currentSettings };
    
    if (key === 'coupleMode') newSettings.coupleMode = !currentSettings.coupleMode;
    if (key === 'persona') newSettings.persona = currentSettings.persona === 'default' ? 'spiritual' : 'default';

    await updateDoc(doc(db, 'couples', couple.id), { settings: newSettings });
  };

  const getDaysUntil = (dateStr: string) => {
    const target = new Date(dateStr);
    const now = new Date();
    const diff = target.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f0]">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-stone-900/10 border-t-stone-900 rounded-full animate-spin" />
          <p className="text-stone-400 font-serif italic">SoulLink is connecting...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Auth />;

  if (userProfile && !userProfile.coupleId) {
    return <CoupleSetup userProfile={userProfile} onUpdate={() => {}} />;
  }

  const upcomingMilestone = milestones
    .filter(m => getDaysUntil(m.date) >= 0)
    .sort((a, b) => getDaysUntil(a.date) - getDaysUntil(b.date))[0];

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#f5f5f0] flex flex-col relative overflow-hidden transition-colors duration-1000">
        {/* Dynamic Background Layer */}
        <div className="absolute inset-0 z-0 opacity-30 pointer-events-none">
          <div className={`absolute inset-0 bg-gradient-to-br ${bgStyle} transition-all duration-1000`} />
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-[10px] font-mono uppercase tracking-[1em] text-stone-400/50 rotate-90">
              {visualMood}
            </p>
          </div>
        </div>

        {/* Navigation Bar */}
        <nav className="bg-white/80 backdrop-blur-md border-b border-black/5 px-8 py-4 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-stone-900 rounded-xl flex items-center justify-center">
                <Heart className="text-white w-4 h-4 fill-current" />
              </div>
              <h1 className="text-xl font-serif font-medium text-stone-900">SoulLink</h1>
            </div>

            <div className="flex items-center space-x-1 bg-stone-100/50 p-1 rounded-full">
              <button
                onClick={() => setActiveTab('journal')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-full text-xs font-medium transition-all ${
                  activeTab === 'journal' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Journal</span>
              </button>
              <button
                onClick={() => setActiveTab('insights')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-full text-xs font-medium transition-all ${
                  activeTab === 'insights' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Insights</span>
              </button>
              <button
                onClick={() => setActiveTab('milestones')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-full text-xs font-medium transition-all ${
                  activeTab === 'milestones' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Milestones</span>
              </button>
              <button
                onClick={() => setActiveTab('wall')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-full text-xs font-medium transition-all ${
                  activeTab === 'wall' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Wall</span>
              </button>
              <button
                onClick={() => setActiveTab('capsule')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-full text-xs font-medium transition-all ${
                  activeTab === 'capsule' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Capsule</span>
              </button>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 transition-colors ${showSettings ? 'text-stone-900' : 'text-stone-400 hover:text-stone-900'}`}
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={() => auth.signOut()}
                className="p-2 text-stone-400 hover:text-stone-900 transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </nav>

        {/* Settings Panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white border-b border-black/5 px-8 py-6 z-40"
            >
              <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-mono uppercase tracking-widest text-stone-400">AI Modes</h4>
                  <div className="flex flex-col space-y-2">
                    <button
                      onClick={() => toggleSetting('coupleMode')}
                      className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                        couple?.settings?.coupleMode ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-600'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Users className="w-4 h-4" />
                        <span className="text-sm font-medium">Couple Mode</span>
                      </div>
                      <div className={`w-8 h-4 rounded-full relative transition-colors ${couple?.settings?.coupleMode ? 'bg-white/20' : 'bg-stone-100'}`}>
                        <div className={`absolute top-1 w-2 h-2 rounded-full transition-all ${couple?.settings?.coupleMode ? 'right-1 bg-white' : 'left-1 bg-stone-400'}`} />
                      </div>
                    </button>
                    <button
                      onClick={() => toggleSetting('persona')}
                      className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                        couple?.settings?.persona === 'spiritual' ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-600'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Wind className="w-4 h-4" />
                        <span className="text-sm font-medium">Spiritual Companion</span>
                      </div>
                      <div className={`w-8 h-4 rounded-full relative transition-colors ${couple?.settings?.persona === 'spiritual' ? 'bg-white/20' : 'bg-stone-100'}`}>
                        <div className={`absolute top-1 w-2 h-2 rounded-full transition-all ${couple?.settings?.persona === 'spiritual' ? 'right-1 bg-white' : 'left-1 bg-stone-400'}`} />
                      </div>
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-mono uppercase tracking-widest text-stone-400">Connection</h4>
                  <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200">
                    <p className="text-[10px] text-stone-400 uppercase tracking-widest mb-2">Invite Code</p>
                    <div className="flex items-center justify-between">
                      <code className="text-lg font-mono font-bold text-stone-900">{couple?.inviteCode}</code>
                      <button className="p-2 text-stone-400 hover:text-stone-900"><Share2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>

                {upcomingMilestone && (
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-mono uppercase tracking-widest text-stone-400">Next Milestone</h4>
                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center space-x-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                        <Clock className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-xs font-serif font-bold text-emerald-900">{upcomingMilestone.title}</p>
                        <p className="text-[10px] text-emerald-600 uppercase tracking-widest">{getDaysUntil(upcomingMilestone.date)} days to go</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className="flex-1 max-w-6xl w-full mx-auto p-8 relative z-10 overflow-hidden">
          {activeTab === 'journal' && (
            <Journal coupleId={userProfile!.coupleId!} userProfile={userProfile!} />
          )}
          {activeTab === 'insights' && (
            <div className="space-y-12">
              <DailyStory coupleId={userProfile!.coupleId!} />
              <Insights coupleId={userProfile!.coupleId!} />
            </div>
          )}
          {activeTab === 'milestones' && (
            <Milestones coupleId={userProfile!.coupleId!} />
          )}
          {activeTab === 'wall' && (
            <MemoryWall coupleId={userProfile!.coupleId!} />
          )}
          {activeTab === 'capsule' && (
            <TimeCapsule coupleId={userProfile!.coupleId!} userId={user!.uid} />
          )}
        </main>

        <footer className="py-6 text-center relative z-10">
          <p className="text-[10px] text-stone-400 uppercase tracking-[0.2em] font-mono">
            Empathetic AI Companion • SoulLink v1.2
          </p>
        </footer>
      </div>
    </ErrorBoundary>
  );
}
