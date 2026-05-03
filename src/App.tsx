import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, RotateCcw, Trophy, ArrowLeft, ArrowRight, Music, Volume2, VolumeX } from 'lucide-react';

// --- Constants ---
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const GRAVITY = 0.4;
const JUMP_FORCE = -12;
const SPEED = 5;
const PLATFORM_WIDTH = 60;
const PLATFORM_HEIGHT = 15;
const INITIAL_PLATFORMS = 10;
const PLAYER_SIZE = 30;

type GameState = 'MENU' | 'PLAYING' | 'GAMEOVER';

interface Platform {
  id: number;
  x: number;
  y: number;
  width: number;
}

interface Player {
  x: number;
  y: number;
  vy: number;
  vx: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('up_game_highscore');
    return saved ? parseInt(saved, 10) : 0;
  });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);
  const [muted, setMuted] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  // Game state refs
  const playerRef = useRef<Player & { isGrounded: boolean }>({ 
    x: CANVAS_WIDTH / 2 - PLAYER_SIZE / 2, 
    y: CANVAS_HEIGHT - 100, 
    vy: 0, 
    vx: 0,
    isGrounded: false 
  });
  const platformsRef = useRef<Platform[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const scrollOffsetRef = useRef(0);
  const nextPlatformYRef = useRef(0);
  const platformIdCounterRef = useRef(0);
  const particleIdCounterRef = useRef(0);

  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  const spawnParticles = (x: number, y: number, color: string, count: number = 8) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        id: particleIdCounterRef.current++,
        x,
        y: y - scrollOffsetRef.current,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        life: 1.0,
        color
      });
    }
  };

  const initGame = useCallback(() => {
    playerRef.current = { 
      x: CANVAS_WIDTH / 2 - PLAYER_SIZE / 2, 
      y: CANVAS_HEIGHT - 150, 
      vy: 0, 
      vx: 0,
      isGrounded: false 
    };
    scrollOffsetRef.current = 0;
    setScore(0);
    particlesRef.current = [];
    
    const initialPlatforms: Platform[] = [
      { id: platformIdCounterRef.current++, x: CANVAS_WIDTH / 2 - PLATFORM_WIDTH / 2, y: CANVAS_HEIGHT - 50, width: PLATFORM_WIDTH * 2 }
    ];
    
    let currentY = CANVAS_HEIGHT - 50;
    for (let i = 0; i < INITIAL_PLATFORMS; i++) {
      currentY -= 120;
      initialPlatforms.push({
        id: platformIdCounterRef.current++,
        x: Math.random() * (CANVAS_WIDTH - PLATFORM_WIDTH),
        y: currentY,
        width: PLATFORM_WIDTH,
      });
    }
    platformsRef.current = initialPlatforms;
    nextPlatformYRef.current = currentY;
  }, []);

  const handleKeyDown = (e: KeyboardEvent) => {
    keysRef.current[e.code] = true;
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    keysRef.current[e.code] = false;
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const spawnPlatform = () => {
    nextPlatformYRef.current -= (80 + Math.random() * 80);
    const newPlatform: Platform = {
      id: platformIdCounterRef.current++,
      x: Math.random() * (CANVAS_WIDTH - PLATFORM_WIDTH),
      y: nextPlatformYRef.current,
      width: PLATFORM_WIDTH,
    };
    platformsRef.current.push(newPlatform);
    if (platformsRef.current.length > 20) {
      platformsRef.current.shift();
    }
  };

  const update = () => {
    const player = playerRef.current;
    
    // Horizontal Movement
    if (keysRef.current['ArrowLeft']) player.vx = -SPEED;
    else if (keysRef.current['ArrowRight']) player.vx = SPEED;
    else player.vx = 0;

    // Movement & Gravity
    player.x += player.vx;
    player.y += player.vy;
    
    if (!player.isGrounded) {
      player.vy += GRAVITY;
    }

    // Manual Jump on PC
    if (!isTouchDevice && player.isGrounded && (keysRef.current['Space'] || keysRef.current['ArrowUp'] || keysRef.current['KeyW'])) {
      player.vy = JUMP_FORCE;
      player.isGrounded = false;
    }

    // Boundary Wrapping
    if (player.x + PLAYER_SIZE < 0) player.x = CANVAS_WIDTH;
    if (player.x > CANVAS_WIDTH) player.x = -PLAYER_SIZE;

    // Platform Collisions (only when falling)
    let foundPlatform = false;
    if (player.vy >= 0) {
      platformsRef.current.forEach(platform => {
        if (
          player.x + PLAYER_SIZE > platform.x &&
          player.x < platform.x + platform.width &&
          player.y + PLAYER_SIZE > platform.y &&
          player.y + PLAYER_SIZE < platform.y + PLATFORM_HEIGHT + Math.max(player.vy, 5)
        ) {
          if (isTouchDevice) {
            // Auto Jump for Mobile/Touch
            player.y = platform.y - PLAYER_SIZE;
            player.vy = JUMP_FORCE;
            spawnParticles(player.x + PLAYER_SIZE / 2, platform.y, '#10b981');
          } else {
            // Land on platform for PC
            player.y = platform.y - PLAYER_SIZE;
            player.vy = 0;
            player.isGrounded = true;
            foundPlatform = true;
          }
        }
      });
    }

    if (!isTouchDevice && !foundPlatform) {
      player.isGrounded = false;
    }

    // Camera/Scrolling
    const screenY = player.y + scrollOffsetRef.current;
    if (screenY < 250) {
      const diff = 250 - screenY;
      scrollOffsetRef.current += diff;
      setScore(prev => Math.max(prev, Math.floor(scrollOffsetRef.current / 10)));
    }

    // Spawn new platforms
    if (platformsRef.current[platformsRef.current.length - 1].y + scrollOffsetRef.current > -100) {
      spawnPlatform();
    }

    // Update Particles
    particlesRef.current.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.02;
    });
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);

    // Game Over Check
    if (player.y + scrollOffsetRef.current > CANVAS_HEIGHT + 100) {
      setGameState('GAMEOVER');
    }
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const scrollOffset = scrollOffsetRef.current;

    // Draw Background
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#0f172a');
    gradient.addColorStop(1, '#1e293b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Stars
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    for(let i = 0; i < 50; i++) {
        const x = (Math.sin(i * 123) * 0.5 + 0.5) * CANVAS_WIDTH;
        const y = ((Math.cos(i * 456) * 0.5 + 0.5) * CANVAS_HEIGHT + scrollOffset * 0.2) % CANVAS_HEIGHT;
        ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill();
    }

    // Draw Platforms
    platformsRef.current.forEach(platform => {
      const py = platform.y + scrollOffset;
      if (py > -50 && py < CANVAS_HEIGHT + 50) {
        ctx.fillStyle = '#10b981';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#10b981';
        ctx.beginPath();
        ctx.roundRect(platform.x, py, platform.width, PLATFORM_HEIGHT, 5);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#059669';
        ctx.fillRect(platform.x, py + PLATFORM_HEIGHT - 4, platform.width, 4);
      }
    });

    // Draw Particles
    particlesRef.current.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y + scrollOffset, 2, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // Draw Player
    const player = playerRef.current;
    const py = player.y + scrollOffset;
    ctx.save();
    ctx.translate(player.x + PLAYER_SIZE / 2, py + PLAYER_SIZE / 2);
    const scaleY = 1 - Math.min(Math.abs(player.vy) * 0.02, 0.3);
    const scaleX = 1 + Math.min(Math.abs(player.vy) * 0.02, 0.3);
    ctx.scale(scaleX, scaleY);
    ctx.fillStyle = '#f59e0b';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#f59e0b';
    ctx.beginPath();
    ctx.roundRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE, 8);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000';
    const eyeOffset = player.vx > 0 ? 5 : (player.vx < 0 ? -5 : 0);
    ctx.beginPath(); ctx.arc(-6 + eyeOffset, -4, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(6 + eyeOffset, -4, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  const loop = () => {
    if (gameState === 'PLAYING') {
      update();
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) draw(ctx);
      requestRef.current = requestAnimationFrame(loop);
    }
  };

  useEffect(() => {
    if (gameState === 'PLAYING') {
      requestRef.current = requestAnimationFrame(loop);
    } else if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'GAMEOVER') {
      if (score > highScore) {
        setHighScore(score);
        localStorage.setItem('up_game_highscore', score.toString());
      }
    }
  }, [gameState, score, highScore]);

  const startGame = () => {
    initGame();
    setGameState('PLAYING');
  };

  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center font-sans text-white overflow-hidden select-none touch-none">
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500 rounded-full blur-[128px]" />
      </div>

      <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-4">
        {/* Responsive Canvas Container */}
        <div 
          className="relative aspect-[2/3] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-white/10"
          style={{ 
            height: 'min(90vh, 100%)', 
            width: 'auto',
            maxHeight: '800px'
          }}
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="w-full h-full block object-contain"
          />

          {/* mobile controls overlays */}
          {gameState === 'PLAYING' && isTouchDevice && (
            <div className="absolute inset-0 pointer-events-none flex items-end p-6 gap-4">
              <div className="flex-1 h-32 flex gap-4 pointer-events-auto">
                <button 
                  onPointerDown={() => keysRef.current['ArrowLeft'] = true}
                  onPointerUp={() => keysRef.current['ArrowLeft'] = false}
                  onPointerLeave={() => keysRef.current['ArrowLeft'] = false}
                  className="flex-1 bg-white/10 active:bg-white/30 backdrop-blur-md rounded-2xl flex items-center justify-center transition-colors"
                >
                  <ArrowLeft size={32} />
                </button>
                <button 
                  onPointerDown={() => keysRef.current['ArrowRight'] = true}
                  onPointerUp={() => keysRef.current['ArrowRight'] = false}
                  onPointerLeave={() => keysRef.current['ArrowRight'] = false}
                  className="flex-1 bg-white/10 active:bg-white/30 backdrop-blur-md rounded-2xl flex items-center justify-center transition-colors"
                >
                  <ArrowRight size={32} />
                </button>
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            {gameState === 'MENU' && (
              <motion.div 
                key="menu"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm p-8 text-center"
              >
                <motion.div initial={{ y: -20 }} animate={{ y: 0 }}>
                  <h1 className="text-7xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 mb-2">UP!</h1>
                  <p className="text-slate-400 font-medium tracking-widest uppercase text-[10px] mb-12">Platform Jumper</p>
                </motion.div>

                <div className="space-y-4 w-full">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={startGame}
                    className="w-full py-5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-3 transition-colors shadow-lg"
                  >
                    <Play size={24} fill="currentColor" />
                    PLAY NOW
                  </motion.button>
                  
                  <div className="flex gap-4">
                    <div className="flex-1 p-4 bg-slate-800/50 rounded-xl border border-white/5">
                      <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">High Score</p>
                      <p className="text-2xl font-mono font-bold text-emerald-400">{highScore}</p>
                    </div>
                  </div>
                </div>

                {!isTouchDevice && (
                  <div className="mt-12 text-slate-500 text-xs flex flex-col gap-2 opacity-60">
                    <div className="flex items-center justify-center gap-4 uppercase font-bold tracking-tighter">
                      <span>Arrows to Move</span>
                      <span className="w-1 h-1 bg-slate-700 rounded-full" />
                      <span>Space to Jump</span>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {gameState === 'PLAYING' && (
              <motion.div 
                key="hud"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start pointer-events-none"
              >
                <div>
                  <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-1">Score</p>
                  <p className="text-4xl font-mono font-black italic">{score}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-1">Best</p>
                  <p className="text-xl font-mono font-bold opacity-60">{highScore}</p>
                </div>
              </motion.div>
            )}

            {gameState === 'GAMEOVER' && (
              <motion.div 
                key="gameover"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/90 backdrop-blur-md p-8 text-center"
              >
                <div className="mb-8">
                  <h2 className="text-5xl font-black italic text-white mb-2 uppercase tracking-tighter">Fallen!</h2>
                  <p className="text-red-300/60 font-medium tracking-widest uppercase text-[10px]">Game Over</p>
                </div>

                <div className="bg-white/5 rounded-2xl p-6 w-full mb-8 border border-white/10">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-white/40 uppercase text-xs font-bold tracking-widest">Score</span>
                    <span className="text-3xl font-mono font-black italic">{score}</span>
                  </div>
                  <div className="h-[1px] bg-white/10 w-full mb-4" />
                  <div className="flex justify-between items-center">
                    <span className="text-white/40 uppercase text-xs font-bold tracking-widest">Personal Best</span>
                    <span className="text-xl font-mono font-bold text-yellow-500">{highScore}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 w-full">
                  <button onClick={startGame} className="w-full py-4 bg-white text-slate-950 font-bold rounded-xl hover:bg-slate-200 transition-colors uppercase tracking-widest text-sm">Restart</button>
                  <button onClick={() => setGameState('MENU')} className="w-full py-4 bg-transparent text-white font-bold rounded-xl hover:bg-white/10 transition-colors uppercase tracking-widest text-[10px]">Main Menu</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Watermark */}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none opacity-20">
            <p className="text-[10px] font-black tracking-[0.3em] uppercase text-white">
              By Tanishk
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
