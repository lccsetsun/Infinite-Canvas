import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lock,
  Mail, 
  Eye,
  EyeOff,
  ArrowRight,
  Loader2
} from 'lucide-react';

interface LoginPageProps {
  onLogin: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('admin');
  const [password, setPassword] = useState('888888');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsLoading(false);
    onLogin();
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-[#020617]">
      {/* --- Immersive Background --- */}
      <div className="absolute inset-0 z-0">
        {/* Animated Mesh Gradients */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/20 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-500/10 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-purple-500/15 blur-[100px] animate-pulse" style={{ animationDelay: '4s' }} />
        
        {/* Subtle Grid Pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]" 
          style={{ 
            backgroundImage: `radial-gradient(#ffffff 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }} 
        />
      </div>

      {/* Floating Particles */}
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-white/20 rounded-full z-0"
          initial={{ 
            x: Math.random() * window.innerWidth, 
            y: Math.random() * window.innerHeight 
          }}
          animate={{
            y: [null, Math.random() * -100 - 50],
            opacity: [0, 1, 0]
          }}
          transition={{
            duration: Math.random() * 5 + 5,
            repeat: Infinity,
            ease: "linear",
            delay: Math.random() * 5
          }}
        />
      ))}

      {/* --- Main Content --- */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 w-full max-w-[400px] px-6"
      >
        {/* Logo Section */}
        <div className="flex flex-col items-center mb-8 text-center">
          <h1 className="text-4xl font-black mb-3 tracking-[0.15em] uppercase italic bg-clip-text text-transparent bg-[linear-gradient(to_right,#6366f1,#a855f7,#ec4899,#a855f7,#6366f1)] bg-[length:200%_auto] animate-text-shimmer pointer-events-none">
            AI CANVAS
          </h1>
          <p className="text-slate-500 text-xs font-medium tracking-wide">
            极致效率的 AI 工作流搭建平台
          </p>
        </div>

        {/* Login Card */}
        <div className="relative group">
          {/* Card Glow Effect */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/20 to-purple-600/20 rounded-[2.5rem] blur-2xl transition duration-500"></div>
          
          <div className="relative bg-[#0f172a]/60 backdrop-blur-3xl border border-white/5 rounded-[2rem] p-8 shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Account Field */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <motion.label 
                    animate={{
                      scale: focusedField === 'email' ? 1.05 : 1,
                      x: focusedField === 'email' ? 4 : 0,
                      color: focusedField === 'email' ? '#818cf8' : '#94a3b8'
                    }}
                    className="text-xs font-bold uppercase tracking-[0.15em] origin-left"
                  >
                    账号
                  </motion.label>
                  {focusedField === 'email' && (
                    <motion.span 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-[10px] text-indigo-400/60 font-medium italic"
                    >
                      ENTER ACCOUNT
                    </motion.span>
                  )}
                </div>
                <div className={`relative flex items-center bg-white/[0.03] border rounded-2xl transition-all duration-500 ${focusedField === 'email' ? 'border-indigo-500/40 ring-1 ring-indigo-500/20 shadow-[0_0_25px_rgba(99,102,241,0.15)]' : 'border-white/5 hover:border-white/10'}`}>
                  <div className={`pl-4 flex items-center pointer-events-none transition-colors duration-300 ${focusedField === 'email' ? 'text-indigo-400' : 'text-slate-600'}`}>
                    <Mail size={18} />
                  </div>
                  <input
                    type="text"
                    required
                    value={email}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-transparent py-4 px-4 text-white placeholder:text-slate-700 focus:outline-none transition-all duration-300 font-medium"
                    placeholder="请输入账号"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <motion.label 
                    animate={{
                      scale: focusedField === 'password' ? 1.05 : 1,
                      x: focusedField === 'password' ? 4 : 0,
                      color: focusedField === 'password' ? '#818cf8' : '#94a3b8'
                    }}
                    className="text-xs font-bold uppercase tracking-[0.15em] origin-left"
                  >
                    密码
                  </motion.label>
                  {focusedField === 'password' && (
                    <motion.span 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-[10px] text-indigo-400/60 font-medium italic"
                    >
                      SECURE ACCESS
                    </motion.span>
                  )}
                </div>
                <div className={`relative flex items-center bg-white/[0.03] border rounded-2xl transition-all duration-500 ${focusedField === 'password' ? 'border-indigo-500/40 ring-1 ring-indigo-500/20 shadow-[0_0_25px_rgba(99,102,241,0.15)]' : 'border-white/5 hover:border-white/10'}`}>
                  <div className={`pl-4 flex items-center pointer-events-none transition-colors duration-300 ${focusedField === 'password' ? 'text-indigo-400' : 'text-slate-600'}`}>
                    <Lock size={18} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-transparent py-4 px-4 pr-12 text-white placeholder:text-slate-700 focus:outline-none transition-all duration-300 font-medium"
                    placeholder="请输入密码"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <motion.button
                  whileHover={{ scale: 1.02, filter: 'brightness(1.1)' }}
                  whileTap={{ scale: 0.98 }}
                  disabled={isLoading}
                  type="submit"
                  className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 shadow-[0_8px_30px_rgb(79,70,229,0.3)] focus:outline-none group/btn cursor-pointer"
                >
                <div className="relative w-full h-full flex items-center justify-center py-4 px-6">
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-white" />
                  ) : (
                    <div className="flex items-center gap-2 text-white text-lg font-bold tracking-wider">
                      <span>开启探索</span>
                      <ArrowRight size={20} className="group-hover/btn:translate-x-1 transition-transform" />
                    </div>
                  )}
                  {/* Shimmer Effect */}
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:animate-button-shimmer" />
                </div>
              </motion.button>
            </form>
          </div>
        </div>
      </motion.div>

      <style>{`
        @keyframes text-shimmer {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
        @keyframes button-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-text-shimmer {
          animation: text-shimmer 3s linear infinite;
        }
        .animate-button-shimmer {
          animation: button-shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
};

export default LoginPage;
