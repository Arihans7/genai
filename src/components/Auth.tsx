import React from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase';
import { Heart } from 'lucide-react';

export const Auth: React.FC = () => {
  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f5f5f0] p-4">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-stone-900 rounded-full flex items-center justify-center shadow-lg">
            <Heart className="text-white w-10 h-10 fill-current" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-5xl font-serif font-light tracking-tight text-stone-900">SoulLink</h1>
          <p className="text-stone-500 font-serif italic">An emotional AI companion for your relationship.</p>
        </div>

        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-black/5 space-y-6">
          <p className="text-stone-600 leading-relaxed">
            Connect with your partner on a deeper level. SoulLink helps you translate feelings into words and provides empathetic reflections.
          </p>
          
          <button
            onClick={handleLogin}
            className="w-full py-4 bg-stone-900 text-white rounded-full font-medium hover:bg-stone-800 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-md"
          >
            Sign in with Google
          </button>
        </div>
        
        <p className="text-xs text-stone-400 uppercase tracking-widest">
          SoulLink is an AI companion, not a replacement for therapy.
        </p>
      </div>
    </div>
  );
};
