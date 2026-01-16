
import { useCallback } from "react";
import Particles from "react-tsparticles";
import { loadSlim } from "tsparticles-slim";
import type { Container, Engine } from "tsparticles-engine";

export function NeuralBackground() {
    const particlesInit = useCallback(async (engine: Engine) => {
        await loadSlim(engine);
    }, []);

    const particlesLoaded = useCallback(async (container: Container | undefined) => {
        // console.log(container);
    }, []);

    return (
        <Particles
            id="tsparticles"
            init={particlesInit}
            loaded={particlesLoaded}
            className="absolute inset-0 z-0 opacity-40 pointer-events-none"
            options={{
                fpsLimit: 120,
                fullScreen: { enable: false }, // Critical: Render inside parent div
                particles: {
                    number: {
                        value: 60,
                        density: {
                            enable: true,
                            area: 800,
                        },
                    },
                    color: {
                        value: "#6366f1", // Indigo primary
                    },
                    shape: {
                        type: "circle",
                    },
                    opacity: {
                        value: 0.3,
                        random: true,
                    },
                    size: {
                        value: { min: 1, max: 3 },
                    },
                    links: {
                        enable: true,
                        distance: 150,
                        color: "#6366f1",
                        opacity: 0.2,
                        width: 1,
                    },
                    move: {
                        direction: "none",
                        enable: true,
                        outModes: {
                            default: "bounce",
                        },
                        random: false,
                        speed: 1, // Slow and steady
                        straight: false,
                    },
                },
                interactivity: {
                    events: {
                        onHover: {
                            enable: true,
                            mode: "grab",
                        },
                        onClick: {
                            enable: true,
                            mode: "push",
                        },
                        resize: true,
                    },
                    modes: {
                        grab: {
                            distance: 200,
                            links: {
                                opacity: 0.5,
                            },
                        },
                        push: {
                            quantity: 4,
                        },
                    },
                },
                detectRetina: true,
            }}
        />
    );
}
