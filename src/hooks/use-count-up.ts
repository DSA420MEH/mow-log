import { useState, useEffect, useRef } from "react";

export function useCountUp(end: number, duration: number = 2000) {
    const [count, setCount] = useState(0);
    const hasAnimated = useRef(false);
    const elementRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!elementRef.current || hasAnimated.current || end === 0) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    hasAnimated.current = true;
                    observer.disconnect();

                    let startTimestamp: number | null = null;
                    const step = (timestamp: number) => {
                        if (!startTimestamp) startTimestamp = timestamp;
                        const progress = Math.min((timestamp - startTimestamp) / duration, 1);

                        // easeOutExpo
                        const easeOut = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

                        setCount(end * easeOut);
                        if (progress < 1) {
                            window.requestAnimationFrame(step);
                        } else {
                            setCount(end);
                        }
                    };
                    window.requestAnimationFrame(step);
                }
            },
            { threshold: 0.1 }
        );

        observer.observe(elementRef.current);

        return () => observer.disconnect();
    }, [end, duration]);

    return { count, ref: elementRef };
}
