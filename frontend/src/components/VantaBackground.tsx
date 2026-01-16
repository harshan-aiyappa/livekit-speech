
import { useEffect, useRef, useState } from 'react';
import { useTheme } from "next-themes";

export function VantaBackground() {
    const vantaRef = useRef<HTMLDivElement>(null);
    const [vantaEffect, setVantaEffect] = useState<any>(null);
    const { resolvedTheme } = useTheme();

    useEffect(() => {
        // Destroy existing effect on theme change to rebuild with new colors
        if (vantaEffect) {
            vantaEffect.destroy();
            setVantaEffect(null);
        }
    }, [resolvedTheme]);

    useEffect(() => {
        const loadVanta = () => {
            if (!vantaEffect && vantaRef.current && (window as any).VANTA) {
                const isDark = resolvedTheme === 'dark';

                try {
                    const effect = (window as any).VANTA.CELLS({
                        el: vantaRef.current,
                        mouseControls: true,
                        touchControls: true,
                        gyroControls: false,
                        minHeight: 200.00,
                        minWidth: 200.00,
                        scale: 1.00,
                        color1: isDark ? 0x1a1b26 : 0xdbeafe, // Dark Navy / Light Blue
                        color2: isDark ? 0x000000 : 0xffffff,
                        size: 2.0,
                        speed: 1.2
                    });
                    setVantaEffect(effect);
                } catch (e) {
                    console.error("Vanta Init Error", e);
                }
            }
        };

        // Retry if script not loaded yet (for slower connections)
        const timeout = setTimeout(loadVanta, 100);

        return () => {
            clearTimeout(timeout);
        };
    }, [vantaEffect, resolvedTheme]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (vantaEffect) vantaEffect.destroy();
        };
    }, [vantaEffect]);

    return (
        <div
            ref={vantaRef}
            className="absolute inset-0 z-0 pointer-events-none opacity-30 dark:opacity-20 transition-opacity duration-1000"
        />
    );
}
