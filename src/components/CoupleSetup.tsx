import React, { useState } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, updateDoc, doc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { UserProfile } from '../types';
import { Users, UserPlus, ArrowRight } from 'lucide-react';

interface Props {
  userProfile: UserProfile;
  onUpdate: () => void;
}

export const CoupleSetup: React.FC<Props> = ({ userProfile, onUpdate }) => {
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const createCouple = async () => {
    setLoading(true);
    setError('');
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const coupleRef = await addDoc(collection(db, 'couples'), {
        userIds: [auth.currentUser?.uid],
        createdAt: serverTimestamp(),
        inviteCode: code
      });

      await updateDoc(doc(db, 'users', auth.currentUser!.uid), {
        coupleId: coupleRef.id
      });

      onUpdate();
    } catch (err) {
      console.error(err);
      setError('Failed to create couple.');
    } finally {
      setLoading(false);
    }
  };

  const joinCouple = async () => {
    if (!inviteCode) return;
    setLoading(true);
    setError('');
    try {
      const q = query(collection(db, 'couples'), where('inviteCode', '==', inviteCode.toUpperCase()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('Invalid invite code.');
        setLoading(false);
        return;
      }

      const coupleDoc = querySnapshot.docs[0];
      const coupleData = coupleDoc.data();

      if (coupleData.userIds.length >= 2) {
        setError('This couple already has two members.');
        setLoading(false);
        return;
      }

      await updateDoc(doc(db, 'couples', coupleDoc.id), {
        userIds: [...coupleData.userIds, auth.currentUser?.uid]
      });

      await updateDoc(doc(db, 'users', auth.currentUser!.uid), {
        coupleId: coupleDoc.id
      });

      onUpdate();
    } catch (err) {
      console.error(err);
      setError('Failed to join couple.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f0] p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-serif font-medium text-stone-900">Welcome, {userProfile.displayName}</h2>
          <p className="text-stone-500">To start your SoulLink journey, connect with your partner.</p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Create Option */}
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-black/5 space-y-4">
            <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center">
              <UserPlus className="text-stone-900 w-6 h-6" />
            </div>
            <h3 className="text-xl font-serif font-medium text-stone-900">Start a new connection</h3>
            <p className="text-sm text-stone-500">Create a unique invite code to share with your partner.</p>
            <button
              onClick={createCouple}
              disabled={loading}
              className="w-full py-3 bg-stone-900 text-white rounded-full font-medium hover:bg-stone-800 transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Invite Code'}
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-stone-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-[#f5f5f0] text-stone-400 font-serif italic">or</span>
            </div>
          </div>

          {/* Join Option */}
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-black/5 space-y-4">
            <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center">
              <Users className="text-stone-900 w-6 h-6" />
            </div>
            <h3 className="text-xl font-serif font-medium text-stone-900">Join your partner</h3>
            <p className="text-sm text-stone-500">Enter the invite code shared by your partner.</p>
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="Invite Code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="flex-1 px-4 py-3 bg-stone-50 border border-stone-200 rounded-full focus:outline-none focus:ring-2 focus:ring-stone-900/10 uppercase"
              />
              <button
                onClick={joinCouple}
                disabled={loading || !inviteCode}
                className="p-3 bg-stone-900 text-white rounded-full hover:bg-stone-800 transition-colors disabled:opacity-50"
              >
                <ArrowRight className="w-6 h-6" />
              </button>
            </div>
            {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
};
