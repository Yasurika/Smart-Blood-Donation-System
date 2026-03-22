'use client';

import { useEffect, useRef, useState } from 'react';

export default function CustomCursor() {
    const cursorRef = useRef<HTMLDivElement>(null);
    const cursorDotRef = useRef<HTMLDivElement>(null);
    const [isHovering, setIsHovering] = useState(false);
    const [isClicking, setIsClicking] = useState(false);
    const posRef = useRef({ x: 0, y: 0 });
    const targetRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const cursor = cursorRef.current;
        const cursorDot = cursorDotRef.current;
        if (!cursor || !cursorDot) return;

        const handleMouseMove = (e: MouseEvent) => {
            targetRef.current = { x: e.clientX, y: e.clientY };
            cursorDot.style.left = `${e.clientX}px`;
            cursorDot.style.top = `${e.clientY}px`;
        };

        const handleMouseDown = () => setIsClicking(true);
        const handleMouseUp = () => setIsClicking(false);

        const handleMouseOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (
                target.tagName === 'A' ||
                target.tagName === 'BUTTON' ||
                target.closest('a') ||
                target.closest('button') ||
                target.dataset.cursor === 'pointer'
            ) {
                setIsHovering(true);
            }
        };

        const handleMouseOut = () => setIsHovering(false);

        // Smooth cursor animation
        let animationFrameId: number;
        const animate = () => {
            const speed = 0.15;
            posRef.current.x += (targetRef.current.x - posRef.current.x) * speed;
            posRef.current.y += (targetRef.current.y - posRef.current.y) * speed;
            cursor.style.left = `${posRef.current.x}px`;
            cursor.style.top = `${posRef.current.y}px`;
            animationFrameId = requestAnimationFrame(animate);
        };
        animate();

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('mouseover', handleMouseOver);
        document.addEventListener('mouseout', handleMouseOut);

        return () => {
            cancelAnimationFrame(animationFrameId);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('mouseover', handleMouseOver);
            document.removeEventListener('mouseout', handleMouseOut);
        };
    }, []);

    return (
        <>
            {/* Main cursor ring */}
            <div
                ref={cursorRef}
                className="custom-cursor"
                style={{
                    width: isHovering ? '60px' : isClicking ? '25px' : '40px',
                    height: isHovering ? '60px' : isClicking ? '25px' : '40px',
                    borderColor: isHovering ? '#ff2d55' : 'rgba(220, 38, 38, 0.6)',
                    backgroundColor: isHovering ? 'rgba(255, 45, 85, 0.1)' : 'transparent',
                }}
            />
            {/* Center dot */}
            <div
                ref={cursorDotRef}
                className="cursor-dot"
                style={{
                    width: isClicking ? '12px' : '8px',
                    height: isClicking ? '12px' : '8px',
                    backgroundColor: '#ff2d55',
                }}
            />
        </>
    );
}
