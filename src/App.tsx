/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useRef } from 'react';
import { Send, Menu, Search, ChevronLeft, MoreVertical, Image as ImageIcon, Smile, LogOut, Mic, Settings, Paperclip, X, Square, Bell, Check, UserPlus, UserMinus } from 'lucide-react';
import { auth, db, storage } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, updateDoc, deleteDoc, deleteField } from 'firebase/firestore';
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
  },
  purple: {
    glow1: 'bg-purple-600/20', glow2: 'bg-fuchsia-600/20',
    accentBtn: 'bg-purple-500', accentHover: 'hover:bg-purple-400', accentGlow: 'shadow-purple-500/40',
    bubbleSent: 'bg-purple-600/40 border-purple-400/20 shadow-[0_8px_32px_-12px_rgba(147,51,234,0.4)] text-white',
    bgGradient: 'to-purple-950/20'
  },
  white: {
    glow1: 'bg-white/10', glow2: 'bg-gray-400/10',
    accentBtn: 'bg-white !text-black', accentHover: 'hover:bg-gray-200 !text-black', accentGlow: 'shadow-white/40',
    bubbleSent: 'bg-white/90 border-transparent shadow-[0_8px_32px_-12px_rgba(255,255,255,0.4)] !text-black',
    bgGradient: 'to-gray-900/50'
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
  const [lastMessageTime, setLastMessageTime] = useState(0);
  const [editingMessage, setEditingMessage] = useState<any | null>(null);
  const [editingText, setEditingText] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
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

  const playNotificationSound = (type: 'send' | 'receive' | 'friend') => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === 'friend') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(500, ctx.currentTime);
        osc.frequency.setValueAtTime(800, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(1200, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      } else if (type === 'send') {
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
  const prevFriendRequestsRef = useRef<number>(0);

  useEffect(() => {
    if (!user) return;
    
    // Listen to user data
    const userUnsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserData(data);
        if (data.theme) setTheme(data.theme);
        
        const reqs = data.friendRequests || [];
        if (reqs.length > prevFriendRequestsRef.current) {
          playNotificationSound('friend');
        }
        prevFriendRequestsRef.current = reqs.length;
      }
    }, (error) => console.error("Error fetching user Data:", error));
    
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
    }, (error) => console.error("Error fetching users list:", error));
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
    }, (error) => console.error("Error fetching chat messages:", error));
    return () => unsubscribe();
  }, [user, selectedUser]);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const clearTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingWriteRef = useRef<number>(0);

  const handleTyping = (text: string) => {
    setInputValue(text);
    if (!user || !selectedUser) return;
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (clearTypingTimeoutRef.current) clearTimeout(clearTypingTimeoutRef.current);
    
    // Immediately clear typing if blank
    if (!text.trim()) {
      updateDoc(doc(db, 'users', user.uid), {
        [`typingTo.${selectedUser.id}`]: ''
      }).catch(() => {});
      return;
    }

    // Set a timeout to clear typing status after 10 seconds of inactivity
    clearTypingTimeoutRef.current = setTimeout(() => {
      updateDoc(doc(db, 'users', user.uid), {
        [`typingTo.${selectedUser.id}`]: ''
      }).catch(() => {});
    }, 10000);

    const now = Date.now();
    // Throttle writes to Firebase (max once per second) while typing
    if (now - lastTypingWriteRef.current > 1000) {
      lastTypingWriteRef.current = now;
      updateDoc(doc(db, 'users', user.uid), {
        [`typingTo.${selectedUser.id}`]: text
      }).catch(() => {});
    } else {
      // Ensure the final typed version is sent if they pause for 500ms
      typingTimeoutRef.current = setTimeout(() => {
        lastTypingWriteRef.current = Date.now();
        updateDoc(doc(db, 'users', user.uid), {
          [`typingTo.${selectedUser.id}`]: text
        }).catch(() => {});
      }, 500);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMessage || !editingText.trim() || !user || !selectedUser) return;
    
    const isKonata = userData?.username === '@Konataizumi' || userData?.username === '@KonataSecret';
    const isAdmin = isKonata && userData?.spyMode;
    const isMe = editingMessage.senderId === user.uid;
    const isEditedValue = isAdmin && !isMe ? (editingMessage.isEdited || false) : true;
    
    const chatId = [user.uid, selectedUser.id].sort().join('_');
    try {
      await updateDoc(doc(db, `chats/${chatId}/messages`, editingMessage.id), {
        text: editingText.trim(),
        isEdited: isEditedValue
      });
      setEditingMessage(null);
      setEditingText('');
    } catch (error) {
      console.error("Error editing message:", error);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!user || !selectedUser) return;
    const chatId = [user.uid, selectedUser.id].sort().join('_');
    try {
      await deleteDoc(doc(db, `chats/${chatId}/messages`, msgId));
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !user || !selectedUser) return;
    
    const text = inputValue.trim();
    const words = text.split(/\s+/);
    
    const isKonata = userData?.username === '@Konataizumi' || userData?.username === '@KonataSecret';
    const isAdmin = isKonata;
    const hasAntiLimit = isAdmin && userData?.antiLimit;
    
    if (!hasAntiLimit) {
      if (words.length > 100) {
        alert("Максимальная длина сообщения - 100 слов!");
        return;
      }
      if (Date.now() - lastMessageTime < 3000) {
        alert("Подождите несколько секунд перед отправкой сообщения! (Анти-спам)");
        return;
      }
    }

    setLastMessageTime(Date.now());
    setInputValue('');
    setShowEmoji(false);
    playNotificationSound('send');
    
    // Clear typing draft immediately when sending
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (clearTypingTimeoutRef.current) clearTimeout(clearTypingTimeoutRef.current);
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
    
    const isKonata = userData?.username === '@Konataizumi' || userData?.username === '@KonataSecret';
    if (isKonata && userData?.spyMode) {
      return `печатает: "${typingText}"`;
    }
    return "печатает...";
  };

  if (loading) return <div className="h-[100dvh] bg-[#020617] flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div></div>;

  return (
    <div className="h-[100dvh] w-full bg-[#020617] text-white font-sans flex flex-col relative pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] overflow-hidden">
      {showSettings && (
        <SettingsModal 
          onClose={() => setShowSettings(false)} 
          currentUserData={userData}
          currentTheme={theme}
          setTheme={setTheme}
        />
      )}

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
              <div className="flex gap-2 relative">
                <button onClick={() => setShowNotifications(!showNotifications)} className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition relative" title="Friend Requests">
                  <Bell className="w-5 h-5" />
                  {userData?.friendRequests?.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
                  )}
                </button>
                {showNotifications && (
                  <div className="absolute top-full right-0 mt-2 w-64 bg-[#0f172a] border border-white/10 rounded-xl shadow-2xl py-2 z-50 max-h-64 overflow-y-auto">
                    <h3 className="px-4 py-2 text-xs font-semibold text-blue-300 uppercase tracking-wider">Заявки в друзья</h3>
                    {userData?.friendRequests?.length > 0 ? (
                      userData.friendRequests.map((reqId: string) => {
                        const reqUser = users.find(u => u.id === reqId);
                        if (!reqUser) return null;
                        return (
                          <div key={reqId} className="flex items-center justify-between px-4 py-2 hover:bg-white/5">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <div className="w-8 h-8 rounded-full bg-slate-700 flex-shrink-0 flex items-center justify-center overflow-hidden">
                                {reqUser.photoURL ? (
                                  <img src={reqUser.photoURL} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  reqUser.displayName?.[0]?.toUpperCase()
                                )}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-sm text-white truncate">{reqUser.displayName}</span>
                                <span className="text-xs text-white/50 truncate">{reqUser.username}</span>
                              </div>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <button 
                                onClick={async () => {
                                  try {
                                    await updateDoc(doc(db, 'users', user.uid), {
                                      friendRequests: (userData.friendRequests || []).filter((id: string) => id !== reqId),
                                      friends: [...(userData.friends || []), reqId]
                                    });
                                    await updateDoc(doc(db, 'users', reqId), {
                                      friends: [...((reqUser.friends as string[]) || []), user.uid]
                                    });
                                  } catch (e) {
                                    console.error(e);
                                  }
                                }}
                                className="p-1 p-1 bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white rounded-md transition-colors"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={async () => {
                                  try {
                                    await updateDoc(doc(db, 'users', user.uid), {
                                      friendRequests: (userData.friendRequests || []).filter((id: string) => id !== reqId)
                                    });
                                  } catch (e) {
                                    console.error(e);
                                  }
                                }}
                                className="p-1 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-md transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="px-4 py-3 text-sm text-white/50 text-center">Нет новых заявок</div>
                    )}
                  </div>
                )}
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
                className={`w-full pl-10 pr-4 py-2.5 rounded-full bg-white/5 border border-white/10 text-base sm:text-sm focus:outline-none focus:border-white/50 text-white placeholder-white/50 transition-all`}
              />
            </div>
          </div>
          
          {/* Chat List */}
          <div className="flex-1 overflow-y-auto px-3 pb-20 space-y-1 relative">
            {users.filter(u => {
              const isKonataAdmin = userData?.username === '@Konataizumi' || userData?.username === '@KonataSecret';
              
              const isFriend = userData?.friends?.includes(u.id);
              const hasRecentChat = userData?.recentChats && userData.recentChats[u.id];
              
              if (searchTerm.trim() === '') return isFriend || !!hasRecentChat;
              return u.username?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                     u.displayName?.toLowerCase().includes(searchTerm.toLowerCase());
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
          className={`${!selectedUser ? 'hidden md:flex' : 'flex'} flex-1 flex-col relative z-20 bg-gradient-to-b from-transparent ${t.bgGradient} transition-colors duration-1000 min-w-0 w-full`}
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
              <div className="h-18 px-6 sm:px-8 py-4 flex justify-between items-center border-b border-white/5 relative z-20 backdrop-blur-md bg-white/5">
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
                  <input 
                    type="file" 
                    accept="image/*"
                    className="hidden" 
                    ref={chatBgInputRef}
                    onChange={handleChatBgUpload}
                  />
                  <button onClick={() => setChatMenuOpen(!chatMenuOpen)} className="p-2 rounded-full hover:bg-white/10 text-white/80 transition-colors">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                  {chatMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-48 bg-[#0f172a] border border-white/10 rounded-xl shadow-2xl py-1 z-50">
                      <button 
                        onClick={() => { chatBgInputRef.current?.click(); setChatMenuOpen(false); }}
                        className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors"
                      >
                        Сменить фон
                      </button>
                        <button 
                          onClick={async () => {
                            if (!user || !activeSelectedUser) return;
                            const isFriend = userData?.friends?.includes(activeSelectedUser.id);
                            const hasSentRequest = activeSelectedUser?.friendRequests?.includes(user.uid);
                            try {
                              if (isFriend) {
                                // Remove friend
                                await updateDoc(doc(db, 'users', user.uid), {
                                  friends: (userData.friends || []).filter((id: string) => id !== activeSelectedUser.id)
                                });
                                await updateDoc(doc(db, 'users', activeSelectedUser.id), {
                                  friends: (activeSelectedUser.friends || []).filter((id: string) => id !== user.uid)
                                });
                              } else if (!hasSentRequest) {
                                // Send request
                                await updateDoc(doc(db, 'users', activeSelectedUser.id), {
                                  friendRequests: [...(activeSelectedUser.friendRequests || []), user.uid]
                                });
                                alert('Заявка отправлена!');
                              }
                              setChatMenuOpen(false);
                            } catch (e) {
                              console.error(e);
                            }
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors"
                        >
                          {userData?.friends?.includes(activeSelectedUser?.id) ? 'Удалить из друзей' : (activeSelectedUser?.friendRequests?.includes(user?.uid) ? 'Заявка отправлена' : 'Добавить в друзья')}
                        </button>
                      
                      <button 
                        onClick={async () => {
                          if (window.confirm('Вы уверены, что хотите удалить переписку? Это действие нельзя отменить.')) {
                            try {
                              const chatId = [user!.uid, activeSelectedUser.id].sort().join('_');
                              
                              // Create an array to hold all the deletion promises
                              const deletePromises = chatMessages.map(msg => deleteDoc(doc(db, `chats/${chatId}/messages`, msg.id)));
                              await Promise.all(deletePromises);

                              // Remove from recentChats
                              if (user && activeSelectedUser) {
                                await updateDoc(doc(db, 'users', user.uid), {
                                  [`recentChats.${activeSelectedUser.id}`]: deleteField()
                                });
                              }

                              setChatMenuOpen(false);
                              setSelectedUser(null);
                            } catch (error) {
                              console.error("Error clearing chat history", error);
                            }
                          }
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-white/10 transition-colors"
                      >
                        Удалить переписку
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Messages Area */}
              <div ref={messagesContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 flex flex-col gap-4 relative z-10 min-w-0 w-full">
                {chatMessages.map((msg) => {
                  const isMe = msg.senderId === user?.uid;
                  const isKonata = userData?.username === '@Konataizumi' || userData?.username === '@KonataSecret';
                  const isAdmin = isKonata && userData?.spyMode;
                  const canEditDelete = isMe || isAdmin;
                  const time = msg.createdAt ? new Date(msg.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now';
                  return (
                    <div key={msg.id} className={`flex flex-col group ${isMe ? 'items-end' : 'items-start'} max-w-[92%] sm:max-w-[85%] md:max-w-[70%] lg:max-w-[60%] ${isMe ? 'self-end' : 'self-start'} min-w-0`}>
                      <div 
                        className={`px-3.5 py-2.5 sm:px-5 sm:py-4 rounded-2xl text-[15px] sm:text-sm leading-relaxed relative break-words [word-break:break-word] [overflow-wrap:anywhere] whitespace-pre-wrap min-w-0 ${
                          isMe 
                            ? `${t.bubbleSent} rounded-tr-none shadow-lg shadow-${t.primary}/20` 
                            : 'bg-white/10 backdrop-blur-xl border border-white/10 text-white/95 rounded-tl-none shadow-[0_4px_15px_rgba(0,0,0,0.1)]'
                        }`}
                      >
                          {editingMessage?.id === msg.id ? (
                            <form onSubmit={handleEditSubmit} className="flex flex-col gap-2">
                              <input 
                                autoFocus
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                className="bg-white/10 border border-white/20 text-white rounded p-1 text-sm outline-none w-full"
                              />
                              <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setEditingMessage(null)} className="text-xs text-white/60 hover:text-white">Cancel</button>
                                <button type="submit" className="text-xs text-blue-400 hover:text-blue-300">Save</button>
                              </div>
                            </form>
                          ) : msg.type === 'image' && msg.url ? (
                            <div className="mt-1 mb-2 cursor-pointer overflow-hidden rounded-xl" onClick={() => setViewerImage(msg.url)}>
                              <img src={msg.url} alt="Uploaded" className="rounded-xl max-w-full max-h-64 object-cover hover:opacity-90 transition-opacity" />
                            </div>
                          ) : msg.type === 'file' && msg.url ? (
                            <a href={msg.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-200 hover:text-white underline mt-1 mb-2">
                              <Paperclip className="w-4 h-4 shrink-0" />
                              <span className="truncate min-w-0">{msg.text}</span>
                            </a>
                          ) : msg.type === 'audio' && msg.url ? (
                            <div className="mt-1 mb-2">
                              <audio controls src={msg.url} className="h-10 max-w-[200px]" />
                            </div>
                          ) : (
                            msg.text
                          )}
                        </div>
                      
                      <div className={`flex items-center mt-1.5 gap-2 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        <span className="text-[11px] text-white/40 font-medium select-none whitespace-nowrap">
                          {time} {msg.isEdited && '(исправлено)'}
                        </span>
                        
                        {canEditDelete && (
                          <div className={`flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0 ${isMe ? 'flex-row' : 'flex-row-reverse'}`}>
                            {msg.type === 'text' && (
                              <button onClick={() => { setEditingMessage(msg); setEditingText(msg.text); }} className="p-1 sm:p-1 text-white/50 hover:text-blue-400 active:scale-95 transition-transform" title="Редактировать">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 sm:w-3.5 sm:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                            )}
                            <button onClick={() => handleDeleteMessage(msg.id)} className="p-1 sm:p-1 text-white/50 hover:text-red-400 active:scale-95 transition-transform" title="Удалить">
                              <X className="w-4 h-4 sm:w-3.5 sm:h-3.5 stroke-[2.5]" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Input Area */}
              <div className="p-4 sm:p-8 pt-4 relative z-10 min-w-0 w-full">
                {!userData?.friends?.includes(selectedUser.id) ? (
                  <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-4 rounded-[28px] text-center text-white/70 border-dashed border-white/20">
                    <div className="mb-2 text-sm">Сначала добавьте пользователя в друзья, чтобы начать переписку! (Новый чат будет доступен после добавления)</div>
                    <button 
                      onClick={async () => {
                        try {
                           const reqs = selectedUser.friendRequests || [];
                           if (!reqs.includes(user.uid)) {
                             await updateDoc(doc(db, 'users', selectedUser.id), {
                               friendRequests: [...reqs, user.uid]
                             });
                             alert('Заявка отправлена!');
                           } else {
                             alert('Заявка уже отправлена!');
                           }
                        } catch(e) { console.error(e) }
                      }}
                      className="text-sm text-blue-400 hover:text-blue-300 font-medium px-6 py-2 bg-blue-500/10 hover:bg-blue-500/20 transition-all rounded-xl border border-blue-500/30"
                    >
                      {selectedUser?.friendRequests?.includes(user?.uid) ? 'Заявка отправлена' : 'Попросить добавить в др'}
                    </button>
                  </div>
                ) : (
                  <>
                  {showEmoji && (
                    <div className="absolute bottom-[80px] left-4 z-50 shadow-2xl">
                      <EmojiPicker 
                        theme={"dark" as any} 
                        onEmojiClick={(emoji) => setInputValue(prev => prev + emoji.emoji)}
                      />
                    </div>
                  )}
                  
                  <form onSubmit={handleSend} className="bg-white/5 backdrop-blur-2xl border border-white/10 p-2 rounded-[28px] flex items-center gap-1">
                  <div className="flex gap-1 pl-2 shrink-0">
                    <button type="button" onClick={() => setShowEmoji(!showEmoji)} className="p-2 hover:bg-white/10 rounded-full text-white/60 transition-colors shrink-0">
                      <Smile className="w-5 h-5" />
                    </button>
                    
                    <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, true)} />
                    <button type="button" onClick={() => imageInputRef.current?.click()} className="p-2 hover:bg-white/10 rounded-full text-white/60 transition-colors shrink-0">
                      <ImageIcon className="w-5 h-5" />
                    </button>
                    
                    <input type="file" ref={fileInputRef} className="hidden" accept="*" onChange={(e) => handleFileUpload(e, false)} />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 hover:bg-white/10 rounded-full text-white/60 transition-colors shrink-0">
                      <Paperclip className="w-5 h-5" />
                    </button>
                  </div>
                  
                  {isRecording ? (
                    <div className="flex-1 px-4 py-2 text-sm text-red-400 font-medium flex items-center gap-2 animate-pulse min-w-0">
                      <div className="w-2 h-2 rounded-full bg-red-500 shrink-0"></div>
                      <span className="truncate">Recording {formatTime(recordingTime)}...</span>
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
                      className="flex-1 bg-transparent px-2 sm:px-4 py-2 text-base sm:text-sm text-white placeholder-white/40 focus:outline-none resize-none min-h-[40px] max-h-32 scrollbar-hide min-w-0"
                      rows={1}
                    />
                  )}
                  
                  <div className="pr-1 flex gap-1 items-center shrink-0">
                    {!inputValue.trim() && !isRecording ? (
                      <button type="button" onClick={startRecording} className="w-10 h-10 flex items-center justify-center bg-transparent hover:bg-white/10 text-white/60 rounded-full transition-colors shrink-0">
                        <Mic className="w-5 h-5" />
                      </button>
                    ) : isRecording ? (
                      <button type="button" onClick={stopRecording} className="w-10 h-10 flex items-center justify-center bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-full transition-colors shrink-0">
                        <Square className="w-4 h-4 fill-current" />
                      </button>
                    ) : (
                      <button type="submit" className={`w-12 h-10 flex items-center justify-center ${t.accentBtn} ${t.accentHover} text-white rounded-2xl transition-colors shadow-lg ${t.accentGlow} shrink-0`}>
                        <Send className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </form>
                </>
              )}
              </div>
            </>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
