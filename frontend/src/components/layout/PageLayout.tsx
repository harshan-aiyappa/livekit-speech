
import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

interface PageLayoutProps {
    children: React.ReactNode;
    title: string;
    subtitle?: string;
    backLink?: string;
    actions?: React.ReactNode;
}

export function PageLayout({ children, title, subtitle, backLink = "/", actions }: PageLayoutProps) {
    return (
        <div className="min-h-screen w-full bg-background relative overflow-hidden flex flex-col font-sans">

            {/* 1. Aurora Background (Consistent with Home) */}
            <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden z-0">
                <motion.div
                    animate={{
                        x: [-50, 50, -50],
                        y: [-25, 25, -25],
                        opacity: [0.2, 0.4, 0.2]
                    }}
                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    className="absolute top-0 left-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-screen"
                />
                <motion.div
                    animate={{
                        x: [50, -50, 50],
                        y: [25, -25, 25],
                        opacity: [0.2, 0.4, 0.2]
                    }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[80px] mix-blend-multiply dark:mix-blend-screen"
                />
            </div>

            {/* 2. Glassmorphic Header */}
            <motion.header
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="relative z-50 sticky top-0 w-full border-b border-border/40 bg-background/80 backdrop-blur-md"
            >
                <div className="container flex h-16 items-center px-6 max-w-7xl mx-auto">
                    <Link href={backLink} className="mr-6 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group">
                        <div className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700 transition-colors">
                            <ArrowLeft className="h-4 w-4" />
                        </div>
                        <span className="font-medium hidden sm:inline-block">Back</span>
                    </Link>

                    <div className="flex flex-col mr-auto">
                        <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                            {title}
                        </h1>
                        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
                    </div>

                    <div className="flex items-center gap-4">
                        {actions}
                        <div className="h-6 w-px bg-border/50 hidden sm:block"></div>
                        <ThemeToggle />
                    </div>
                </div>
            </motion.header>

            {/* 3. Main Content Area */}
            <main className="relative z-10 flex-1 container py-8 px-6 max-w-7xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                >
                    {children}
                </motion.div>
            </main>

        </div>
    );
}
