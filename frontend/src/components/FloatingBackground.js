import React, { useEffect, useRef } from 'react';

const PALETTE = [
  'rgba(5,150,105,0.12)',
  'rgba(16,185,129,0.1)',
  'rgba(110,231,183,0.08)',
  'rgba(99,102,241,0.08)',
  'rgba(52,211,153,0.18)',
  'rgba(5,150,105,0.06)'
];

const SHAPES = ['circle', 'triangle', 'square', 'ring', 'hexagon'];

function createItems(width, height, count) {
  const items = [];
  for (let index = 0; index < count; index += 1) {
    items.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: 8 + Math.random() * 18,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.01,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      type: SHAPES[Math.floor(Math.random() * SHAPES.length)]
    });
  }
  return items;
}

function drawCircle(ctx, item) {
  ctx.fillStyle = item.color;
  ctx.beginPath();
  ctx.arc(0, 0, item.size * 0.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawTriangle(ctx, item) {
  const size = item.size * 0.65;
  ctx.fillStyle = item.color;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size, size);
  ctx.lineTo(-size, size);
  ctx.closePath();
  ctx.fill();
}

function drawSquare(ctx, item) {
  const size = item.size * 0.95;
  ctx.fillStyle = item.color;
  ctx.fillRect(-size / 2, -size / 2, size, size);
}

function drawRing(ctx, item) {
  const radius = item.size * 0.5;
  ctx.strokeStyle = item.color;
  ctx.lineWidth = Math.max(1.5, item.size * 0.12);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();
}

function drawHexagon(ctx, item) {
  const radius = item.size * 0.55;
  ctx.fillStyle = item.color;
  ctx.beginPath();
  for (let edge = 0; edge < 6; edge += 1) {
    const angle = (Math.PI / 3) * edge;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (edge === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.fill();
}

export default function FloatingBackground({ className = '' }) {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const itemsRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const context = canvas.getContext('2d');

    const resize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      const targetCount = Math.max(36, Math.floor((width * height) / 26000));
      itemsRef.current = createItems(width, height, targetCount);
    };

    const animate = () => {
      const { width, height } = canvas;
      context.clearRect(0, 0, width, height);

      itemsRef.current.forEach((item) => {
        item.x += item.vx;
        item.y += item.vy;
        item.rot += item.vrot;

        if (item.x < -item.size) item.x = width + item.size;
        if (item.x > width + item.size) item.x = -item.size;
        if (item.y < -item.size) item.y = height + item.size;
        if (item.y > height + item.size) item.y = -item.size;

        context.save();
        context.translate(item.x, item.y);
        context.rotate(item.rot);
        if (item.type === 'circle') drawCircle(context, item);
        if (item.type === 'triangle') drawTriangle(context, item);
        if (item.type === 'square') drawSquare(context, item);
        if (item.type === 'ring') drawRing(context, item);
        if (item.type === 'hexagon') drawHexagon(context, item);
        context.restore();
      });

      frameRef.current = window.requestAnimationFrame(animate);
    };

    resize();
    animate();
    window.addEventListener('resize', resize);

    return () => {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
      }
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className={`floating-bg ${className}`} aria-hidden="true" />;
}
