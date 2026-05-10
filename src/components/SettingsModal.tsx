import React, { useState, useRef } from 'react';
import { X, Save, Palette, User as UserIcon, Upload } from 'lucide-react';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../lib/firebase';

interface SettingsModalProps {
  onClose: () => void;
  currentUserData: any;
  currentTheme: string;
  setTheme: (theme: string) => void;
}

export function SettingsModal({ onClose, currentUserData, currentTheme, setTheme }: SettingsModalProps) {
  const [displayName, setDisplayName] = useState(currentUserData?.displayName || auth.currentUser?.displayName || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUserData?.photoURL || auth.currentUser?.photoURL || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [spyMode, setSpyMode] = useState(currentUserData?.spyMode || false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAvatarFile(e.target.files[0]);
      setAvatarUrl(URL.createObjectURL(e.target.files[0]));
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setAvatarFile(e.dataTransfer.files[0]);
      setAvatarUrl(URL.createObjectURL(e.dataTransfer.files[0]));
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      let finalAvatarUrl = avatarUrl;
      
      if (avatarFile) {
        // Compress image to base64 to bypass storage permissions
        const compressed = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(avatarFile);
          reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
              const canvas = document.createElement('canvas');
              let { width, height } = img;
              if (width > 800) { height *= 800 / width; width = 800; }
              canvas.width = width; canvas.height = height;
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(img, 0, 0, width, height);
              resolve(canvas.toDataURL('image/jpeg', 0.6));
            };
            img.onerror = reject;
          };
          reader.onerror = reject;
        });
        finalAvatarUrl = compressed;
      }

      // Update Auth Profile
      if (finalAvatarUrl && finalAvatarUrl.length < 500) {
        await updateProfile(auth.currentUser, {
          displayName: displayName,
          photoURL: finalAvatarUrl
        });
      } else {
        await updateProfile(auth.currentUser, {
          displayName: displayName
        });
      }
      // Update Firestore Profile
      const baseUpdate: any = {
        displayName: displayName,
        photoURL: finalAvatarUrl,
        theme: currentTheme,
      };
      
      if (currentUserData?.username === '@Konataizumi') {
        baseUpdate.spyMode = spyMode;
      }

      await updateDoc(doc(db, 'users', auth.currentUser.uid), baseUpdate);
      
      onClose();
    } catch (e) {
      console.error(e);
      alert('Error saving settings');
    } finally {
      setLoading(false);
    }
  };

  const themes = [
    { id: 'blue', color: 'bg-blue-500', name: 'Синий (iOS)' },
    { id: 'red', color: 'bg-red-500', name: 'Красный' },
    { id: 'green', color: 'bg-green-500', name: 'Зеленый' },
    { id: 'orange', color: 'bg-orange-500', name: 'Оранжевый' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#0f172a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
          <h2 className="text-xl font-semibold text-white">Настройки</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-white/70 transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Profile Section */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-blue-300 uppercase tracking-wider flex items-center gap-2">
              <UserIcon className="w-4 h-4" /> Профиль
            </h3>
            
            <div>
              <label className="block text-xs text-white/50 mb-1 ml-1">Имя (Display Name)</label>
              <input 
                type="text" 
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500/50"
              />
            </div>
            
            <div>
              <label className="block text-xs text-white/50 mb-2 ml-1">Аватар</label>
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              <div 
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="w-24 h-24 rounded-full mx-auto border-2 border-dashed border-white/30 hover:border-blue-400 bg-white/5 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all relative group"
              >
                {avatarUrl ? (
                  <>
                    <img src={avatarUrl} alt="Preview" className="w-full h-full object-cover group-hover:opacity-50 transition-opacity" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Upload className="w-6 h-6 text-white mb-1" />
                    </div>
                  </>
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-white/50 mb-1" />
                    <span className="text-[10px] text-white/50">Загрузить</span>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Theme Section */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-blue-300 uppercase tracking-wider flex items-center gap-2">
              <Palette className="w-4 h-4" /> Тема
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {themes.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
                    currentTheme === t.id 
                      ? 'border-white/50 bg-white/10' 
                      : 'border-white/10 hover:bg-white/5'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full ${t.color}`}></div>
                  <span className="text-sm text-white">{t.name}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Admin Section */}
          {currentUserData?.username === '@Konataizumi' && (
            <section className="space-y-4">
              <h3 className="text-sm font-medium text-red-400 uppercase tracking-wider flex items-center gap-2">
                Режим администратора
              </h3>
              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={spyMode}
                  onChange={(e) => setSpyMode(e.target.checked)}
                  className="w-5 h-5 accent-red-500 rounded bg-white/10 border-white/20"
                />
                <span className="text-sm text-white/80">Видеть текст который пишут люди (Spy Mode)</span>
              </label>
            </section>
          )}
        </div>

        <div className="p-6 border-t border-white/10 bg-black/20">
          <button 
            onClick={handleSave}
            disabled={loading}
            className="w-full py-3 bg-blue-500 hover:bg-blue-400 text-white rounded-xl font-medium transition-all shadow-lg flex justify-center items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Сохранение...' : 'Сохранить настройки'}
          </button>
        </div>
      </div>
    </div>
  );
}
