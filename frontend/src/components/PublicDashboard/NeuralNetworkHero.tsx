import { useEffect, useRef } from 'react';

export function NeuralNetworkHero() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const mouseRef = useRef({ x: -999, y: -999 });
    const nodesRef = useRef<Array<{
        x: number; y: number; vx: number; vy: number;
        r: number; pulse: number; color: string;
    }>>([]);
    const animationRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const colors = ['#6366f1', '#0ea5e9', '#4f46e5', '#0284c7', '#818cf8', '#38bdf8'];

        const resize = () => {
            if (!canvas) return;
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            initNodes();
        };

        const initNodes = () => {
            if (!canvas) return;
            const count = Math.floor((canvas.width * canvas.height) / 4500);
            nodesRef.current = Array.from({ length: count }, () => ({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.38,
                vy: (Math.random() - 0.5) * 0.38,
                r: Math.random() * 2.2 + 1.2,
                pulse: Math.random() * Math.PI * 2,
                color: colors[Math.floor(Math.random() * colors.length)],
            }));
        };

        const animate = () => {
            if (!canvas || !ctx) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            nodesRef.current.forEach(n => {
                n.x += n.vx;
                n.y += n.vy;
                n.pulse += 0.022;
                if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
                if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
                const dx = mouseRef.current.x - n.x;
                const dy = mouseRef.current.y - n.y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < 150) {
                    const force = (150 - d) / 150 * 0.45;
                    n.x -= (dx / d) * force;
                    n.y -= (dy / d) * force;
                }
            });

            // Connexions
            for (let i = 0; i < nodesRef.current.length; i++) {
                for (let j = i + 1; j < nodesRef.current.length; j++) {
                    const a = nodesRef.current[i];
                    const b = nodesRef.current[j];
                    const dx = a.x - b.x;
                    const dy = a.y - b.y;
                    const d = Math.sqrt(dx * dx + dy * dy);
                    if (d < 140) {
                        const alpha = (1 - d / 140) * 0.45;
                        const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
                        g.addColorStop(0, `rgba(99,102,241,${alpha})`);
                        g.addColorStop(1, `rgba(14,165,233,${alpha})`);
                        ctx.strokeStyle = g;
                        ctx.lineWidth = 0.65;
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.stroke();
                    }
                }
            }

            // Nœuds
            nodesRef.current.forEach(n => {
                const glow = 0.5 + 0.5 * Math.sin(n.pulse);
                const r = n.r + n.r * 0.18 * Math.sin(n.pulse);

                ctx.beginPath();
                ctx.arc(n.x, n.y, r * 2.4, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(99,102,241,${glow * 0.1})`;
                ctx.fill();

                ctx.beginPath();
                ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
                ctx.fillStyle = n.color;
                ctx.fill();

                ctx.beginPath();
                ctx.arc(n.x - r * 0.2, n.y - r * 0.2, r * 0.28, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,255,255,${0.28 + glow * 0.28})`;
                ctx.fill();
            });

            animationRef.current = requestAnimationFrame(animate);
        };

        const ro = new ResizeObserver(resize);
        ro.observe(canvas);

        const onMove = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        };
        const onLeave = () => { mouseRef.current = { x: -999, y: -999 }; };

        window.addEventListener('mousemove', onMove);
        canvas.addEventListener('mouseleave', onLeave);
        resize();
        animate();

        return () => {
            ro.disconnect();
            window.removeEventListener('mousemove', onMove);
            canvas.removeEventListener('mouseleave', onLeave);
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ pointerEvents: 'none' }}
        />
    );
}