import React from "react";
import { motion } from "motion/react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  RefreshCcw,
} from "lucide-react";
import { fetchCaptcha, fetchTenantList, loginWithPassword } from "../features/auth/authApi";

interface LoginPageProps {
  onLogin: (accessToken: string) => void;
}

const DEFAULT_USERNAME = "lccsetsun";
const DEFAULT_PASSWORD = "lccsetsun";

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = React.useState(DEFAULT_USERNAME);
  const [password, setPassword] = React.useState(DEFAULT_PASSWORD);
  const [tenantId, setTenantId] = React.useState("");
  const [captchaCode, setCaptchaCode] = React.useState("");
  const [captchaUuid, setCaptchaUuid] = React.useState("");
  const [captchaImage, setCaptchaImage] = React.useState("");
  const [captchaEnabled, setCaptchaEnabled] = React.useState(true);
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isBootstrapping, setIsBootstrapping] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState("");
  const [focusedField, setFocusedField] = React.useState<string | null>(null);
  const hasBootstrappedRef = React.useRef(false);

  const loadCaptcha = React.useCallback(async () => {
    const captcha = await fetchCaptcha();
    setCaptchaEnabled(captcha.captchaEnabled !== false);
    setCaptchaUuid(captcha.uuid || "");
    setCaptchaCode("");
    setCaptchaImage(captcha.img ? `data:image/gif;base64,${captcha.img}` : "");
  }, []);

  const bootstrapLogin = React.useCallback(async () => {
    setIsBootstrapping(true);
    setErrorMessage("");
    try {
      const tenantInfo = await fetchTenantList();
      const tenants = tenantInfo.voList || [];
      const nextTenantId = tenants[0]?.tenantId || "";
      setTenantId((current) => current || nextTenantId);
      if (tenantInfo.tenantEnabled) {
        await loadCaptcha();
      } else {
        setCaptchaEnabled(false);
        setCaptchaUuid("");
        setCaptchaImage("");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "初始化登录配置失败");
    } finally {
      setIsBootstrapping(false);
    }
  }, [loadCaptcha]);

  React.useEffect(() => {
    if (hasBootstrappedRef.current) return;
    hasBootstrappedRef.current = true;
    void bootstrapLogin();
  }, [bootstrapLogin]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage("");
    setIsLoading(true);
    try {
      const result = await loginWithPassword({
        tenantId,
        username: username.trim(),
        password,
        code: captchaEnabled ? captchaCode.trim() : undefined,
        uuid: captchaEnabled ? captchaUuid : undefined,
      });
      onLogin(result.access_token);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "登录失败");
      if (captchaEnabled) {
        try {
          await loadCaptcha();
        } catch {
          // Preserve the original login error if captcha refresh also fails.
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const renderInputLabel = (label: string, field: string, helper?: string) => (
    <div className="flex items-center justify-between px-1">
      <motion.label
        animate={{
          scale: focusedField === field ? 1.03 : 1,
          x: focusedField === field ? 3 : 0,
          color: focusedField === field ? "#a5b4fc" : "#94a3b8",
        }}
        className="origin-left text-xs font-bold uppercase tracking-[0.18em]"
      >
        {label}
      </motion.label>
      {focusedField === field && helper ? (
        <motion.span
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-[10px] font-medium tracking-[0.12em] text-indigo-300/60"
        >
          {helper}
        </motion.span>
      ) : null}
    </div>
  );

  const shellClassName =
    "relative flex items-center overflow-hidden rounded-2xl border border-white/6 bg-white/[0.035] transition-all duration-300";

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#030617] px-6 py-10">
      <div className="absolute inset-0">
        <div className="absolute left-[-8%] top-[-6%] h-[26rem] w-[26rem] rounded-full bg-indigo-500/18 blur-[130px]" />
        <div className="absolute bottom-[-12%] right-[-8%] h-[24rem] w-[24rem] rounded-full bg-fuchsia-500/14 blur-[140px]" />
        <div className="absolute left-1/2 top-[22%] h-[16rem] w-[16rem] -translate-x-1/2 rounded-full bg-cyan-400/10 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.9) 1px, transparent 0)",
            backgroundSize: "36px 36px",
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,7,24,0.2),rgba(3,7,24,0.75))]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative z-10 w-full max-w-[480px]"
      >
        <div className="mb-8 text-center">
          <h1 className="pointer-events-none bg-[linear-gradient(90deg,#dbeafe_0%,#a5b4fc_28%,#c084fc_58%,#f0abfc_100%)] bg-clip-text text-5xl font-black uppercase italic tracking-[0.18em] text-transparent sm:text-6xl">
            AI CANVAS
          </h1>
        </div>

        <div className="relative overflow-hidden rounded-[2rem] border border-white/8 bg-[#0b1125]/78 p-7 shadow-[0_24px_80px_rgba(15,23,42,0.65)] backdrop-blur-2xl sm:p-8">
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
          <div className="pointer-events-none absolute right-[-20%] top-[-12%] h-52 w-52 rounded-full bg-indigo-500/12 blur-[100px]" />

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2.5">
              {renderInputLabel("账号", "username", "ACCOUNT")}
              <div
                className={`${shellClassName} ${
                  focusedField === "username"
                    ? "border-indigo-400/40 shadow-[0_0_30px_rgba(99,102,241,0.16)] ring-1 ring-indigo-400/20"
                    : "hover:border-white/12"
                }`}
              >
                <div
                  className={`pointer-events-none flex items-center pl-4 transition-colors duration-300 ${
                    focusedField === "username" ? "text-indigo-300" : "text-slate-600"
                  }`}
                >
                  <Mail size={18} />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onFocus={() => setFocusedField("username")}
                  onBlur={() => setFocusedField(null)}
                  onChange={(event) => setUsername(event.target.value)}
                  className="w-full bg-transparent px-4 py-4 font-medium text-white placeholder:text-slate-600 focus:outline-none"
                  placeholder="请输入账号"
                />
              </div>
            </div>

            <div className="space-y-2.5">
              {renderInputLabel("密码", "password", "PASSWORD")}
              <div
                className={`${shellClassName} ${
                  focusedField === "password"
                    ? "border-indigo-400/40 shadow-[0_0_30px_rgba(99,102,241,0.16)] ring-1 ring-indigo-400/20"
                    : "hover:border-white/12"
                }`}
              >
                <div
                  className={`pointer-events-none flex items-center pl-4 transition-colors duration-300 ${
                    focusedField === "password" ? "text-indigo-300" : "text-slate-600"
                  }`}
                >
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full bg-transparent px-4 py-4 pr-12 font-medium text-white placeholder:text-slate-600 focus:outline-none"
                  placeholder="请输入密码"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-500 transition-colors hover:text-slate-200"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {captchaEnabled ? (
              <div className="space-y-2.5">
                {renderInputLabel("验证码", "captcha", "CAPTCHA")}
                <div className="flex gap-3">
                  <div
                    className={`${shellClassName} flex-1 ${
                      focusedField === "captcha"
                        ? "border-indigo-400/40 shadow-[0_0_30px_rgba(99,102,241,0.16)] ring-1 ring-indigo-400/20"
                        : "hover:border-white/12"
                    }`}
                  >
                    <div
                      className={`pointer-events-none flex items-center pl-4 transition-colors duration-300 ${
                        focusedField === "captcha" ? "text-indigo-300" : "text-slate-600"
                      }`}
                    >
                      <KeyRound size={18} />
                    </div>
                    <input
                      type="text"
                      required
                      value={captchaCode}
                      onFocus={() => setFocusedField("captcha")}
                      onBlur={() => setFocusedField(null)}
                      onChange={(event) => setCaptchaCode(event.target.value)}
                      className="w-full bg-transparent px-4 py-4 font-medium uppercase tracking-[0.2em] text-white placeholder:text-slate-600 focus:outline-none"
                      placeholder="请输入验证码"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => void loadCaptcha()}
                    className="group/captcha flex w-[144px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#10182f] px-2 transition-colors hover:border-indigo-300/20"
                    title="刷新验证码"
                  >
                    {captchaImage ? (
                      <img src={captchaImage} alt="验证码" className="h-[52px] w-full object-contain" />
                    ) : (
                      <RefreshCcw className="h-5 w-5 text-slate-400 transition-transform group-hover/captcha:rotate-180" />
                    )}
                  </button>
                </div>
              </div>
            ) : null}

            {errorMessage ? (
              <div className="rounded-2xl border border-rose-400/18 bg-rose-500/10 px-4 py-3 text-sm text-rose-100/90">
                {errorMessage}
              </div>
            ) : null}

            <motion.button
              whileHover={{ scale: 1.018, y: -2 }}
              whileTap={{ scale: 0.982, y: 0 }}
              disabled={isLoading || isBootstrapping || !tenantId}
              type="submit"
              className="group/btn relative w-full cursor-pointer overflow-hidden rounded-2xl bg-[linear-gradient(90deg,#4f46e5_0%,#7c3aed_48%,#d946ef_100%)] shadow-[0_16px_40px_rgba(99,102,241,0.38)] transition-shadow duration-300 hover:shadow-[0_22px_55px_rgba(147,51,234,0.42)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_45%)]" />
              <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/btn:opacity-100">
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(99,102,241,0.05),rgba(255,255,255,0.12),rgba(217,70,239,0.08))]" />
                <div className="absolute -left-1/3 top-0 h-full w-1/3 skew-x-[-24deg] bg-white/18 blur-xl group-hover/btn:animate-button-sweep" />
              </div>
              <div className="absolute inset-x-6 top-[1px] h-px bg-white/40" />
              <div className="relative flex items-center justify-center gap-2 px-6 py-4">
                {isLoading || isBootstrapping ? (
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                ) : (
                  <>
                    <span className="text-lg font-bold tracking-[0.12em] text-white">登录工作台</span>
                    <ArrowRight
                      size={20}
                      className="text-white transition-all duration-300 group-hover/btn:translate-x-1.5 group-hover/btn:scale-110"
                    />
                  </>
                )}
                <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10 transition-all duration-300 group-hover/btn:ring-white/20" />
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover/btn:animate-button-shimmer" />
              </div>
            </motion.button>
          </form>
        </div>
      </motion.div>

      <style>{`
        @keyframes button-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes button-sweep {
          0% { transform: translateX(-180%) skewX(-24deg); opacity: 0; }
          20% { opacity: 0.2; }
          100% { transform: translateX(420%) skewX(-24deg); opacity: 0; }
        }
        .animate-button-shimmer {
          animation: button-shimmer 1.8s linear infinite;
        }
        .animate-button-sweep {
          animation: button-sweep 1.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default LoginPage;
