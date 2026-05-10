/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useRef } from 'react';
import { Send, Menu, Search, ChevronLeft, MoreVertical, Image as ImageIcon, Smile, LogOut, Mic } from 'lucide-react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { Auth } from './components/Auth';

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'other';
  time: string;
}

export default function App() {
  const [inputValue, setInputValue] = useState('');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Handle Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Users
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(doc => {
        if (doc.id !== user.uid) {
          list.push({ id: doc.id, ...doc.data() });
        }
      });
      setUsers(list);
    });
    return () => unsubscribe();
  }, [user]);

  // Fetch Messages for selected user
  useEffect(() => {
    if (!user || !selectedUser) return;
    const chatId = [user.uid, selectedUser.id].sort().join('_');
    const q = query(
      collection(db, `chats/${chatId}/messages`),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: any[] = [];
      snapshot.forEach(doc => {
        msgs.push({ id: doc.id, ...doc.data() });
      });
      setChatMessages(msgs);
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      }, 100);
    });
    return () => unsubscribe();
  }, [user, selectedUser]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !user || !selectedUser) return;
    
    const text = inputValue;
    setInputValue('');
    
    const chatId = [user.uid, selectedUser.id].sort().join('_');
    await addDoc(collection(db, `chats/${chatId}/messages`), {
      text: text.trim(),
      senderId: user.uid,
      createdAt: serverTimestamp()
    });
  };

  const handleLogout = () => {
    signOut(auth);
  };

  if (loading) return <div className="h-[100dvh] bg-[#020617] flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div></div>;

  return (
    <div className="h-[100dvh] w-full bg-[#020617] text-white font-sans overflow-hidden flex flex-col relative">
      {/* Atmospheric Background Glows */}
      <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-100px] right-[-100px] w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[150px] pointer-events-none"></div>

      {/* Main App Container */}
      {!user ? (
        <Auth onSuccess={() => {}} />
      ) : (
      <div className="flex-1 flex overflow-hidden relative z-10">
        
        {/* Sidebar (Chats List) - Hidden on very small screens, visible on md and up */}
        <div className="hidden md:flex flex-col w-80 border-r border-white/10 bg-white/5 backdrop-blur-xl relative z-10">
          
          {/* Header */}
          <div className="p-6 pb-4">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-xl font-semibold tracking-tight text-white drop-shadow-md">KonataChat</h1>
              <button onClick={handleLogout} className="p-2 rounded-full hover:bg-red-500/20 text-white/50 hover:text-red-400 transition" title="Logout">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
              <input 
                type="text" 
                placeholder="Search users..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-full bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-blue-500/50 text-white placeholder-white/50 transition-all"
              />
            </div>
          </div>
          
          {/* Chat List */}
          <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
            {users.filter(u => u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || u.username?.toLowerCase().includes(searchTerm.toLowerCase())).map(u => (
              <div 
                key={u.id}
                onClick={() => setSelectedUser(u)}
                className={`p-3 rounded-2xl cursor-pointer transition ${selectedUser?.id === u.id ? 'bg-blue-500/20 border border-white/10 shadow-sm' : 'hover:bg-white/5 opacity-70'}`}
              >
                <div className="flex gap-3 items-center">
                  <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center relative overflow-hidden">
                    <span className="text-lg font-bold text-white/50">{u.displayName?.[0]?.toUpperCase() || '?'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h3 className="font-medium text-white truncate">{u.displayName}</h3>
                    </div>
                    <p className="text-xs text-white/50 truncate">{u.username}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col relative z-20 bg-gradient-to-b from-transparent to-blue-950/20">
          
          {!selectedUser ? (
            <div className="flex-1 flex items-center justify-center text-white/40">
               Select a user to start chatting
            </div>
          ) : (
            <>
              {/* Top Bar */}
              <div className="h-18 px-6 sm:px-8 py-4 flex justify-between items-center border-b border-white/5">
                <div className="flex items-center gap-3">
                  <button className="md:hidden p-2 -ml-2 rounded-full hover:bg-white/10 text-white/80" onClick={() => setSelectedUser(null)}>
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                    <span className="font-bold text-white">{selectedUser?.displayName?.[0]?.toUpperCase() || '?'}</span>
                  </div>
                  <div>
                    <h2 className="font-medium text-white">{selectedUser?.displayName}</h2>
                    <p className="text-xs text-blue-200">{selectedUser?.username}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 rounded-full hover:bg-white/10 text-white/80 transition-colors">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Messages Area */}
              <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-4">
                {chatMessages.map((msg) => {
                  const isMe = msg.senderId === user?.uid;
                  const time = msg.createdAt ? new Date(msg.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now';
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%] ${isMe ? 'self-end' : 'self-start'}`}>
                      <div 
                        className={`px-5 py-4 rounded-2xl text-sm leading-relaxed relative ${
                          isMe 
                            ? 'bg-blue-600/40 backdrop-blur-xl border border-blue-400/20 text-white rounded-tr-none shadow-[0_8px_32px_-12px_rgba(37,99,235,0.4)]' 
                            : 'bg-white/10 backdrop-blur-xl border border-white/10 text-white/95 rounded-tl-none'
                        }`}
                      >
                        {msg.text}
                      </div>
                      <span className="text-[11px] text-white/40 mt-1 px-1 font-medium select-none">{time}</span>
                    </div>
                  );
                })}
              </div>

              {/* Input Area */}
              <div className="p-4 sm:p-8 pt-4">
                <form onSubmit={handleSend} className="bg-white/5 backdrop-blur-2xl border border-white/10 p-2 rounded-[28px] flex items-center gap-1">
                  <div className="flex gap-1 pl-2">
                    <button type="button" className="p-2 hover:bg-white/10 rounded-full text-white/60 transition-colors">
                      <Smile className="w-5 h-5" />
                    </button>
                    <button type="button" className="p-2 hover:bg-white/10 rounded-full text-white/60 transition-colors hidden sm:block">
                      <ImageIcon className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <textarea 
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend(e);
                      }
                    }}
                    placeholder="Enter signal..." 
                    className="flex-1 bg-transparent px-4 py-2 text-sm text-white placeholder-white/40 focus:outline-none resize-none min-h-[40px] max-h-32 scrollbar-hide"
                    rows={1}
                  />
                  
                  <div className="pr-1 flex gap-1 items-center">
                    {!inputValue.trim() ? (
                      <button type="button" className="w-10 h-10 flex items-center justify-center bg-transparent hover:bg-white/10 text-white/60 rounded-full transition-colors">
                        <Mic className="w-5 h-5" />
                      </button>
                    ) : (
                      <button type="submit" className="w-12 h-10 flex items-center justify-center bg-blue-500 hover:bg-blue-400 text-white rounded-2xl transition-colors shadow-lg shadow-blue-500/40">
                        <Send className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
