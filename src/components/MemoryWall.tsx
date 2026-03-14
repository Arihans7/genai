import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import { MemoryWallpaper, Couple } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Image as ImageIcon, Sparkles, Star } from 'lucide-react';

interface Props {
  coupleId: string;
}

export const MemoryWall: React.FC<Props> = ({ coupleId }) => {
  const [wallpapers, setWallpapers] = useState<MemoryWallpaper[]>([]);
  const [featuredId, setFeaturedId] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeCouple = onSnapshot(doc(db, 'couples', coupleId), (doc) => {
      if (doc.exists()) {
        setFeaturedId((doc.data() as Couple).featuredWallpaperId || null);
      }
    });

    const q = query(
      collection(db, 'couples', coupleId, 'wallpapers'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeWallpapers = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MemoryWallpaper));
      setWallpapers(data);
      setLoading(false);
    });

    return () => {
      unsubscribeCouple();
      unsubscribeWallpapers();
    };
  }, [coupleId]);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const id = e.dataTransfer.getData('text/plain');
    if (id && id !== featuredId) {
      try {
        await updateDoc(doc(db, 'couples', coupleId), {
          featuredWallpaperId: id
        });
      } catch (err) {
        console.error("Failed to update featured wallpaper", err);
      }
    }
  };

  const featuredWallpaper = wallpapers.find(w => w.id === featuredId);

  if (loading) return null;

  return (
    <div className="space-y-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-medium text-stone-900">Memory Wall</h2>
          <p className="text-sm text-stone-500 font-serif italic">Your journey, visualized. Drag a memory to feature it.</p>
        </div>
      </div>

      {/* Featured Story Drop Zone */}
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative w-full aspect-[21/9] rounded-[40px] overflow-hidden transition-all duration-500 border-2 ${
          isDraggingOver ? 'border-stone-900 scale-[1.02] shadow-2xl' : 'border-transparent shadow-xl'
        }`}
      >
        <AnimatePresence mode="wait">
          {featuredWallpaper ? (
            <motion.div
              key={featuredWallpaper.id}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0"
            >
              <img 
                src={featuredWallpaper.imageUrl} 
                alt="Featured Wallpaper" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-10">
                <div className="flex items-center space-x-2 text-white/80 mb-4">
                  <Star className="w-4 h-4 fill-current text-amber-400" />
                  <span className="text-xs font-mono uppercase tracking-widest">Featured Story</span>
                </div>
                <p className="text-white text-xl md:text-2xl font-serif italic leading-relaxed max-w-3xl">
                  "{featuredWallpaper.prompt}"
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-stone-100 flex flex-col items-center justify-center space-y-4 border border-dashed border-stone-300 rounded-[40px]"
            >
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm">
                <Star className="w-6 h-6 text-stone-300" />
              </div>
              <p className="text-stone-500 font-serif italic">Drag a memory here to feature it</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {wallpapers.length === 0 ? (
        <div className="h-64 bg-stone-50 rounded-[32px] border border-dashed border-stone-300 flex flex-col items-center justify-center space-y-3">
          <ImageIcon className="w-10 h-10 text-stone-300" />
          <p className="text-stone-500 font-serif italic">No memories visualized yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {wallpapers.map((wp, idx) => (
            <motion.div
              key={wp.id}
              draggable
              onDragStart={(e: any) => handleDragStart(e, wp.id)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`group relative aspect-[9/16] rounded-[24px] overflow-hidden shadow-md border border-black/5 cursor-grab active:cursor-grabbing hover:shadow-xl transition-all ${
                wp.id === featuredId ? 'ring-4 ring-stone-900 ring-offset-2' : ''
              }`}
            >
              <img 
                src={wp.imageUrl} 
                alt="Wallpaper" 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                <p className="text-white text-xs font-serif italic line-clamp-3">
                  "{wp.prompt}"
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
