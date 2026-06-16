import React from "react";
import { motion } from "motion/react";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  RefreshCcw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import aiCanvasLockup from "../assets/brand/ai-canvas-lockup.svg";
import { fetchCaptcha, loginWithPassword } from "../features/auth/authApi";
import { resolveCaptchaState, resolveLoginBootstrapState } from "../features/auth/loginBootstrap";
import {
  resolveCaptchaVisualState,
  resolveLoginSubmitState,
  shouldShowCaptchaRefreshBadge,
} from "../features/auth/loginUiState";
import { useRefreshOnPageVisible } from "../hooks/useRefreshOnPageVisible";

interface LoginPageProps {
  onLogin: (accessToken: string) => void;
}

type FieldKey = "username" | "password" | "captcha";

const DEFAULT_USERNAME = "";
const DEFAULT_PASSWORD = "";
const CAPTCHA_FALLBACK_ERROR = "验证码获取失败，请稍后重试";

type CaptchaRefreshOptions = {
  updateGlobalError?: boolean;
  rethrow?: boolean;
};

function toDisplayError(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

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
  const [isCaptchaLoading, setIsCaptchaLoading] = React.useState(false);
  const [captchaError, setCaptchaError] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState("");
  const [focusedField, setFocusedField] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Partial<Record<FieldKey, string>>>({});
  const hasBootstrappedRef = React.useRef(false);

  const loadCaptcha = React.useCallback(async () => fetchCaptcha(), []);

  const applyCaptchaState = React.useCallback(
    (captchaState: {
      captchaEnabled: boolean;
      captchaUuid: string;
      captchaImage: string;
    }) => {
      setCaptchaEnabled(captchaState.captchaEnabled);
      setCaptchaUuid(captchaState.captchaUuid);
      setCaptchaCode("");
      setCaptchaImage(captchaState.captchaImage);
    },
    []
  );

  const refreshCaptcha = React.useCallback(
    async ({ updateGlobalError = false, rethrow = false }: CaptchaRefreshOptions = {}) => {
      setIsCaptchaLoading(true);
      setCaptchaError("");
      if (updateGlobalError) setErrorMessage("");

      try {
        applyCaptchaState(await resolveCaptchaState(loadCaptcha));
      } catch (error) {
        const message = toDisplayError(error, CAPTCHA_FALLBACK_ERROR);
        setCaptchaError(message);
        if (updateGlobalError) setErrorMessage(message);
        if (rethrow) throw error;
      } finally {
        setIsCaptchaLoading(false);
      }
    },
    [applyCaptchaState, loadCaptcha]
  );

  const bootstrapLogin = React.useCallback(async () => {
    setIsCaptchaLoading(true);
    setCaptchaError("");
    setErrorMessage("");
    try {
      const bootstrapState = await resolveLoginBootstrapState(loadCaptcha);
      const captchaEnabledForUi = bootstrapState.warningMessage ? true : bootstrapState.captchaEnabled;
      setTenantId((current) => current || bootstrapState.tenantId);
      applyCaptchaState({ ...bootstrapState, captchaEnabled: captchaEnabledForUi });
      setCaptchaError(bootstrapState.warningMessage);
    } finally {
      setIsCaptchaLoading(false);
    }
  }, [applyCaptchaState, loadCaptcha]);

  React.useEffect(() => {
    if (hasBootstrappedRef.current) return;
    hasBootstrappedRef.current = true;
    void bootstrapLogin();
  }, [bootstrapLogin]);

  const refreshCaptchaOnPageVisible = React.useCallback(() => {
    void refreshCaptcha({ updateGlobalError: false });
  }, [refreshCaptcha]);
  useRefreshOnPageVisible(refreshCaptchaOnPageVisible);

  const clearFieldError = (field: FieldKey) => {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const validateFields = React.useCallback(() => {
    const nextErrors: Partial<Record<FieldKey, string>> = {};
    if (!username.trim()) nextErrors.username = "请输入账号";
    if (!password) nextErrors.password = "请输入密码";
    if (captchaEnabled) {
      if (isCaptchaLoading) {
        nextErrors.captcha = "验证码正在加载，请稍候";
      } else if (captchaError || !captchaUuid) {
        nextErrors.captcha = captchaError || "验证码尚未加载，请刷新后重试";
      } else if (!captchaCode.trim()) {
        nextErrors.captcha = "请输入验证码";
      }
    }
    return nextErrors;
  }, [captchaCode, captchaEnabled, captchaError, captchaUuid, isCaptchaLoading, password, username]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage("");

    const nextErrors = validateFields();
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

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
          await refreshCaptcha({ rethrow: true });
        } catch {
          // Preserve the original login error if captcha refresh also fails.
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const renderInputLabel = (label: string, field: string) => (
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
    </div>
  );

  const renderFieldMessage = (field: FieldKey) => {
    const message = fieldErrors[field];
    if (!message) return null;

    return (
      <div className="flex items-center gap-2 rounded-2xl border border-amber-300/12 bg-[linear-gradient(180deg,rgba(39,27,12,0.28),rgba(21,16,13,0.58))] px-3 py-2 text-sm text-amber-100/88 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
        <AlertCircle size={15} className="shrink-0 text-amber-300/85" />
        <span>{message}</span>
      </div>
    );
  };

  const shellClassName =
    "relative flex items-center overflow-hidden rounded-2xl border border-white/6 bg-white/[0.035] transition-all duration-300";
  const fieldIconClassName = (field: FieldKey) =>
    `pointer-events-none ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all duration-300 ${
      focusedField === field
        ? "border-indigo-300/24 bg-indigo-400/[0.12] text-indigo-200 shadow-[0_0_22px_rgba(129,140,248,0.18)]"
        : fieldErrors[field]
          ? "border-amber-300/18 bg-amber-300/[0.08] text-amber-200/78"
          : "border-white/[0.075] bg-[#0b1222]/56 text-slate-500"
    }`;
  const captchaVisualState = resolveCaptchaVisualState({ isCaptchaLoading, captchaImage, captchaError });
  const loginSubmitState = resolveLoginSubmitState({
    isLoginLoading: isLoading,
    captchaEnabled,
    isCaptchaLoading,
  });

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
        <div className="mb-7 flex justify-center">
          <img
            src={aiCanvasLockup}
            alt="幻影AI"
            className="pointer-events-none h-auto w-[min(66%,17.5rem)] drop-shadow-[0_12px_28px_rgba(8,15,35,0.26)]"
          />
        </div>

        <div className="relative overflow-hidden rounded-[2rem] border border-white/8 bg-[#0b1125]/78 p-7 shadow-[0_24px_80px_rgba(15,23,42,0.65)] backdrop-blur-2xl sm:p-8">
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px overflow-hidden bg-gradient-to-r from-transparent via-white/32 to-transparent">
            <div className="card-top-light-flow absolute left-[-22%] top-1/2 h-[11px] w-[34%] -translate-y-1/2 rounded-full bg-[linear-gradient(90deg,rgba(255,255,255,0),rgba(196,210,255,0.42),rgba(183,144,255,0.72),rgba(255,255,255,0))] blur-[5px]" />
            <div className="card-top-light-flow-secondary absolute left-[-30%] top-1/2 h-[6px] w-[22%] -translate-y-1/2 rounded-full bg-[linear-gradient(90deg,rgba(255,255,255,0),rgba(232,239,255,0.3),rgba(255,255,255,0))] blur-[4px]" />
          </div>
          <div className="pointer-events-none absolute right-[-20%] top-[-12%] h-52 w-52 rounded-full bg-indigo-500/12 blur-[100px]" />

          <form noValidate onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2.5">
              {renderInputLabel("账号", "username")}
              <div
                className={`${shellClassName} ${
                  focusedField === "username"
                    ? "border-indigo-400/40 shadow-[0_0_30px_rgba(99,102,241,0.16)] ring-1 ring-indigo-400/20"
                    : fieldErrors.username
                      ? "border-amber-300/20 ring-1 ring-amber-300/12"
                      : "hover:border-white/12"
                }`}
              >
                <div className={fieldIconClassName("username")}>
                  <UserRound size={17} strokeWidth={1.9} />
                </div>
                <input
                  type="text"
                  value={username}
                  onFocus={() => setFocusedField("username")}
                  onBlur={() => setFocusedField(null)}
                  onChange={(event) => {
                    setUsername(event.target.value);
                    clearFieldError("username");
                  }}
                  className="w-full bg-transparent px-4 py-4 font-medium text-white placeholder:text-slate-600 focus:outline-none"
                  placeholder="请输入账号"
                />
              </div>
              {renderFieldMessage("username")}
            </div>

            <div className="space-y-2.5">
              {renderInputLabel("密码", "password")}
              <div
                className={`${shellClassName} ${
                  focusedField === "password"
                    ? "border-indigo-400/40 shadow-[0_0_30px_rgba(99,102,241,0.16)] ring-1 ring-indigo-400/20"
                    : fieldErrors.password
                      ? "border-amber-300/20 ring-1 ring-amber-300/12"
                      : "hover:border-white/12"
                }`}
              >
                <div className={fieldIconClassName("password")}>
                  <LockKeyhole size={18} strokeWidth={1.85} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    clearFieldError("password");
                  }}
                  className="w-full bg-transparent px-4 py-4 pr-12 font-medium text-white placeholder:text-slate-600 focus:outline-none"
                  placeholder="请输入密码"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-0 flex cursor-pointer items-center pr-4 text-slate-500 transition-colors hover:text-slate-200"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {renderFieldMessage("password")}
            </div>

            {captchaEnabled ? (
              <div className="space-y-2.5">
                {renderInputLabel("验证码", "captcha")}
                <div className="flex gap-2.5">
                  <div
                    className={`${shellClassName} h-[58px] flex-1 ${
                      focusedField === "captcha"
                        ? "border-indigo-400/40 shadow-[0_0_30px_rgba(99,102,241,0.16)] ring-1 ring-indigo-400/20"
                        : fieldErrors.captcha
                          ? "border-amber-300/20 ring-1 ring-amber-300/12"
                          : "hover:border-white/12"
                    }`}
                  >
                    <div className={fieldIconClassName("captcha")}>
                      <ShieldCheck size={18} strokeWidth={1.85} />
                    </div>
                    <input
                      type="text"
                      value={captchaCode}
                      onFocus={() => setFocusedField("captcha")}
                      onBlur={() => setFocusedField(null)}
                      onChange={(event) => {
                        setCaptchaCode(event.target.value);
                        clearFieldError("captcha");
                      }}
                      className="h-full w-full bg-transparent px-4 py-0 text-[0.95rem] font-medium uppercase tracking-[0.14em] text-white placeholder:text-slate-600 focus:outline-none"
                      placeholder="请输入验证码"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => void refreshCaptcha()}
                    disabled={isCaptchaLoading}
                    className="group/captcha relative flex h-[58px] w-[142px] shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-[1.05rem] border border-white/8 bg-[#10182f] transition-all duration-300 hover:border-indigo-300/18 hover:bg-[#121c37] disabled:cursor-wait disabled:opacity-80"
                    title={isCaptchaLoading ? "验证码加载中" : captchaError ? "重新获取验证码" : "刷新验证码"}
                  >
                    {captchaVisualState === "image" ? (
                      <img src={captchaImage} alt="验证码" className="h-[32px] w-[108px] rounded-[0.5rem] bg-white object-contain" />
                    ) : captchaVisualState === "loading" ? (
                      <Loader2 className="h-5 w-5 animate-spin text-indigo-200" />
                    ) : captchaVisualState === "error" ? (
                      <span className="flex items-center gap-2 text-xs font-semibold text-rose-100/90">
                        <AlertCircle className="h-4 w-4 text-rose-300" />
                        获取失败
                      </span>
                    ) : (
                      <RefreshCcw className="h-5 w-5 text-slate-400 transition-transform group-hover/captcha:rotate-180" />
                    )}
                    {shouldShowCaptchaRefreshBadge(captchaVisualState) ? (
                      <div className="pointer-events-none absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(17,25,53,0.82)] text-slate-300/78 backdrop-blur-sm transition-colors duration-300 group-hover/captcha:text-indigo-200">
                        <RefreshCcw className="h-3 w-3 transition-transform duration-300 group-hover/captcha:rotate-180" />
                      </div>
                    ) : null}
                  </button>
                </div>
                {captchaError && !fieldErrors.captcha ? (
                  <div className="flex items-center gap-2 rounded-2xl border border-rose-400/16 bg-rose-500/10 px-3 py-2 text-sm text-rose-100/90">
                    <AlertCircle size={15} className="shrink-0 text-rose-300/90" />
                    <span>{captchaError}</span>
                  </div>
                ) : (
                  renderFieldMessage("captcha")
                )}
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
              disabled={loginSubmitState.disabled}
              type="submit"
              className="group/btn relative mt-1.5 w-full cursor-pointer overflow-hidden rounded-2xl bg-[linear-gradient(90deg,#4e5ed7_0%,#7060e8_52%,#a05be8_100%)] shadow-[0_16px_40px_rgba(76,86,198,0.34)] transition-shadow duration-300 hover:shadow-[0_22px_55px_rgba(104,88,220,0.4)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_45%)]" />
              <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/btn:opacity-100">
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(201,214,255,0.04),rgba(255,255,255,0.1),rgba(188,142,255,0.08))]" />
                <div className="absolute -left-1/3 top-0 h-full w-1/3 skew-x-[-24deg] bg-white/18 blur-xl group-hover/btn:animate-button-sweep" />
              </div>
              <div className="relative flex items-center justify-center gap-2 px-6 py-4">
                {loginSubmitState.showSpinner ? (
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                ) : (
                  <>
                    <span className="text-lg font-bold tracking-[0.12em] text-white">登录</span>
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
        @keyframes card-top-light-flow {
          0% { transform: translate(-18%, -50%); opacity: 0; }
          18% { opacity: 0.48; }
          52% { opacity: 0.76; }
          100% { transform: translate(430%, -50%); opacity: 0; }
        }
        @keyframes card-top-light-flow-secondary {
          0% { transform: translate(-24%, -50%); opacity: 0; }
          24% { opacity: 0.18; }
          60% { opacity: 0.34; }
          100% { transform: translate(520%, -50%); opacity: 0; }
        }
        .card-top-light-flow {
          animation: card-top-light-flow 5.4s ease-in-out infinite;
        }
        .card-top-light-flow-secondary {
          animation: card-top-light-flow-secondary 6.2s ease-in-out infinite;
          animation-delay: 0.9s;
        }
        @media (prefers-reduced-motion: reduce) {
          .card-top-light-flow,
          .card-top-light-flow-secondary,
          .animate-button-shimmer,
          .animate-button-sweep {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default LoginPage;
