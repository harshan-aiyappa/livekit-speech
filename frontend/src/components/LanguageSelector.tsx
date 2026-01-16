
import * as React from "react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Globe } from "lucide-react"

// Official Whisper Supported Languages (Curated Top List)
export const LANGUAGES = [
    { code: "en", name: "English" },
    { code: "zh", name: "Chinese (Mandarin)" },
    { code: "hi", name: "Hindi" },
    { code: "es", name: "Spanish" },
    { code: "fr", name: "French" },
    { code: "ar", name: "Arabic" },
    { code: "bn", name: "Bengali" },
    { code: "ru", name: "Russian" },
    { code: "pt", name: "Portuguese" },
    { code: "id", name: "Indonesian" },
    { code: "de", name: "German" },
    { code: "ja", name: "Japanese" },
    { code: "ko", name: "Korean" },
    { code: "it", name: "Italian" },
    { code: "tr", name: "Turkish" },
    { code: "vi", name: "Vietnamese" },
    { code: "ta", name: "Tamil" },
    { code: "te", name: "Telugu" },
    { code: "mr", name: "Marathi" },
    { code: "kn", name: "Kannada" },
    { code: "gu", name: "Gujarati" },
    { code: "ml", name: "Malayalam" },
    { code: "pl", name: "Polish" },
    { code: "uk", name: "Ukrainian" },
    { code: "nl", name: "Dutch" },
    { code: "th", name: "Thai" },
    { code: "cs", name: "Czech" },
    { code: "el", name: "Greek" },
    { code: "he", name: "Hebrew" },
    { code: "sv", name: "Swedish" },
] as const;

export type LanguageCode = typeof LANGUAGES[number]['code'];

interface LanguageSelectorProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

export function LanguageSelector({ value, onChange, disabled }: LanguageSelectorProps) {
    return (
        <div className="flex items-center gap-2 w-full">
            <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={value} onValueChange={onChange} disabled={disabled}>
                <SelectTrigger className="w-full h-9 text-xs font-medium bg-background/50 border-input/50 focus:ring-1 focus:ring-primary/20 backdrop-blur-sm">
                    <SelectValue placeholder="Select Language" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                    {LANGUAGES.map((lang) => (
                        <SelectItem key={lang.code} value={lang.code} className="text-xs">
                            <span className="font-medium">{lang.name}</span>
                            <span className="ml-2 text-[10px] text-muted-foreground uppercase tracking-wider">{lang.code}</span>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}
