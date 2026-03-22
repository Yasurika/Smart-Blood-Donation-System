'use client';

import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';
import { useTheme } from 'next-themes';

function BloodCell({ position, scale, speed, color, emissive, isDark }: { position: [number, number, number]; scale: number; speed: number, color: string, emissive: string, isDark: boolean }) {
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (!meshRef.current) return;
        meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * speed * 0.3) * 0.5;
        meshRef.current.rotation.z = Math.cos(state.clock.elapsedTime * speed * 0.2) * 0.3;
        meshRef.current.position.y += Math.sin(state.clock.elapsedTime * speed) * 0.002;
    });

    return (
        <Float speed={speed} rotationIntensity={0.5} floatIntensity={1.5}>
            <mesh ref={meshRef} position={position} scale={scale}>
                <torusGeometry args={[1, 0.4, 16, 32]} />
                <meshStandardMaterial
                    color={color}
                    roughness={isDark ? 0.3 : 0.15}
                    metalness={isDark ? 0.6 : 0.75}
                    transparent
                    opacity={isDark ? 0.7 : 0.92}
                    emissive={emissive}
                    emissiveIntensity={isDark ? 0.3 : 0.6}
                />
            </mesh>
        </Float>
    );
}

function Particles({ count = 80, color, isDark }: { count?: number; color: string, isDark?: boolean }) {
    const particlesRef = useRef<THREE.Points>(null);

    const positions = useMemo(() => {
        const arr = new Float32Array(count * 3);
        for (let i = 0; i < count * 3; i++) {
            arr[i] = (Math.random() - 0.5) * 20;
        }
        return arr;
    }, [count]);

    const colors = useMemo(() => {
        const arr = new Float32Array(count * 3);
        const c = new THREE.Color(color);
        for (let i = 0; i < count; i++) {
            const shade = isDark ? 1 : 0.85 + Math.random() * 0.15;
            arr[i * 3] = c.r * shade;
            arr[i * 3 + 1] = c.g * shade;
            arr[i * 3 + 2] = c.b * shade;
        }
        return arr;
    }, [count, color, isDark]);

    useFrame((state) => {
        if (!particlesRef.current) return;
        particlesRef.current.rotation.y = state.clock.elapsedTime * 0.02;
        particlesRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.01) * 0.1;
    });

    return (
        <points ref={particlesRef}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    args={[positions, 3]}
                />
                <bufferAttribute
                    attach="attributes-color"
                    args={[colors, 3]}
                />
            </bufferGeometry>
            <pointsMaterial
                size={isDark ? 0.05 : 0.08}
                vertexColors
                transparent
                opacity={isDark ? 0.6 : 0.7}
                sizeAttenuation
                blending={THREE.AdditiveBlending}
            />
        </points>
    );
}

function Scene({ isDark }: { isDark: boolean }) {
    const cells = useMemo(() => {
        return Array.from({ length: isDark ? 8 : 10 }, (_, i) => ({
            position: [
                (Math.random() - 0.5) * 15,
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 8 - 3,
            ] as [number, number, number],
            scale: 0.15 + Math.random() * 0.25,
            speed: 0.5 + Math.random() * 1.5,
            key: i,
        }));
    }, [isDark]);

    // Enhanced Light Mode: Vibrant gradient with premium colors
    // Dark: Standard Void
    const fogColor = isDark ? '#0a0a0a' : '#ffffff';

    // Light Mode: Vibrant Rose to Purple gradient
    const cellColor = isDark ? '#dc2626' : '#ec4899'; // Hot pink
    const emissiveColor = isDark ? '#991b1b' : '#f472b6'; // Bright rose
    const particleColor = isDark ? '#ffaaaa' : '#f91880'; // Vibrant magenta

    return (
        <>
            <ambientLight intensity={isDark ? 0.3 : 1.2} />

            {isDark ? (
                <>
                    <pointLight position={[10, 10, 10]} intensity={1} color="#ff4444" />
                    <pointLight position={[-10, -10, -5]} intensity={0.5} color="#ff6666" />
                </>
            ) : (
                // Light Mode: Premium multi-directional lighting
                <>
                    <pointLight position={[15, 15, 10]} intensity={1.2} color="#ff69b4" />
                    <pointLight position={[-15, 10, -5]} intensity={0.9} color="#ff1493" />
                    <pointLight position={[0, -10, 10]} intensity={0.8} color="#ffb6c1" />
                    <directionalLight position={[0, 20, 5]} intensity={0.9} color="#ffffff" />
                </>
            )}

            <fog attach="fog" args={[fogColor, 5, isDark ? 20 : 25]} />

            {cells.map((cell) => (
                <BloodCell
                    key={cell.key}
                    position={cell.position}
                    scale={cell.scale}
                    speed={cell.speed}
                    color={cellColor}
                    emissive={emissiveColor}
                    isDark={isDark}
                />
            ))}

            <Particles count={isDark ? 120 : 150} color={particleColor} isDark={isDark} />
        </>
    );
}

export default function BloodCellsBackground() {
    const [mounted, setMounted] = useState(false);
    const { resolvedTheme } = useTheme();

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return <div className="fixed inset-0 -z-10 bg-white dark:bg-[#0a0a0a]" />;

    const isDark = resolvedTheme === 'dark';

    return (
        <div className="fixed inset-0 -z-10 transition-colors duration-700">
            {/* Gradient background overlay */}
            <div className={`absolute inset-0 transition-all duration-700 ${
                isDark 
                    ? 'bg-[#0a0a0a]' 
                    : 'bg-gradient-to-br from-white via-pink-50 to-purple-50'
            }`} />

            {/* Light mode: Animated gradient mesh */}
            {!isDark && (
                <div className="absolute inset-0 overflow-hidden opacity-40">
                    <div className="absolute top-0 left-10 w-96 h-96 bg-gradient-to-br from-pink-300 via-purple-300 to-transparent rounded-full blur-3xl animate-pulse" />
                    <div className="absolute bottom-0 right-10 w-80 h-80 bg-gradient-to-tl from-rose-300 via-pink-200 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                    <div className="absolute top-1/2 left-1/2 w-72 h-72 bg-gradient-to-br from-purple-200 via-pink-200 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
                </div>
            )}

            {/* Subtle dot pattern for light mode */}
            {!isDark && (
                <div className="absolute inset-0 opacity-[0.15]"
                    style={{
                        backgroundImage: 'radial-gradient(#ec4899 0.8px, transparent 0.8px)',
                        backgroundSize: '28px 28px'
                    }}
                />
            )}

            <Canvas
                camera={{ position: [0, 0, 6], fov: 60 }}
                gl={{ antialias: true, alpha: true }}
                style={{ background: 'transparent' }}
            >
                <Scene isDark={isDark} />
            </Canvas>

            {/* Enhanced gradient overlays */}
            <div className={`absolute inset-0 pointer-events-none transition-opacity duration-700 ${
                isDark
                    ? 'bg-gradient-to-b from-transparent via-black/40 to-black/80 opacity-100'
                    : 'bg-gradient-to-b from-white/20 via-transparent to-purple-100/20 opacity-100'
            }`} />

            {/* Additional shine effect for light mode */}
            {!isDark && (
                <div className="absolute inset-0 pointer-events-none opacity-30"
                    style={{
                        backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,192,203,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(216,180,254,0.2) 0%, transparent 50%)',
                    }}
                />
            )}
        </div>
    );
}
