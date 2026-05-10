import React, { useState } from 'react';
import { auth, db } from '../lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { ChevronRight } from 'lucide-react';

interface AuthProps {
  onSuccess: () => void;
}

export function Auth({ onSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        // Handle Login (using username as email)
        const fakeEmail = `${username.replace('@', '')}@konata.local`;
        await signInWithEmailAndPassword(auth, fakeEmail, password);
        onSuccess();
      } else {
        if (step === 1) {
          // Move to step 2 for username
          setStep(2);
          setLoading(false);
          return;
        } else {
          // Register user
          const formattedUsername = username.startsWith('@') ? username : `@${username}`;
          
          // Check if username is already taken via createUser (Firebase Auth will return email-already-in-use error)

          const fakeEmail = `${formattedUsername.replace('@', '')}@konata.local`;
          
          const userCredential = await createUserWithEmailAndPassword(auth, fakeEmail, password);
          
          // Update profile display name
          await updateProfile(userCredential.user, {
            displayName: displayName
          });

          // Save username and profile to Firestore
          await setDoc(doc(db, 'users', userCredential.user.uid), {
            username: formattedUsername,
            displayName: displayName,
            fakeEmail: fakeEmail,
            createdAt: new Date().toISOString()
          });
          onSuccess();
        }
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/configuration-not-found' || err.code === 'auth/operation-not-allowed') {
         setError('Ошибка: В Firebase Console (Authentication -> Sign-in methods) не включен провайдер "Email/Password". Пожалуйста, включите его!');
      } else if (err.code === 'auth/invalid-credential') {
         setError('Неверный юзернейм или пароль.');
      } else if (err.code === 'auth/email-already-in-use') {
         setError('Этот юзернейм уже занят. Пожалуйста, выберите другой.');
      } else {
         setError(err.message || 'Authentication error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center relative z-20">
      <div className="w-full max-w-sm p-8 bg-white/10 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-blue-500 to-cyan-400 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
            <span className="font-bold text-3xl text-white">K</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {isLogin ? 'Вход в систему' : (step === 1 ? 'Создать аккаунт' : 'Выберите юзернейм')}
          </h2>
          <p className="text-sm text-blue-200/70 mt-2">
            {isLogin ? 'Введите свой юзернейм и пароль' : 'Присоединяйтесь к KonataChat'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-200 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && step === 1 && (
            <>
              <div>
                <label className="block text-xs font-semibold text-blue-300 uppercase tracking-wider mb-1.5 ml-1">Имя (Display Name)</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-base sm:text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                  placeholder="Как к вам обращаться?"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-blue-300 uppercase tracking-wider mb-1.5 ml-1">Пароль (Password)</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-base sm:text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                  placeholder="Минимум 6 символов"
                  required
                  minLength={6}
                />
              </div>
            </>
          )}

          {(!isLogin && step === 2) && (
            <div>
              <label className="block text-xs font-semibold text-blue-300 uppercase tracking-wider mb-1.5 ml-1">Юзернейм (Для поиска, например @konata)</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-base sm:text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                placeholder="@username"
                required
                minLength={3}
              />
            </div>
          )}

          {isLogin && (
            <>
              <div>
                <label className="block text-xs font-semibold text-blue-300 uppercase tracking-wider mb-1.5 ml-1">Юзернейм (Username)</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-base sm:text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                  placeholder="@username или без @"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-blue-300 uppercase tracking-wider mb-1.5 ml-1">Пароль (Password)</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-base sm:text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                  placeholder="Введите пароль"
                  required
                  minLength={6}
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-2 bg-blue-500 hover:bg-blue-400 text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-500/20 flex justify-center items-center gap-2 group disabled:opacity-50"
          >
            {loading ? 'Обработка...' : (
              <>
                {isLogin ? 'Войти' : (step === 1 ? 'Дальше' : 'Завершить регистрацию')}
                {!isLogin && step === 1 && <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          {isLogin ? (
            <button type="button" onClick={() => { setIsLogin(false); setStep(1); setError(''); }} className="text-blue-300 hover:text-white transition-colors">
              Нет аккаунта? Зарегистрироваться
            </button>
          ) : (
            <button type="button" onClick={() => { setIsLogin(true); setError(''); }} className="text-blue-300 hover:text-white transition-colors">
              Уже есть аккаунт? Войти
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
