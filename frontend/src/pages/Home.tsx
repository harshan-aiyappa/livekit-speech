
import { Link } from "wouter";
import { Mic, ArrowRight, Sparkles, Server, Activity } from "lucide-react";
import { CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { motion } from "framer-motion";

export default function Home() {

  // Stagger animation variants
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.3,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 50 } },
  };

  return (
    <div className="min-h-screen w-full bg-background relative overflow-hidden flex flex-col font-sans selection:bg-primary/20">

      {/* Dynamic Aurora Background */}
      <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <motion.div
          animate={{
            x: [-100, 100, -100],
            y: [-50, 50, -50],
            opacity: [0.3, 0.6, 0.3],
            scale: [1, 1.2, 1]
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen"
        />
        <motion.div
          animate={{
            x: [100, -100, 100],
            y: [50, -50, 50],
            opacity: [0.3, 0.5, 0.3],
            scale: [1.2, 1, 1.2]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-screen"
        />
      </div>

      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-50 px-6 py-3 flex flex-row justify-between items-center max-w-7xl mx-auto w-full shrink-0"
      >
        <div className="flex items-center gap-3">
          <div className="group h-9 w-9 flex items-center justify-center rounded-lg bg-card border border-border shadow-sm transition-all hover:scale-105 hover:border-primary/50">
            {/* Force Black in Light Mode, White in Dark Mode */}
            <img src="/favicon.png" alt="Logo" className="h-5 w-5 object-contain brightness-0 dark:invert transition-opacity" />
          </div>
          <div className="flex flex-col justify-center">
            <span className="font-bold text-base tracking-tight text-foreground leading-none">
              Lingotran
            </span>
            <span className="text-[9px] font-medium text-muted-foreground tracking-widest uppercase mt-0.5">
              Nexus
            </span>
          </div>
        </div>
        <ThemeToggle />
      </motion.header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 w-full max-w-7xl mx-auto overflow-hidden">

        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="w-full max-w-6xl flex flex-col items-center gap-6" // Reduced gap
        >

          {/* Hero Text - Compact */}
          <motion.div variants={item} className="text-center space-y-3 max-w-3xl relative shrink-0">

            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-secondary/50 border border-border backdrop-blur-md shadow-sm ring-1 ring-border/50 mx-auto">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
              </span>
              <span className="text-[9px] font-semibold tracking-wide uppercase text-muted-foreground">Architecture Validation Suite</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-foreground via-foreground to-foreground/60 drop-shadow-sm py-1">
              Lingotran Nexus.
            </h1>

            <p className="text-sm md:text-base text-muted-foreground max-w-lg mx-auto leading-relaxed font-light">
              The ultimate proving ground for real-time speech architectures.
              Pushing the edge of reliability and latency.
            </p>
          </motion.div>


          {/* Cards Grid - Compact Padding */}
          <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full h-full">

            {/* Hybrid Mode Card */}
            <Link href="/test" className="h-full">
              <SpotlightCard className="h-full bg-card/50 backdrop-blur-sm border-border hover:border-primary/50 transition-all duration-300 group shadow-sm hover:shadow-md flex flex-col">
                <CardHeader className="p-6 pb-2">
                  <div className="flex justify-between items-start">
                    <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                      <Mic className="h-5 w-5 text-foreground" />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] font-mono text-muted-foreground">TAT</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300 border border-orange-200 dark:border-orange-800">~800ms</span>
                    </div>
                  </div>
                  <CardTitle className="text-lg font-bold text-foreground flex items-center justify-between w-full">
                    Hybrid Node
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 uppercase tracking-widest">Legacy</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground font-medium">Legacy Dual-Path</CardDescription>
                </CardHeader>
                <CardContent className="p-6 pt-0 space-y-4 flex-1 flex flex-col">
                  <div className="space-y-3 flex-1">
                    {/* Mini Flow */}
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground bg-secondary/30 p-2 rounded-lg border border-border/50">
                      <span className="font-mono">Client</span>
                      <ArrowRight className="h-3 w-3 opacity-50" />
                      <span className="font-mono">Room</span>
                      <ArrowRight className="h-3 w-3 opacity-50" />
                      <span className="font-mono">STT</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground text-[9px] uppercase tracking-wider">Protocol</span>
                        <span className="font-medium text-foreground">WS + RTC</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground text-[9px] uppercase tracking-wider">Transport</span>
                        <span className="font-medium text-foreground">Dual</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border flex items-center justify-between">
                    <div className="flex -space-x-1.5">
                      <div className="h-5 w-5 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-background flex items-center justify-center text-[8px] font-bold" title="WebSocket">WS</div>
                      <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900 border border-background flex items-center justify-center text-[8px] font-bold text-blue-700 dark:text-blue-300" title="LiveKit">LK</div>
                    </div>
                    <div className="flex items-center text-xs font-bold text-primary group-hover:translate-x-1 transition-all">
                      Initialize <ArrowRight className="ml-1.5 h-3 w-3" />
                    </div>
                  </div>
                </CardContent>
              </SpotlightCard>
            </Link>


            {/* LiveKit Agent Card */}
            <Link href="/livekit-test" className="h-full">
              <SpotlightCard className="h-full bg-card/50 backdrop-blur-sm border-border hover:border-blue-500/50 transition-all duration-300 group shadow-sm hover:shadow-md flex flex-col">
                <CardHeader className="p-6 pb-2">
                  <div className="flex justify-between items-start">
                    <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                      <Server className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] font-mono text-muted-foreground">TAT</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">~400ms</span>
                    </div>
                  </div>
                  <CardTitle className="text-lg font-bold text-foreground flex items-center justify-between w-full">
                    Agent Core
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800 uppercase tracking-widest">Standard</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground font-medium">Cloud Relay Agent</CardDescription>
                </CardHeader>
                <CardContent className="p-6 pt-0 space-y-4 flex-1 flex flex-col">
                  <div className="space-y-3 flex-1">
                    {/* Mini Flow */}
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground bg-blue-50/50 dark:bg-blue-900/10 p-2 rounded-lg border border-blue-100 dark:border-blue-900/30">
                      <span className="font-mono">Client</span>
                      <ArrowRight className="h-3 w-3 text-blue-400" />
                      <span className="font-mono text-blue-600 dark:text-blue-400">Agent</span>
                      <ArrowRight className="h-3 w-3 text-blue-400" />
                      <span className="font-mono">STT</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground text-[9px] uppercase tracking-wider">Protocol</span>
                        <span className="font-medium text-foreground">WebRTC</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground text-[9px] uppercase tracking-wider">Transport</span>
                        <span className="font-medium text-foreground">Relay</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border flex items-center justify-between">
                    <div className="flex -space-x-1.5">
                      <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900 border border-background flex items-center justify-center text-[8px] font-bold text-blue-700 dark:text-blue-300" title="WebRTC">RTC</div>
                      <div className="h-5 w-5 rounded-full bg-purple-100 dark:bg-purple-900 border border-background flex items-center justify-center text-[8px] font-bold text-purple-700 dark:text-purple-300" title="Python">PY</div>
                    </div>
                    <div className="flex items-center text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-all">
                      Connect Agent <ArrowRight className="ml-1.5 h-3 w-3" />
                    </div>
                  </div>
                </CardContent>
              </SpotlightCard>
            </Link>


            {/* WebSocket Mode Card */}
            <Link href="/websocket-test" className="h-full">
              <SpotlightCard className="h-full bg-card/50 backdrop-blur-sm border-border hover:border-green-500/50 transition-all duration-300 group shadow-sm hover:shadow-md flex flex-col">
                <CardHeader className="p-6 pb-2">
                  <div className="flex justify-between items-start">
                    <div className="h-10 w-10 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                      <Activity className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] font-mono text-muted-foreground">TAT</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border border-green-200 dark:border-green-800">&lt;200ms</span>
                    </div>
                  </div>
                  <CardTitle className="text-lg font-bold text-foreground flex items-center justify-between w-full">
                    Direct Stream
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border border-green-200 dark:border-green-800 uppercase tracking-widest">Fastest</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground font-medium">Peer-to-Peer Socket</CardDescription>
                </CardHeader>
                <CardContent className="p-6 pt-0 space-y-4 flex-1 flex flex-col">
                  <div className="space-y-3 flex-1">
                    {/* Mini Flow */}
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground bg-green-50/50 dark:bg-green-900/10 p-2 rounded-lg border border-green-100 dark:border-green-900/30">
                      <span className="font-mono">Client</span>
                      <ArrowRight className="h-3 w-3 text-green-500" />
                      <span className="font-mono text-green-600 dark:text-green-400">Direct</span>
                      <ArrowRight className="h-3 w-3 text-green-500" />
                      <span className="font-mono">STT</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground text-[9px] uppercase tracking-wider">Protocol</span>
                        <span className="font-medium text-foreground">WebSocket</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground text-[9px] uppercase tracking-wider">Transport</span>
                        <span className="font-medium text-foreground">P2P</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border flex items-center justify-between">
                    <div className="flex -space-x-1.5">
                      <div className="h-5 w-5 rounded-full bg-zinc-800 dark:bg-zinc-100 border border-background flex items-center justify-center text-[8px] font-bold text-zinc-100 dark:text-zinc-900" title="Socket">IO</div>
                      <div className="h-5 w-5 rounded-full bg-green-100 dark:bg-green-900 border border-background flex items-center justify-center text-[8px] font-bold text-green-700 dark:text-green-300" title="FastAPI">API</div>
                    </div>

                    <div className="flex items-center text-xs font-bold text-green-600 dark:text-green-400 group-hover:translate-x-1 transition-all">
                      Open Socket <ArrowRight className="ml-1.5 h-3 w-3" />
                    </div>
                  </div>
                </CardContent>
              </SpotlightCard>
            </Link>

          </motion.div>

        </motion.div>
      </main>

      <footer className="relative z-10 p-3 text-center shrink-0">
        <p className="text-[9px] text-muted-foreground/50 font-mono tracking-widest uppercase hover:text-muted-foreground transition-colors">
          Lingotran Systems • v2.0.0-rc1
        </p>
      </footer>
    </div>
  );
}
