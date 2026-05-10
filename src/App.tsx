/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useRef } from 'react';
import { Send, Menu, Search, ChevronLeft, MoreVertical, Image as ImageIcon, Smile, LogOut, Mic, Settings, Paperclip, X, Square } from 'lucide-react';
import { auth, db, storage } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Auth } from './components/Auth';
import { SettingsModal } from './components/SettingsModal';
import EmojiPicker from 'emoji-picker-react';

const THEMES: Record<string, { glow1: string, glow2: string, accentBtn: string, accentHover: string, accentGlow: string, bubbleSent: string, bgGradient: string }> = {
  blue: {
    glow1: 'bg-blue-600/20', glow2: 'bg-indigo-600/20',
    accentBtn: 'bg-blue-500', accentHover: 'hover:bg-blue-400', accentGlow: 'shadow-blue-500/40',
    bubbleSent: 'bg-blue-600/40 border-blue-400/20 shadow-[0_8px_32px_-12px_rgba(37,99,235,0.4)] text-white',
    bgGradient: 'to-blue-950/20'
  },
  red: {
    glow1: 'bg-red-600/20', glow2: 'bg-orange-600/20',
    accentBtn: 'bg-red-500', accentHover: 'hover:bg-red-400', accentGlow: 'shadow-red-500/40',
    bubbleSent: 'bg-red-600/40 border-red-400/20 shadow-[0_8px_32px_-12px_rgba(220,38,38,0.4)] text-white',
    bgGradient: 'to-red-950/20'
  },
  green: {
    glow1: 'bg-green-600/20', glow2: 'bg-emerald-600/20',
    accentBtn: 'bg-green-500', accentHover: 'hover:bg-green-400', accentGlow: 'shadow-green-500/40',
    bubbleSent: 'bg-green-600/40 border-green-400/20 shadow-[0_8px_32px_-12px_rgba(22,163,74,0.4)] text-white',
    bgGradient: 'to-green-950/20'
  },
  orange: {
    glow1: 'bg-orange-600/20', glow2: 'bg-amber-600/20',
    accentBtn: 'bg-orange-500', accentHover: 'hover:bg-orange-400', accentGlow: 'shadow-orange-500/40',
    bubbleSent: 'bg-orange-600/40 border-orange-400/20 shadow-[0_8px_32px_-12px_rgba(234,88,12,0.4)] text-white',
    bgGradient: 'to-orange-950/20'
  }
};

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
  
  // Settings & Theme
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState('blue');
  const [userData, setUserData] = useState<any>(null);

  // Extras
  const [showEmoji, setShowEmoji] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  
  // Chat specific options
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const chatBgInputRef = useRef<HTMLInputElement>(null);

  const currentChatId = user && selectedUser ? [user.uid, selectedUser.id].sort().join('_') : null;
  const currentChatBg = currentChatId && userData?.chatBackgrounds?.[currentChatId] ? userData.chatBackgrounds[currentChatId] : '';
  const activeSelectedUser = users.find(u => u.id === selectedUser?.id) || selectedUser;

  
  // Audio Recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fullscreen image viewer
  const [viewerImage, setViewerImage] = useState<string | null>(null);

  const t = THEMES[theme] || THEMES.blue;

  const playNotificationSound = (type: 'send' | 'receive') => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === 'send') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.05);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
      }
    } catch (e) {
      console.error('Audio play failed', e);
    }
  };

  // Handle Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Online Heartbeat
  useEffect(() => {
    if (!user) return;
    
    const updateOnlineStatus = () => {
      updateDoc(doc(db, 'users', user.uid), { lastActive: Date.now() }).catch(() => {});
    };
    
    // Immediate update
    updateOnlineStatus();

    const interval = setInterval(updateOnlineStatus, 30000); // 30s heartbeat
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateOnlineStatus();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  // Fetch Current User Extra Data
  useEffect(() => {
    if (!user) return;
    
    // Listen to user data
    const userUnsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserData(data);
        if (data.theme) setTheme(data.theme);
      }
    });
    
    // Also listen to users to find contacts
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
    return () => {
      userUnsubscribe();
      unsubscribe();
    };
  }, [user]);

  const handleChatBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !user || !currentChatId) return;
    const file = e.target.files[0];
    
    try {
      const compressed = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target?.result as string;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let { width, height } = img;
            if (width > 1200) { height *= 1200 / width; width = 1200; }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.6));
          };
          img.onerror = reject;
        };
        reader.onerror = reject;
      });
      
      await updateDoc(doc(db, 'users', user.uid), {
        [`chatBackgrounds.${currentChatId}`]: compressed
      });
      setChatMenuOpen(false);
    } catch (error) {
      console.error("Error setting chat background: ", error);
      alert("Failed to upload background.");
    }
  };

  // Fetch Messages for selected user
  useEffect(() => {
    if (!user || !selectedUser) return;
    const chatId = [user.uid, selectedUser.id].sort().join('_');
    const q = query(
      collection(db, `chats/${chatId}/messages`),
      orderBy('createdAt', 'asc')
    );
    let initialLoad = true;
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

      if (!initialLoad) {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            const data = change.doc.data();
            if (data.senderId !== user.uid) {
              playNotificationSound('receive');
            }
          }
        });
      }
      initialLoad = false;
    });
    return () => unsubscribe();
  }, [user, selectedUser]);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleTyping = (text: string) => {
    setInputValue(text);
    if (!user || !selectedUser) return;
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Immediately clear typing if blank
    if (!text.trim()) {
      updateDoc(doc(db, 'users', user.uid), {
        [`typingTo.${selectedUser.id}`]: ''
      }).catch(() => {});
      return;
    }

    typingTimeoutRef.current = setTimeout(() => {
      updateDoc(doc(db, 'users', user.uid), {
        [`typingTo.${selectedUser.id}`]: text
      }).catch(() => {});
    }, 500);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !user || !selectedUser) return;
    
    const text = inputValue;
    setInputValue('');
    setShowEmoji(false);
    playNotificationSound('send');
    
    // Clear typing draft immediately when sending
    updateDoc(doc(db, 'users', user.uid), {
      [`typingTo.${selectedUser.id}`]: ''
    }).catch(() => {});
    
    const chatId = [user.uid, selectedUser.id].sort().join('_');
    await addDoc(collection(db, `chats/${chatId}/messages`), {
      text: text.trim(),
      type: 'text',
      senderId: user.uid,
      createdAt: serverTimestamp()
    });
    
    // Update recent chats
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        [`recentChats.${selectedUser.id}`]: Date.now()
      });
      await updateDoc(doc(db, 'users', selectedUser.id), {
        [`recentChats.${user.uid}`]: Date.now()
      });
    } catch (e) {
      console.log('Could not update recent chats for other user');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isImage: boolean) => {
    if (!e.target.files || !e.target.files[0] || !user || !selectedUser) return;
    const file = e.target.files[0];
    
    // Check size limit (e.g., 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert("File is too large! Maximum 10MB allowed.");
      return;
    }
    
    const chatId = [user.uid, selectedUser.id].sort().join('_');
    
    try {
      let url = '';
      if (isImage) {
        url = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
              const canvas = document.createElement('canvas');
              let { width, height } = img;
              if (width > 1200) { height *= 1200 / width; width = 1200; }
              canvas.width = width; canvas.height = height;
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(img, 0, 0, width, height);
              // Max quality 0.6 to save space in Firestore
              resolve(canvas.toDataURL('image/jpeg', 0.6));
            };
            img.onerror = reject;
          };
          reader.onerror = reject;
        });
      } else {
        const storageRef = ref(storage, `chats/${chatId}/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        url = await getDownloadURL(snapshot.ref);
      }
      
      await addDoc(collection(db, `chats/${chatId}/messages`), {
        text: file.name,
        type: isImage ? 'image' : 'file',
        url: url,
        senderId: user.uid,
        createdAt: serverTimestamp()
      });
      
      playNotificationSound('send');
      await updateDoc(doc(db, 'users', user.uid), { [`recentChats.${selectedUser.id}`]: Date.now() });
      await updateDoc(doc(db, 'users', selectedUser.id), { [`recentChats.${user.uid}`]: Date.now() });
    } catch (error) {
      console.error("Error uploading file: ", error);
      alert("Failed to upload file. Check permissions.");
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let options = {};
      if (MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/webm' };
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options = { mimeType: 'audio/mp4' };
      }
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current);
        if (audioBlob.size > 0 && user && selectedUser) {
          const reader = new FileReader();
          reader.onload = async (e) => {
            const url = e.target?.result as string;
            // Prevent payload too large (>1MB)
            if (url.length > 1048487) {
              alert("Audio message is too long. Limit to ~60s.");
              return;
            }
            const chatId = [user.uid, selectedUser.id].sort().join('_');
            try {
              await addDoc(collection(db, `chats/${chatId}/messages`), {
                text: 'Voice Message',
                type: 'audio',
                url: url,
                senderId: user.uid,
                createdAt: serverTimestamp()
              });
              playNotificationSound('send');
              await updateDoc(doc(db, 'users', user.uid), { [`recentChats.${selectedUser.id}`]: Date.now() });
              await updateDoc(doc(db, 'users', selectedUser.id), { [`recentChats.${user.uid}`]: Date.now() });
            } catch (err) {
              console.error(err);
              alert("Failed to upload voice message.");
            }
          };
          reader.readAsDataURL(audioBlob);
        }
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 60) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error("Error accessing mic:", err);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleLogout = () => {
    signOut(auth);
  };

  const isOnline = (targetUser: any) => {
    if (!targetUser?.lastActive) return false;
    const diff = Math.abs(Date.now() - targetUser.lastActive);
    return diff < 120000; // 2 minutes threshold for clock skew and intervals
  };
  
  const getTypingStatus = (targetUser: any) => {
    if (!targetUser || !user) return null;
    const typingText = targetUser.typingTo?.[user.uid];
    if (!typingText) return null;
    
    if (userData?.username === '@Konataizumi' && userData?.spyMode) {
      return `печатает: "${typingText}"`;
    }
    return "печатает...";
  };

  if (loading) return <div className="h-[100dvh] bg-[#020617] flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div></div>;

  return (
    <div className="h-[100dvh] w-full bg-[#020617] text-white font-sans overflow-hidden flex flex-col relative">
      {showSettings && (
        <SettingsModal 
          onClose={() => setShowSettings(false)} 
          currentUserData={userData}
          currentTheme={theme}
          setTheme={setTheme}
        />
      )}

      {/* Fullscreen Image Viewer Modal */}
      {viewerImage && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm transition-all" onClick={() => setViewerImage(null)}>
          <img src={viewerImage} alt="Fullscreen" className="max-w-full max-h-full object-contain shadow-2xl rounded-sm" onClick={(e) => e.stopPropagation()} />
          <button className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors cursor-pointer" onClick={() => setViewerImage(null)}>
            <X className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* Atmospheric Background Glows */}
      <div className={`absolute top-[-100px] left-[-100px] w-[500px] h-[500px] ${t.glow1} rounded-full blur-[120px] pointer-events-none transition-colors duration-1000`}></div>
      <div className={`absolute bottom-[-100px] right-[-100px] w-[600px] h-[600px] ${t.glow2} rounded-full blur-[150px] pointer-events-none transition-colors duration-1000`}></div>

      {/* Main App Container */}
      {!user ? (
        <Auth onSuccess={() => {}} />
      ) : (
      <div className="flex-1 flex overflow-hidden relative z-10">
        
        {/* Sidebar (Chats List) - Hidden on very small screens if user selected, visible on md and up */}
        <div className={`${selectedUser ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 border-r border-white/10 bg-white/5 backdrop-blur-xl relative z-10`}>
          
          {/* Header */}
          <div className="p-6 pb-4">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-xl font-semibold tracking-tight text-white drop-shadow-md">KonataChat</h1>
              <div className="flex gap-2">
                <button onClick={() => setShowSettings(true)} className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition" title="Settings">
                  <Settings className="w-5 h-5" />
                </button>
                <button onClick={handleLogout} className="p-2 rounded-full hover:bg-red-500/20 text-white/50 hover:text-red-400 transition" title="Logout">
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
              <input 
                type="text" 
                placeholder="Search precise username..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-4 py-2.5 rounded-full bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-white/50 text-white placeholder-white/50 transition-all`}
              />
            </div>
          </div>
          
          {/* Chat List */}
          <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
            {users.filter(u => {
              const hasRecentChat = userData?.recentChats && userData.recentChats[u.id];
              if (searchTerm.trim() === '') return !!hasRecentChat;
              return u.username?.toLowerCase() === searchTerm.toLowerCase() || u.username?.toLowerCase() === `@${searchTerm.toLowerCase()}`;
            })
            .sort((a, b) => {
              const aTime = userData?.recentChats?.[a.id] || 0;
              const bTime = userData?.recentChats?.[b.id] || 0;
              return bTime - aTime;
            })
            .map(u => (
              <div 
                key={u.id}
                onClick={() => setSelectedUser(u)}
                className={`p-3 rounded-2xl cursor-pointer transition ${selectedUser?.id === u.id ? `${t.glow1} border border-white/10 shadow-sm` : 'hover:bg-white/5 opacity-70'}`}
              >
                <div className="flex gap-3 items-center">
                  <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center relative overflow-visible">
                    <div className="w-full h-full rounded-full overflow-hidden relative">
                      {u.photoURL ? (
                        <img src={u.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-lg font-bold text-white/50 flex items-center justify-center w-full h-full">{u.displayName?.[0]?.toUpperCase() || '?'}</span>
                      )}
                    </div>
                    {isOnline(u) && (
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-[#0f172a] rounded-full z-10" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h3 className="font-medium text-white truncate">{u.displayName}</h3>
                    </div>
                    <p className="text-xs text-white/50 truncate">
                      {getTypingStatus(u) ? (
                        <span className="text-blue-400 italic">{getTypingStatus(u)}</span>
                      ) : (
                        u.username
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Chat Area */}
        <div 
          className={`${!selectedUser ? 'hidden md:flex' : 'flex'} flex-1 flex-col relative z-20 bg-gradient-to-b from-transparent ${t.bgGradient} transition-colors duration-1000`}
          style={currentChatBg ? { backgroundImage: `url(${currentChatBg})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
        >
          {currentChatBg && <div className="absolute inset-0 bg-black/60 z-0"></div>}
          
          {!selectedUser ? (
            <div className="flex-1 flex items-center justify-center text-white/40">
               Select a user to start chatting
            </div>
          ) : (
            <>
              {/* Top Bar */}
              <div className="h-18 px-6 sm:px-8 py-4 flex justify-between items-center border-b border-white/5 relative z-10 backdrop-blur-md bg-white/5">
                <div className="flex items-center gap-3">
                  <button className="md:hidden p-2 -ml-2 rounded-full hover:bg-white/10 text-white/80" onClick={() => setSelectedUser(null)}>
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center overflow-visible relative">
                    <div className="w-full h-full rounded-full overflow-hidden relative">
                      {activeSelectedUser?.photoURL ? (
                        <img src={activeSelectedUser.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-bold text-white flex items-center justify-center w-full h-full">{activeSelectedUser?.displayName?.[0]?.toUpperCase() || '?'}</span>
                      )}
                    </div>
                    {isOnline(activeSelectedUser) && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white/10 rounded-full z-10" />
                    )}
                  </div>
                  <div>
                    <h2 className="font-medium text-white">{activeSelectedUser?.displayName}</h2>
                    <p className="text-xs text-blue-200">
                      {getTypingStatus(activeSelectedUser) ? (
                        <span className="text-blue-300 italic">{getTypingStatus(activeSelectedUser)}</span>
                      ) : (
                        isOnline(activeSelectedUser) ? "В сети" : activeSelectedUser?.username
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 relative">
                  <button onClick={() => setChatMenuOpen(!chatMenuOpen)} className="p-2 rounded-full hover:bg-white/10 text-white/80 transition-colors">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                  {chatMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-48 bg-[#0f172a] border border-white/10 rounded-xl shadow-2xl py-1 z-50">
                      <input 
                        type="file" 
                        accept="image/*"
                        className="hidden" 
                        ref={chatBgInputRef}
                        onChange={handleChatBgUpload}
                      />
                      <button 
                        onClick={() => { chatBgInputRef.current?.click(); }}
                        className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors"
                      >
                        Сменить фон
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Messages Area */}
              <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-4 relative z-10">
                {chatMessages.map((msg) => {
                  const isMe = msg.senderId === user?.uid;
                  const time = msg.createdAt ? new Date(msg.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now';
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%] ${isMe ? 'self-end' : 'self-start'}`}>
                      <div 
                        className={`px-5 py-4 rounded-2xl text-sm leading-relaxed relative ${
                          isMe 
                            ? `${t.bubbleSent} rounded-tr-none` 
                            : 'bg-white/10 backdrop-blur-xl border border-white/10 text-white/95 rounded-tl-none shadow-[0_4px_15px_rgba(0,0,0,0.1)]'
                        }`}
                      >
                        {msg.type === 'image' && msg.url ? (
                          <div className="mt-1 mb-2 cursor-pointer" onClick={() => setViewerImage(msg.url)}>
                            <img src={msg.url} alt="Uploaded" className="rounded-xl max-w-full max-h-64 object-cover hover:opacity-90 transition-opacity" />
                          </div>
                        ) : msg.type === 'file' && msg.url ? (
                          <a href={msg.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-200 hover:text-white underline mt-1 mb-2">
                            <Paperclip className="w-4 h-4" />
                            <span className="truncate">{msg.text}</span>
                          </a>
                        ) : msg.type === 'audio' && msg.url ? (
                          <div className="mt-1 mb-2">
                            <audio controls src={msg.url} className="h-10 max-w-[200px]" />
                          </div>
                        ) : (
                          msg.text
                        )}
                      </div>
                      <span className="text-[11px] text-white/40 mt-1 px-1 font-medium select-none">{time}</span>
                    </div>
                  );
                })}
              </div>

              {/* Input Area */}
              <div className="p-4 sm:p-8 pt-4 relative z-10">
                {showEmoji && (
                  <div className="absolute bottom-[80px] left-4 z-50 shadow-2xl">
                    <EmojiPicker 
                      theme="dark" 
                      onEmojiClick={(emoji) => setInputValue(prev => prev + emoji.emoji)}
                    />
                  </div>
                )}
                
                <form onSubmit={handleSend} className="bg-white/5 backdrop-blur-2xl border border-white/10 p-2 rounded-[28px] flex items-center gap-1">
                  <div className="flex gap-1 pl-2">
                    <button type="button" onClick={() => setShowEmoji(!showEmoji)} className="p-2 hover:bg-white/10 rounded-full text-white/60 transition-colors">
                      <Smile className="w-5 h-5" />
                    </button>
                    
                    <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, true)} />
                    <button type="button" onClick={() => imageInputRef.current?.click()} className="p-2 hover:bg-white/10 rounded-full text-white/60 transition-colors hidden sm:block">
                      <ImageIcon className="w-5 h-5" />
                    </button>
                    
                    <input type="file" ref={fileInputRef} className="hidden" accept="*" onChange={(e) => handleFileUpload(e, false)} />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 hover:bg-white/10 rounded-full text-white/60 transition-colors hidden sm:block">
                      <Paperclip className="w-5 h-5" />
                    </button>
                  </div>
                  
                  {isRecording ? (
                    <div className="flex-1 px-4 py-2 text-sm text-red-400 font-medium flex items-center gap-2 animate-pulse">
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      Recording {formatTime(recordingTime)}...
                    </div>
                  ) : (
                    <textarea 
                      value={inputValue}
                      onChange={(e) => handleTyping(e.target.value)}
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
                  )}
                  
                  <div className="pr-1 flex gap-1 items-center">
                    {!inputValue.trim() && !isRecording ? (
                      <button type="button" onClick={startRecording} className="w-10 h-10 flex items-center justify-center bg-transparent hover:bg-white/10 text-white/60 rounded-full transition-colors">
                        <Mic className="w-5 h-5" />
                      </button>
                    ) : isRecording ? (
                      <button type="button" onClick={stopRecording} className="w-10 h-10 flex items-center justify-center bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-full transition-colors">
                        <Square className="w-4 h-4 fill-current" />
                      </button>
                    ) : (
                      <button type="submit" className={`w-12 h-10 flex items-center justify-center ${t.accentBtn} ${t.accentHover} text-white rounded-2xl transition-colors shadow-lg ${t.accentGlow}`}>
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
