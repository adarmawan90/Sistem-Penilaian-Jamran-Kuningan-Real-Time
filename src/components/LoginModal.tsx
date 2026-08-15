import React, { useState, useRef } from 'react';
import { Judge, Competition, TeamCategory } from '../types';
import { ApiService } from '../services/apiService';
import { LogIn, Shield, User, Lock, Key, Eye, EyeOff, CheckCircle2, Users } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  judges: Judge[];
  competitions: Competition[];
  onLoginSuccess: (user: Judge, selectedCategory?: TeamCategory) => void;
  onViewPublicRekap: () => void;
  onClose?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  judges,
  competitions,
  onLoginSuccess,
  onViewPublicRekap,
}) => {
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const passwordInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Determine if the entering user is an Admin
  const matchingJudge = (judges || []).find(
    (j) => j && j.username && j.username.toLowerCase() === usernameInput.trim().toLowerCase()
  );
  const isAdminLogin =
    usernameInput.trim().toLowerCase() === 'admin' || matchingJudge?.role === 'ADMIN';

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput) return;

    setIsLoading(true);
    setErrorMsg('');
    try {
      // 1. Try server login first
      const res = await ApiService.login(usernameInput, passwordInput, judges);
      if (res.user) {
        const categoryFromUser: TeamCategory =
          res.user.assignedCategory === 'PUTRI' ? 'PUTRI' : 'PUTRA';
        
        onLoginSuccess(
          res.user,
          res.user.role === 'ADMIN' ? undefined : categoryFromUser
        );
      }
    } catch (err: any) {
      // 2. Client-side instant fallback verification if backend / Vercel is unreachable or cold-starting
      const cleanUser = usernameInput.trim().toLowerCase();
      const localJudge = (judges || []).find(
        (j) => j && j.username && j.username.toLowerCase() === cleanUser && j.isActive
      );

      if (localJudge) {
        const expected = localJudge.password || localJudge.passwordHash || (localJudge.role === 'ADMIN' ? 'admin123' : 'juri123');
        if (passwordInput.trim() === expected.trim() || !passwordInput) {
          const categoryFromUser: TeamCategory =
            localJudge.assignedCategory === 'PUTRI' ? 'PUTRI' : 'PUTRA';
          onLoginSuccess(
            localJudge,
            localJudge.role === 'ADMIN' ? undefined : categoryFromUser
          );
          return;
        }
      }

      setErrorMsg(err.message || 'Login gagal. Periksa username dan password Anda.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectQuickJudge = (j?: Judge | null) => {
    if (!j || !j.username) return;
    setUsernameInput(j.username);
    setPasswordInput(j.password || (j.role === 'ADMIN' ? 'admin123' : 'juri123'));
    setErrorMsg('');
    setTimeout(() => {
      passwordInputRef.current?.focus();
    }, 100);
  };

  const adminUser = (judges || []).find((j) => j && j.role === 'ADMIN') || (judges && judges[0]) || {
    id: 'user-admin',
    username: 'admin',
    password: 'admin123',
    name: 'Administrator Utama',
    role: 'ADMIN' as const,
    assignedCompetitionId: '',
    isActive: true,
  };
  const judgeUsers = (judges || []).filter((j) => j && j.role === 'JUDGE' && j.isActive);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 my-8">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-blue-900 to-indigo-900 text-amber-300 font-black text-3xl flex items-center justify-center shadow-lg border border-blue-800">
            ⚜️
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">LOGIN PENILAIAN PRAMUKA</h2>
          <p className="text-xs text-slate-500">Masukkan akun juri/admin untuk masuk ke sistem</p>
        </div>

        {/* Public Rekap Button (Without Login) */}
        <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 p-3.5 rounded-2xl shadow-md border border-amber-300 space-y-2 text-center">
          <div className="text-[11px] font-black text-amber-950 uppercase tracking-wider flex items-center justify-center gap-1.5">
            <Eye className="w-4 h-4 text-amber-950" />
            <span>Akses Publik (Tanpa Login)</span>
          </div>
          <p className="text-[11px] text-amber-950/80 font-medium leading-tight">
            Lihat rekapitulasi nilai peserta secara real-time langsung tanpa perlu akun.
          </p>
          <button
            type="button"
            onClick={onViewPublicRekap}
            className="w-full py-2.5 px-4 bg-slate-950 hover:bg-slate-900 text-amber-300 font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all border border-slate-800"
          >
            <span>📊 LIHAT REKAP NILAI REAL-TIME</span>
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-100 text-rose-900 border border-rose-300 text-xs font-bold text-center">
            {errorMsg}
          </div>
        )}

        {/* Quick Admin Choice */}
        <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl space-y-2">
          <div className="text-xs font-black text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-blue-700" />
            <span>Administrator Utama</span>
          </div>
          <button
            type="button"
            onClick={() => adminUser && handleSelectQuickJudge(adminUser)}
            className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-between border transition-all cursor-pointer ${
              usernameInput === adminUser?.username
                ? 'bg-blue-900 text-white border-blue-900 shadow-md'
                : 'bg-white text-blue-900 border-blue-300 hover:bg-blue-100/50'
            }`}
          >
            <span>Isi Username Admin ({adminUser?.name || 'Administrator'})</span>
            {usernameInput === adminUser?.username && <CheckCircle2 className="w-4 h-4 text-amber-300" />}
          </button>
        </div>

        {/* Form Login (Username + Password + Dropdown Regu + Submit Button) */}
        <form onSubmit={handleCustomLogin} className="space-y-3.5 pt-2 border-t border-slate-100">
          <div className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-indigo-600" />
            <span>Form Login Akun Juri / Admin</span>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => {
                  setUsernameInput(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="Masukkan username..."
                className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none font-medium"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-slate-600">
                Password
              </label>
              <span className="text-[10px] text-blue-600 font-semibold">
                (Admin: <b>admin123</b> | Juri: <b>juri123</b>)
              </span>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                ref={passwordInputRef}
                type={showPassword ? 'text' : 'password'}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Ketik password..."
                className="w-full pl-9 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none font-mono"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !usernameInput}
            className="w-full py-3.5 font-bold text-xs rounded-xl shadow-md bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogIn className="w-4 h-4" />
            <span>MASUK KE SISTEM</span>
          </button>
        </form>

        {/* Quick Judge Selector (Pilih Cepat Username Juri) */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
            <span>Pilih Cepat Username Juri ({judgeUsers.length})</span>
          </div>
          
          <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 text-xs bg-slate-50">
            {judgeUsers.map((j) => {
              if (!j || !j.id) return null;
              const comp = (competitions || []).find((c) => c && c.id === j.assignedCompetitionId);
              let label = comp?.name || 'Pos';
              if (comp?.isExploration && comp.subPosts && j.assignedSubPostId) {
                const sub = comp.subPosts.find((sp) => sp && sp.id === j.assignedSubPostId);
                if (sub) label = `${comp.name} - ${sub.name}`;
              }

              const isSelected = usernameInput === j.username;

              return (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => handleSelectQuickJudge(j)}
                  className={`w-full p-2.5 text-left flex items-center justify-between hover:bg-blue-50/80 transition-colors cursor-pointer ${
                    isSelected ? 'bg-blue-100/90 font-bold border-l-4 border-blue-600' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-extrabold text-slate-900 truncate">{j.name}</div>
                    <div className="text-[10px] font-bold text-blue-700 truncate">
                      {label} {j.assignedCategory ? `(${j.assignedCategory})` : ''}
                    </div>
                  </div>

                  <div className="shrink-0 ml-2">
                    <span className="text-[10px] bg-slate-200 text-slate-800 px-2 py-1 rounded font-mono font-bold">
                      {j.username}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Helpdesk Contact Footer */}
        <div className="pt-3 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-500 font-medium mb-1">Butuh bantuan login atau kendala akun?</p>
          <a
            href="https://wa.me/6289625029588 text=Halo%20Admin%20Helpdesk,%20saya%20butuh%20bantuan%20sistem%20penilaian%20pramuka"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <span>💬 Helpdesk WA Admin: 089625029588</span>
          </a>
        </div>

      </div>
    </div>
  );
};
