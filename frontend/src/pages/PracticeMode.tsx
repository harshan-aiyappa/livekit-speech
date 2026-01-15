
import { Link } from "wouter";
import { ArrowLeft, Construction, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function PracticeMode() {
    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
            <div className="absolute top-4 left-4">
                <Link href="/">
                    <Button variant="ghost" className="gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Menu
                    </Button>
                </Link>
            </div>

            <Card className="max-w-md w-full border-0 shadow-2xl bg-card/50 backdrop-blur-xl ring-1 ring-border/50">
                <CardContent className="flex flex-col items-center text-center p-10 gap-6">
                    <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <GraduationCap className="h-10 w-10 text-primary" />
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold tracking-tighter">Practice Mode</h1>
                        <p className="text-muted-foreground">
                            Enhance your skills with interactive exercises.
                        </p>
                    </div>

                    <div className="py-8 w-full flex justify-center">
                        <div className="relative">
                            <div className="absolute inset-0 bg-zinc-500/20 blur-xl rounded-full"></div>
                            <div className="relative bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 border border-zinc-200 dark:border-zinc-700">
                                <Construction className="h-4 w-4" />
                                Under Development
                            </div>
                        </div>
                    </div>

                    <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                        We are crafting a new experience for you. Check back soon for updates!
                    </p>

                    <Link href="/">
                        <Button className="w-full mt-4" size="lg">
                            Return Home
                        </Button>
                    </Link>
                </CardContent>
            </Card>
        </div>
    );
}
