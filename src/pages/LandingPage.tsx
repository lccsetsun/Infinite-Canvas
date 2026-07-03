import React from "react";
import { motion } from "motion/react";
import {
  ArrowRight,
  Blocks,
  Bot,
  Brush,
  CheckCircle2,
  Cloud,
  Image,
  Layers3,
  MousePointer2,
  Play,
  Sparkles,
  WandSparkles,
  Zap,
} from "lucide-react";
import aiCanvasLockup from "../assets/brand/ai-canvas-lockup.svg";
import aiCanvasMark from "../assets/brand/ai-canvas-mark.svg";

interface LandingPageProps {
  onOpenLogin: () => void;
}

const navItems = ["产品", "模板中心", "解决方案", "价格", "帮助中心"];

const featureItems = [
  { icon: WandSparkles, title: "无限创作", text: "从灵感到成片，一张画布串起完整流程" },
  { icon: Bot, title: "AI 智能助手", text: "提示词、参考图、批量生成协同推进" },
  { icon: Blocks, title: "协作无界", text: "项目、资源与结果在团队间顺畅流转" },
  { icon: Cloud, title: "云端存储", text: "最近项目与资产自动沉淀，随时继续" },
];

const promptChips = ["未来科技感", "银蓝色光效", "高塔天际线"];
const toolIcons = [Play, Brush, Layers3, Image, MousePointer2];
const palette = ["#735cf4", "#9fb0f7", "#f2b84b"];

export default function LandingPage({ onOpenLogin }: LandingPageProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f7f8ff] text-[#151a3a]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(118deg,#eef3ff_0%,#ffffff_42%,#edfaff_100%)]" />
      <div className="landing-aurora pointer-events-none absolute left-1/2 top-0 h-[76vh] w-[120vw] -translate-x-1/2 opacity-90" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.32] [background-image:linear-gradient(rgba(72,84,144,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(72,84,144,0.07)_1px,transparent_1px)] [background-size:44px_44px]" />
      <div className="landing-scanline pointer-events-none absolute inset-0 opacity-45" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1200px] flex-col px-5 py-5 sm:px-8 lg:px-10">
        <header className="flex h-14 items-center justify-between">
          <button type="button" onClick={onOpenLogin} className="group flex items-center gap-2.5" aria-label="幻影AI 首页">
            <span className="relative flex h-8 w-8 items-center justify-center">
              <span className="absolute inset-0 rounded-xl bg-[#725df4]/12 blur-md transition-opacity group-hover:opacity-80" />
              <img src={aiCanvasMark} alt="" className="relative h-8 w-8" />
            </span>
            <span className="text-sm font-black tracking-[0.02em] text-[#24284f]">幻影AI</span>
          </button>

          <nav className="hidden items-center gap-7 rounded-full border border-white/70 bg-white/46 px-6 py-3 text-xs font-bold text-[#515a85] shadow-[0_16px_46px_rgba(83,96,180,0.08)] backdrop-blur-xl lg:flex">
            {navItems.map((item) => (
              <button key={item} type="button" onClick={onOpenLogin} className="transition-colors hover:text-[#604ee7]">
                {item}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onOpenLogin}
              className="hidden rounded-full px-4 py-2 text-xs font-bold text-[#343957] transition-colors hover:text-[#604ee7] sm:block"
            >
              登录
            </button>
            <button
              type="button"
              onClick={onOpenLogin}
              className="landing-cta group relative overflow-hidden rounded-full bg-[#7058f2] px-4 py-2.5 text-xs font-black text-white shadow-[0_14px_30px_rgba(112,88,242,0.28)] transition-transform hover:-translate-y-0.5 hover:bg-[#604ee7] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8f7cff]/60"
            >
              <span className="relative z-10">免费使用</span>
            </button>
          </div>
        </header>

        <section className="grid flex-1 items-center gap-8 py-7 lg:grid-cols-[0.86fr_1.14fr] lg:py-3">
          <div className="max-w-[570px] pt-8 lg:pt-0">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#d9def5] bg-white/72 px-3.5 py-2 text-xs font-black text-[#6553e8] shadow-[0_10px_30px_rgba(83,96,180,0.08)] backdrop-blur"
            >
              <Sparkles className="h-3.5 w-3.5" />
              全新 AI 创意协作画布
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.64, delay: 0.08, ease: "easeOut" }}>
              <h1 className="text-[clamp(2.7rem,5.8vw,5.25rem)] font-black leading-[0.98] tracking-0 text-[#20254f]">
                AI 无限画布
                <span className="landing-gradient-title block bg-[linear-gradient(92deg,#5b67e8,#8a55f4_46%,#21b8d0_86%)] bg-clip-text text-transparent">
                  释放你的无限创意
                </span>
              </h1>
              <p className="mt-6 max-w-[33rem] text-base leading-8 text-[#687196] sm:text-lg">
                在无限画布上自由创作，AI 助力灵感延伸、资源编排与结果生成，让想法从草图直接长成作品。
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.64, delay: 0.18, ease: "easeOut" }}
              className="mt-8 flex flex-wrap items-center gap-4"
            >
              <button
                type="button"
                onClick={onOpenLogin}
                className="landing-cta group relative flex h-12 overflow-hidden rounded-[0.9rem] bg-[#7058f2] px-5 text-sm font-black text-white shadow-[0_18px_34px_rgba(112,88,242,0.28)] transition-all hover:-translate-y-0.5 hover:bg-[#604ee7] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8f7cff]/60"
              >
                <span className="relative z-10 flex items-center gap-2">
                  开始创作
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </button>
              <button
                type="button"
                onClick={onOpenLogin}
                className="group flex h-12 items-center gap-2 rounded-[0.9rem] border border-[#d6dcf4] bg-white/64 px-5 text-sm font-black text-[#30385f] shadow-[0_12px_26px_rgba(83,96,180,0.08)] backdrop-blur transition-all hover:-translate-y-0.5 hover:border-[#c3caf0] hover:bg-white"
              >
                体验演示
                <Play className="h-4 w-4 fill-[#30385f] transition-transform group-hover:scale-110" />
              </button>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.72, delay: 0.12, ease: "easeOut" }}
            className="relative min-h-[450px] lg:min-h-[580px]"
          >
            <div className="pointer-events-none absolute inset-0 rounded-[3rem] bg-[radial-gradient(ellipse_at_58%_48%,rgba(126,100,244,0.16),transparent_45%),radial-gradient(ellipse_at_76%_62%,rgba(34,184,208,0.12),transparent_36%)] blur-2xl" />

            <svg className="pointer-events-none absolute inset-0 hidden h-full w-full md:block" viewBox="0 0 660 580" fill="none" aria-hidden="true">
              <path className="landing-flow-line" d="M244 118 C322 125 330 206 414 202" stroke="#7b63f4" strokeWidth="1.8" strokeLinecap="round" />
              <path className="landing-flow-line landing-flow-line-two" d="M232 330 C318 298 376 376 468 332" stroke="#27b9d0" strokeWidth="1.8" strokeLinecap="round" />
              <path className="landing-flow-line landing-flow-line-three" d="M396 222 C342 266 342 326 292 372" stroke="#f2b84b" strokeWidth="1.6" strokeLinecap="round" />
            </svg>

            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 6.8, repeat: Infinity, ease: "easeInOut" }}
              className="absolute left-[7%] top-[16%] hidden h-[264px] w-14 flex-col items-center justify-center gap-4 rounded-[1.35rem] border border-white/85 bg-white/78 shadow-[0_24px_60px_rgba(83,96,180,0.16)] backdrop-blur-xl md:flex"
            >
              {toolIcons.map((Icon, index) => (
                <div
                  key={index}
                  className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
                    index === 1 ? "bg-[#7058f2] text-white shadow-[0_10px_22px_rgba(112,88,242,0.24)]" : "text-[#6c7395]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
              ))}
            </motion.div>

            <motion.div
              animate={{ y: [0, -12, 0], rotate: [0, 0.45, 0] }}
              transition={{ duration: 7.4, repeat: Infinity, ease: "easeInOut" }}
              className="landing-glass-card absolute left-[27%] top-[4%] w-[232px] rounded-[1.15rem] p-4 sm:left-[31%]"
            >
              <div className="mb-3 flex items-center gap-2">
                <img src={aiCanvasMark} alt="" className="h-5 w-5" />
                <span className="text-xs font-black text-[#30385f]">AI 助手</span>
              </div>
              <p className="text-xs leading-5 text-[#687294]">帮我生成一个未来城市概念图，并补充参考元素。</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] font-black text-[#28a991]">
                  <Zap className="h-3.5 w-3.5" />
                  推理中
                </span>
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#7b63f4] text-white">
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </motion.div>

            <motion.div
              animate={{ y: [0, 11, 0], rotate: [0, -0.3, 0] }}
              transition={{ duration: 8.2, repeat: Infinity, ease: "easeInOut" }}
              className="landing-glass-card absolute right-[0%] top-[13%] w-[315px] rounded-[1.4rem] p-3 sm:right-[7%]"
            >
              <div className="relative aspect-[1.48] overflow-hidden rounded-[1rem] bg-[#dbe8f2]">
                <div className="absolute inset-0 bg-[linear-gradient(180deg,#b7d2e5_0%,#eef7fb_45%,#d4e2d0_46%,#71946f_100%)]" />
                <div className="landing-preview-light absolute inset-y-0 w-24 rotate-12 bg-white/24 blur-xl" />
                <div className="absolute bottom-0 left-0 right-0 h-20 bg-[linear-gradient(180deg,rgba(255,255,255,0),rgba(64,96,80,0.44))]" />
                <div className="absolute bottom-7 left-10 h-24 w-10 bg-[#607f8c] [clip-path:polygon(50%_0,74%_100%,26%_100%)]" />
                <div className="absolute bottom-8 left-24 h-32 w-12 bg-[#788fa2] [clip-path:polygon(50%_0,78%_100%,22%_100%)]" />
                <div className="absolute bottom-9 right-16 h-36 w-16 bg-[#516f82] [clip-path:polygon(50%_0,72%_100%,28%_100%)]" />
                <div className="absolute bottom-6 right-28 h-28 w-12 bg-[#90a4ac] [clip-path:polygon(50%_0,76%_100%,24%_100%)]" />
                <div className="absolute left-6 top-6 rounded-full bg-white/72 px-3 py-1.5 text-[11px] font-black text-[#6553e8] shadow-sm">创意预览</div>
              </div>
            </motion.div>

            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 7.8, repeat: Infinity, ease: "easeInOut" }}
              className="landing-glass-card absolute bottom-[15%] left-[28%] hidden w-[236px] rounded-[1.1rem] p-4 sm:block"
            >
              <div className="mb-3 flex items-center gap-2 text-xs font-black text-[#9a7830]">
                <Sparkles className="h-4 w-4 text-[#f2b84b]" />
                灵感清单
              </div>
              {promptChips.map((item) => (
                <div key={item} className="mb-2 flex items-center gap-2 text-xs text-[#657093]">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#f2b84b]" />
                  {item}
                </div>
              ))}
            </motion.div>

            <motion.div
              animate={{ y: [0, -9, 0], rotate: [0, 0.35, 0] }}
              transition={{ duration: 8.8, repeat: Infinity, ease: "easeInOut" }}
              className="landing-glass-card absolute bottom-[2%] right-[4%] w-[270px] rounded-[1.2rem] p-3 sm:right-[7%]"
            >
              <div className="aspect-[1.48] rounded-[0.85rem] bg-[#fbfbff] p-4">
                <div className="h-full overflow-hidden rounded-[0.7rem] border border-[#d4d8e8] bg-[linear-gradient(135deg,transparent_47%,rgba(96,105,136,0.12)_48%,transparent_49%)]">
                  <svg viewBox="0 0 220 140" className="h-full w-full" role="img" aria-label="线稿画布">
                    <path className="landing-sketch-line" d="M30 112 C50 78 66 62 84 94 C101 40 124 26 143 98 C164 74 178 62 194 112" fill="none" stroke="#7a829d" strokeWidth="2" />
                    <path className="landing-sketch-line landing-sketch-line-two" d="M66 114 L94 54 L126 114 M112 114 L142 32 L180 114" fill="none" stroke="#9aa1b5" strokeWidth="2" />
                    <path d="M44 112 H198" stroke="#bdc3d3" strokeWidth="2" />
                  </svg>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                {palette.map((color) => (
                  <span key={color} className="h-7 w-7 rounded-lg border border-white shadow-sm" style={{ backgroundColor: color }} />
                ))}
                <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#e0e4f4] text-[#7b82a3]">+</span>
              </div>
            </motion.div>

            <motion.div
              animate={{ x: [0, 8, 0], y: [0, -6, 0] }}
              transition={{ duration: 5.8, repeat: Infinity, ease: "easeInOut" }}
              className="absolute bottom-[29%] left-[15%] hidden rounded-full bg-[#34c5ac] px-4 py-2 text-xs font-black text-white shadow-[0_16px_32px_rgba(52,197,172,0.28)] md:block"
            >
              智能生成
            </motion.div>
            <motion.div
              animate={{ x: [0, -7, 0], y: [0, 5, 0] }}
              transition={{ duration: 6.4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute right-[1%] top-[34%] hidden rounded-full bg-[#f2b84b] px-4 py-2 text-xs font-black text-white shadow-[0_16px_32px_rgba(242,184,75,0.28)] md:block"
            >
              云端同步
            </motion.div>
          </motion.div>
        </section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.66, delay: 0.32, ease: "easeOut" }}
          className="mb-4 grid gap-3 rounded-[1.15rem] border border-white/82 bg-white/60 p-3 shadow-[0_18px_48px_rgba(83,96,180,0.1)] backdrop-blur-xl sm:grid-cols-2 lg:grid-cols-4"
        >
          {featureItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.title}
                type="button"
                onClick={onOpenLogin}
                className="group flex min-h-[82px] items-center gap-3 rounded-[0.8rem] px-3 text-left transition-all hover:-translate-y-0.5 hover:bg-white/82 hover:shadow-[0_16px_32px_rgba(83,96,180,0.08)]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.8rem] bg-[#eef2ff] text-[#6553e8] transition-transform group-hover:-translate-y-0.5 group-hover:scale-105">
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-black text-[#2c3158]">{item.title}</span>
                  <span className="mt-1 block text-xs leading-5 text-[#79809f]">{item.text}</span>
                </span>
              </button>
            );
          })}
        </motion.section>
      </div>

      <img
        src={aiCanvasLockup}
        alt=""
        className="pointer-events-none absolute -bottom-10 -right-16 hidden w-[340px] opacity-[0.045] lg:block"
      />

      <style>{`
        .landing-aurora {
          background:
            radial-gradient(ellipse at 46% 8%, rgba(132, 104, 255, 0.24), transparent 36%),
            radial-gradient(ellipse at 78% 64%, rgba(39, 185, 208, 0.17), transparent 34%),
            radial-gradient(ellipse at 24% 60%, rgba(242, 184, 75, 0.1), transparent 28%);
          animation: landing-aurora-drift 13s ease-in-out infinite alternate;
        }

        .landing-scanline {
          background: linear-gradient(105deg, transparent 0%, rgba(255, 255, 255, 0.7) 45%, transparent 58%);
          transform: translateX(-72%);
          animation: landing-scanline 9s ease-in-out infinite;
        }

        .landing-gradient-title {
          background-size: 160% 100%;
          animation: landing-title-shift 7s ease-in-out infinite alternate;
        }

        .landing-glass-card {
          border: 1px solid rgba(255, 255, 255, 0.88);
          background: rgba(255, 255, 255, 0.76);
          box-shadow:
            0 26px 68px rgba(83, 96, 180, 0.17),
            inset 0 1px 0 rgba(255, 255, 255, 0.62);
          backdrop-filter: blur(22px);
        }

        .landing-cta::before {
          content: "";
          position: absolute;
          inset: -30% auto -30% -48%;
          width: 38%;
          transform: skewX(-22deg);
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.36), transparent);
          animation: landing-button-sheen 3.4s ease-in-out infinite;
        }

        .landing-flow-line {
          stroke-dasharray: 10 12;
          animation: landing-flow 2.7s linear infinite;
          filter: drop-shadow(0 0 8px rgba(123, 99, 244, 0.26));
        }

        .landing-flow-line-two {
          animation-duration: 3.15s;
          animation-delay: -0.8s;
          filter: drop-shadow(0 0 8px rgba(39, 185, 208, 0.24));
        }

        .landing-flow-line-three {
          animation-duration: 3.8s;
          animation-delay: -1.2s;
          filter: drop-shadow(0 0 8px rgba(242, 184, 75, 0.24));
        }

        .landing-preview-light {
          left: -38%;
          animation: landing-preview-light 5.6s ease-in-out infinite;
        }

        .landing-sketch-line {
          stroke-dasharray: 420;
          stroke-dashoffset: 420;
          animation: landing-sketch 4.8s ease-in-out infinite;
        }

        .landing-sketch-line-two {
          animation-delay: 0.34s;
        }

        @keyframes landing-aurora-drift {
          0% { transform: translateX(-51%) translateY(0) scale(1); }
          100% { transform: translateX(-49%) translateY(16px) scale(1.04); }
        }

        @keyframes landing-scanline {
          0%, 22% { transform: translateX(-72%); opacity: 0; }
          38% { opacity: 0.42; }
          64%, 100% { transform: translateX(78%); opacity: 0; }
        }

        @keyframes landing-title-shift {
          0% { background-position: 0% 50%; }
          100% { background-position: 100% 50%; }
        }

        @keyframes landing-button-sheen {
          0%, 38% { transform: translateX(0) skewX(-22deg); opacity: 0; }
          48% { opacity: 1; }
          72%, 100% { transform: translateX(520%) skewX(-22deg); opacity: 0; }
        }

        @keyframes landing-flow {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: -44; }
        }

        @keyframes landing-preview-light {
          0%, 36% { transform: translateX(0) rotate(12deg); opacity: 0; }
          48% { opacity: 0.72; }
          78%, 100% { transform: translateX(520%) rotate(12deg); opacity: 0; }
        }

        @keyframes landing-sketch {
          0%, 12% { stroke-dashoffset: 420; opacity: 0.55; }
          42%, 68% { stroke-dashoffset: 0; opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 0.58; }
        }

        @media (max-width: 640px) {
          .landing-glass-card {
            background: rgba(255, 255, 255, 0.7);
            box-shadow: 0 22px 56px rgba(83, 96, 180, 0.13);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .landing-aurora,
          .landing-scanline,
          .landing-gradient-title,
          .landing-cta::before,
          .landing-flow-line,
          .landing-preview-light,
          .landing-sketch-line {
            animation: none !important;
          }
        }
      `}</style>
    </main>
  );
}
