import * as React from "react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Globe } from "lucide-react"

export const LANGUAGES = [
    { code: "en", name: "English" },
    { code: "hi", name: "Hindi" },
    { code: "es", name: "Spanish" },
    { code: "fr", name: "French" },
    { code: "de", name: "German" },
    { code: "zh", name: "Chinese" },
    { code: "ja", name: "Japanese" },
    { code: "ko", name: "Korean" },
    { code: "ta", name: "Tamil" },
    { code: "kn", name: "Kannada" },
    { code: "te", name: "Telugu" },
    { code: "ml", name: "Malayalam" },
] as const;

export type LanguageCode = typeof LANGUAGES[number]['code'];

interface LanguageSelectorProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

export function LanguageSelector({ value, onChange, disabled }: LanguageSelectorProps) {
    return (
        <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <Select value={value} onValueChange={onChange} disabled={disabled}>
                <SelectTrigger className="w-[140px] h-8 text-xs font-medium bg-background/50 border-input/50 focus:ring-1 focus:ring-primary/20">
                    <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                    {LANGUAGES.map((lang) => (
                        <SelectItem key={lang.code} value={lang.code} className="text-xs">
                            {lang.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}
