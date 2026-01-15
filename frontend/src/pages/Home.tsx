
import { Link } from "wouter";
import { Mic, BookOpen, ArrowRight, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Home() {
  return (
    <div className="h-screen w-full bg-background relative overflow-hidden flex flex-col">

      {/* Background Gradients (Subtle Monochrome) */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full bg-zinc-500/5 blur-[120px]" />
        <div className="absolute top-[40%] -right-[10%] w-[60%] h-[60%] rounded-full bg-zinc-500/5 blur-[120px]" />
      </div>

      <header className="relative z-10 p-4 flex flex-row justify-between items-center gap-4 max-w-7xl mx-auto w-full shrink-0">
        <div className="flex items-center gap-3">
          {/* Favicon Logo - High Contrast Background */}
          <div className="h-10 w-10 flex items-center justify-center rounded-2xl bg-zinc-900 text-zinc-50 shadow-md shrink-0 transition-transform hover:scale-105">
            <img src="/favicon.png" alt="Logo" className="h-6 w-6 object-contain brightness-0 invert" />
          </div>
          <span className="font-heading font-bold text-2xl tracking-tight text-foreground hidden sm:inline-block">
            Vocalize
          </span>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content - Strictly Compact to fit screen */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 gap-4 max-w-6xl mx-auto w-full overflow-y-auto safe-bottom no-scrollbar">

        <div className="text-center space-y-3 max-w-2xl mx-auto animate-in slide-in-from-bottom-5 fade-in duration-700 px-2 shrink-0">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800/50 text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-2 shadow-sm">
            <Sparkles className="h-3 w-3" />
            <span>Next-Gen Speech Analysis</span>
          </div>
          <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-gradient leading-[1.1]">
            Master Your Speech
          </h1>
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-[90%] mx-auto">
            Advanced real-time transcription and speech practice.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-lg md:max-w-4xl animate-in slide-in-from-bottom-10 fade-in duration-1000 fill-mode-backwards delay-200 shrink-0">

          <Link href="/test">
            <Card className="group relative h-full overflow-hidden border-none bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md shadow-lg hover:shadow-2xl transition-all duration-500 cursor-pointer">
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardHeader className="p-5">
                <div className="mb-3 h-10 w-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100 group-hover:scale-110 transition-transform duration-300 shadow-sm/50">
                  <Mic className="h-5 w-5" />
                </div>
                <CardTitle className="text-xl font-bold">Test Mode</CardTitle>
                <CardDescription className="text-sm text-muted-foreground/80">
                  Real-time visualization & transcription.
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto p-5 pt-0">
                <div className="flex items-center text-sm font-semibold text-foreground/80 group-hover:text-foreground group-hover:translate-x-1 transition-all">
                  Enter Test Mode <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/practice">
            <Card className="group relative h-full overflow-hidden border-none bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md shadow-lg hover:shadow-2xl transition-all duration-500 cursor-pointer">
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardHeader className="p-5">
                <div className="mb-3 h-10 w-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100 group-hover:scale-110 transition-transform duration-300 shadow-sm/50">
                  <BookOpen className="h-5 w-5" />
                </div>
                <CardTitle className="text-xl font-bold">Practice Mode</CardTitle>
                <CardDescription className="text-sm text-muted-foreground/80">
                  Interactive speech drills to improve fluency.
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto p-5 pt-0">
                <div className="flex items-center text-sm font-semibold text-foreground/80 group-hover:text-foreground group-hover:translate-x-1 transition-all">
                  Start Practice <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </Link>

        </div>
      </main>

      <footer className="relative z-10 p-3 text-center text-xs text-muted-foreground shrink-0 hidden md:block">
        © 2026 Vocalize. Powered by LiveKit & Whisper.
      </footer>
    </div>
  );
}
