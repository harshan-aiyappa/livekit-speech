
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, CircleDashed, AlertCircle, Mic, Server, Wifi } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type SystemCheckStep = {
    id: string;
    label: string;
    description?: string;
    fn?: () => Promise<boolean> | boolean; // Optional verification function
    status: "idle" | "running" | "success" | "error";
    icon?: React.ReactNode;
};

interface SystemCheckModalProps {
    isOpen: boolean;
    onClose: () => void;
    onExit: () => void; // Redirect to home/cancel
    steps: SystemCheckStep[];
    title?: string;
}

export function SystemCheckModal({ isOpen, onClose, onExit, steps: initialSteps, title = "System Check" }: SystemCheckModalProps) {
    const [steps, setSteps] = useState(initialSteps);
    const [isComplete, setIsComplete] = useState(false);

    // Sync external steps changes if provided from parent (e.g. status updates)
    useEffect(() => {
        setSteps(initialSteps);
        const allSuccess = initialSteps.every(s => s.status === "success");
        setIsComplete(allSuccess);
    }, [initialSteps]);

    const allSuccess = steps.every(s => s.status === "success");
    const hasError = steps.some(s => s.status === "error");

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onExit(); }}>
            <DialogContent className="sm:max-w-md border-zinc-800 bg-background/95 backdrop-blur-xl" onInteractOutside={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <div className="relative flex h-3 w-3">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${hasError ? "bg-red-400" : "bg-blue-400"}`}></span>
                            <span className={`relative inline-flex rounded-full h-3 w-3 ${hasError ? "bg-red-500" : "bg-blue-500"}`}></span>
                        </div>
                        {title}
                    </DialogTitle>
                    <DialogDescription>
                        {hasError ? "System check failed. Please review errors." : "Verifying system readiness for real-time speech..."}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-6 flex flex-col gap-4">
                    {steps.map((step, index) => (
                        <motion.div
                            key={step.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className={`flex items-start gap-4 p-3 rounded-lg border border-border/40 bg-muted/20 ${step.status === "error" ? "border-red-500/30 bg-red-500/10" : ""}`}
                        >
                            <div className="mt-1">
                                {step.status === "running" && <CircleDashed className="h-5 w-5 animate-spin text-blue-500" />}
                                {step.status === "success" && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                                {step.status === "error" && <AlertCircle className="h-5 w-5 text-red-500" />}
                                {step.status === "idle" && <div className="h-5 w-5 rounded-full border-2 border-muted" />}
                            </div>
                            <div className="flex-1">
                                <h4 className={`text-sm font-medium ${step.status === "success" ? "text-foreground" : step.status === "error" ? "text-red-400" : "text-muted-foreground"}`}>
                                    {step.label}
                                </h4>
                                {step.description && (
                                    <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                                )}
                            </div>
                            {step.icon && <div className="text-muted-foreground opacity-50">{step.icon}</div>}
                        </motion.div>
                    ))}
                </div>

                <DialogFooter className="sm:justify-between items-center gap-2">
                    {hasError ? (
                        <Button variant="destructive" onClick={onExit} className="w-full sm:w-auto">
                            Back to Home
                        </Button>
                    ) : (
                        <Button variant="ghost" onClick={onExit} disabled={isComplete} className="text-muted-foreground">
                            Cancel
                        </Button>
                    )}

                    {!hasError && (
                        <Button
                            onClick={onClose}
                            disabled={!isComplete}
                            className={isComplete ? "bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto" : "w-full sm:w-auto"}
                        >
                            {isComplete ? "Start Session" : "Checking..."}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
