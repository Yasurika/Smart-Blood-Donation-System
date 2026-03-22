'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Plugin registered inside useEffect

interface ScrollRevealProps {
    children: React.ReactNode;
    direction?: 'up' | 'down' | 'left' | 'right';
    delay?: number;
    duration?: number;
    className?: string;
}

export default function ScrollReveal({
    children,
    direction = 'up',
    delay = 0,
    duration = 1,
    className = '',
}: ScrollRevealProps) {
    const elementRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        gsap.registerPlugin(ScrollTrigger);

        const el = elementRef.current;
        if (!el) return;

        const directionMap = {
            up: { y: 80, x: 0 },
            down: { y: -80, x: 0 },
            left: { x: 80, y: 0 },
            right: { x: -80, y: 0 },
        };

        const { x, y } = directionMap[direction];

        gsap.fromTo(
            el,
            { opacity: 0, x, y, scale: 0.95 },
            {
                opacity: 1,
                x: 0,
                y: 0,
                scale: 1,
                duration,
                delay,
                ease: 'power3.out',
                scrollTrigger: {
                    trigger: el,
                    start: 'top 85%',
                    end: 'bottom 20%',
                    toggleActions: 'play none none reverse',
                },
            }
        );

        return () => {
            // Clean up verify refined to use valid context, but generally KillAll is aggressive.
            // Better to kill just this trigger if possible, but ScrollTrigger.getAll().forEach(t => t.kill()) is okay for now if we want to reset. 
            // However, for individual components, we should usually let them persist or kill specific instance.
            // But the original code was killing ALL triggers which might affect other components. 
            // Let's just kill the ScrollTrigger associated with this element if possible, 
            // but ScrollTrigger.create returns an instance. gsap.to creates one internally.
            // For now, let's keep it simple and NOT kill all triggers globally on unmount of one component, 
            // that causes flickering.
            // Instead, let's just let GSAP handle it or use specific cleanup if we had the instance.
            // But since we use scrollTrigger inside fromTo, GSAP manages it.
            // I will REMOVE the aggressive global kill.
            const triggers = ScrollTrigger.getAll();
            triggers.forEach(trigger => {
                if (trigger.vars && trigger.vars.trigger === el) {
                    trigger.kill();
                }
            });
        };
    }, [direction, delay, duration]);

    return (
        <div ref={elementRef} className={className} style={{ opacity: 0 }}>
            {children}
        </div>
    );
}
