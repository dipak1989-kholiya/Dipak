import { useState, useRef, useEffect, useCallback, MouseEvent, TouchEvent, FormEvent } from 'react';
import { Camera, Image as ImageIcon, Type, Play, Square, Settings, Upload, X, Plus, Sliders, ChevronDown, ChevronUp, Users, Clock, Calendar, Globe, Video } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import AdBanner from './components/AdBanner';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Hls from 'hls.js';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type StreamDestination = {
  id: string;
  name: string;
  protocol: 'RTMP' | 'UDP';
  serverUrl: string;
  streamKey: string;
  enabled: boolean;
  status: 'disconnected' | 'connecting' | 'streaming' | 'error';
  errorMessage?: string;
};

type StreamOverlay = {
  id: string;
  type: 'image' | 'text' | 'video' | 'clock' | 'date' | 'datetime';
  content: string;
  size: number;
  x: number;
  y: number;
  rotation: number;
  color?: string;
  opacity?: number;
  volume?: number;
};

const STORAGE_KEY = 'live_stream_settings';

export default function StreamApp({ token, username, onLogout }: { token: string; username: string; onLogout: () => void }) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [destinations, setDestinations] = useState<StreamDestination[]>([
    {
      id: 'youtube',
      name: 'YouTube',
      protocol: 'RTMP',
      serverUrl: 'rtmps://a.rtmps.youtube.com/live2',
      streamKey: '••••-••••-••••-••••',
      enabled: true,
      status: 'disconnected'
    },
    {
      id: 'facebook',
      name: 'Facebook Live',
      protocol: 'RTMP',
      serverUrl: 'rtmps://live-api-s.facebook.com:443/rtmp/',
      streamKey: '••••-••••-••••-••••',
      enabled: false,
      status: 'disconnected'
    }
  ]);
  const [tickerText, setTickerText] = useState('Welcome to my Live Stream! 🚀');
  const [tickerSpeed, setTickerSpeed] = useState(2);
  const [tickerHeightPercent, setTickerHeightPercent] = useState(8);
  const [tickerYPercent, setTickerYPercent] = useState(92);
  const [tempTickerHeight, setTempTickerHeight] = useState(8);
  const [tempTickerY, setTempTickerY] = useState(92);
  const [tickerTextColor, setTickerTextColor] = useState('#ffffff');
  const [tickerBgColor, setTickerBgColor] = useState('rgba(0, 0, 0, 0.6)');
  const [overlays, setOverlays] = useState<StreamOverlay[]>([]);
  const [draggingImageId, setDraggingImageId] = useState<string | null>(null);
  const [resizingImageId, setResizingImageId] = useState<string | null>(null);
  const [rotatingImageId, setRotatingImageId] = useState<string | null>(null);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [hoveredOverlayId, setHoveredOverlayId] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [activeTab, setActiveTab] = useState<'stream' | 'overlays' | 'ticker' | 'adjust' | 'timer'>('stream');
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [streamSource, setStreamSource] = useState<'camera' | 'videoFile' | 'url'>('camera');
  const [fallbackVideoSrc, setFallbackVideoSrc] = useState<string | null>(null);
  const [inputUrl, setInputUrl] = useState('');

  // Countdown timer states
  const [countdownDuration, setCountdownDuration] = useState<number>(5 * 60);
  const [countdownRemaining, setCountdownRemaining] = useState<number>(5 * 60);
  const [isCountdownActive, setIsCountdownActive] = useState<boolean>(false);
  const [isCountdownPaused, setIsCountdownPaused] = useState<boolean>(false);
  const [showCountdownOnStream, setShowCountdownOnStream] = useState<boolean>(false);
  const [idealWidth, setIdealWidth] = useState(1280);
  const [idealHeight, setIdealHeight] = useState(720);
  const [idealFrameRate, setIdealFrameRate] = useState(30);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [users, setUsers] = useState<{id: number, username: string}[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [userError, setUserError] = useState('');
  const [streamStats, setStreamStats] = useState<Record<string, { bitrate: number; uptime: number; fps: number }>>({});
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [hasError, setHasError] = useState<string | null>(null);

  // Load settings on startup
  useEffect(() => {
    const loadUsers = async () => {
      if (username !== 'admin') return;
      try {
        const res = await fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          setUsers(await res.json());
        }
      } catch (e) {}
    };

    const loadData = async () => {
      // Load from backend
      try {
        const response = await fetch("/api/destinations", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.status === 401) {
          onLogout();
          return;
        }
        if (response.ok) {
          const backendDestinations = await response.json();
          if (backendDestinations.length > 0) {
            setDestinations(backendDestinations.map((d: any) => ({ ...d, status: 'disconnected' })));
          }
        }
      } catch (e) {
        console.error("Failed to load destinations from backend", e);
      }

      // Load other settings from localStorage
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const settings = JSON.parse(saved);
          if (settings.tickerText !== undefined) setTickerText(settings.tickerText);
          if (settings.tickerSpeed !== undefined) setTickerSpeed(settings.tickerSpeed);
          if (settings.tickerHeightPercent !== undefined) {
            setTickerHeightPercent(settings.tickerHeightPercent);
            setTempTickerHeight(settings.tickerHeightPercent);
          }
          if (settings.tickerYPercent !== undefined) {
            setTickerYPercent(settings.tickerYPercent);
            setTempTickerY(settings.tickerYPercent);
          }
          if (settings.tickerTextColor !== undefined) setTickerTextColor(settings.tickerTextColor);
          if (settings.tickerBgColor !== undefined) setTickerBgColor(settings.tickerBgColor);
          if (settings.overlays !== undefined) {
            setOverlays(settings.overlays);
          } else if (settings.imageOverlays !== undefined) {
            const migrated: StreamOverlay[] = settings.imageOverlays.map((img: any) => ({ ...img, type: 'image', content: img.src }));
            if (settings.overlayText) {
              migrated.push({
                id: 'legacy-text',
                type: 'text',
                content: settings.overlayText,
                size: settings.overlayTextSize / 10,
                x: settings.overlayTextX,
                y: settings.overlayTextY,
                rotation: 0,
                color: settings.overlayTextColor
              });
            }
            setOverlays(migrated);
          }
          if (settings.cameraFacing !== undefined) setCameraFacing(settings.cameraFacing);
          if (settings.idealWidth !== undefined) setIdealWidth(settings.idealWidth);
          if (settings.idealHeight !== undefined) setIdealHeight(settings.idealHeight);
          if (settings.idealFrameRate !== undefined) setIdealFrameRate(settings.idealFrameRate);
          if (settings.brightness !== undefined) setBrightness(settings.brightness);
          if (settings.contrast !== undefined) setContrast(settings.contrast);
          if (settings.saturation !== undefined) setSaturation(settings.saturation);
          if (settings.streamSource !== undefined) setStreamSource(settings.streamSource);
          if (settings.inputUrl !== undefined) setInputUrl(settings.inputUrl);
        } catch (e) {
          console.error("Failed to load settings", e);
        }
      }
    };
    loadData();
    loadUsers();
  }, [token, username, onLogout]);

  // Save settings on changes
  useEffect(() => {
    const settings = {
      destinations,
      tickerText,
      tickerSpeed,
      tickerHeightPercent,
      tickerYPercent,
      tickerTextColor,
      tickerBgColor,
      overlays,
      cameraFacing,
      idealWidth,
      idealHeight,
      idealFrameRate,
      brightness,
      contrast,
      saturation,
      streamSource,
      inputUrl
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [
    destinations, tickerText, tickerSpeed, tickerHeightPercent, tickerYPercent,
    tickerTextColor, tickerBgColor, overlays, cameraFacing, idealWidth,
    idealHeight, idealFrameRate, brightness, contrast, saturation, streamSource, inputUrl
  ]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);
  const tickerOffsetRef = useRef<number | null>(null);
  const imageElementsRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const hlsRef = useRef<Hls | null>(null);
  const mediaRecordersRef = useRef<Map<string, { recorder: MediaRecorder; ws: WebSocket }>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const destNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const canvasStreamRef = useRef<MediaStream | null>(null);

  // Simulate Live Stats
  useEffect(() => {
    let interval: number;
    if (isStreaming) {
      interval = window.setInterval(() => {
        setStreamStats(prev => {
          const newStats: typeof streamStats = {};
          destinations.forEach(d => {
            if (d.status === 'streaming') {
              newStats[d.id] = {
                bitrate: Math.floor(4500 + Math.random() * 500),
                uptime: (prev[d.id]?.uptime || 0) + 1,
                fps: Math.floor(29 + Math.random() * 2)
              };
            }
          });
          return newStats;
        });
      }, 1000);
    } else {
      setStreamStats({});
    }
    return () => clearInterval(interval);
  }, [isStreaming, destinations]);

  // Initialize Camera
  const startCamera = useCallback(async (useBasicConstraints = false) => {
    setHasError(null);
    
    // Stop existing stream first to release the device
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setStream(prevStream => {
      if (prevStream) {
        prevStream.getTracks().forEach(track => track.stop());
      }
      return null;
    });

    if (streamSource === 'videoFile') {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        if (fallbackVideoSrc) {
          videoRef.current.src = fallbackVideoSrc;
          videoRef.current.loop = true;
          try {
            await videoRef.current.play();
          } catch (e) {
            console.warn("Auto-play prevented", e);
          }
        }
      }
      return;
    }

    if (streamSource === 'url') {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        if (inputUrl) {
          if (inputUrl.includes('.m3u8') && Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(inputUrl);
            hls.attachMedia(videoRef.current);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              videoRef.current?.play().catch(console.error);
            });
            hlsRef.current = hls;
          } else {
            videoRef.current.src = inputUrl;
            videoRef.current.crossOrigin = "anonymous";
            videoRef.current.loop = true;
            try {
              await videoRef.current.play();
            } catch (e) {
              console.warn("Auto-play prevented", e);
            }
          }
        }
      }
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setHasError("Your browser does not support camera access.");
      return;
    }

    try {
      const constraints = useBasicConstraints ? {
        video: { facingMode: cameraFacing },
        audio: true
      } : {
        video: { 
          facingMode: cameraFacing,
          width: { ideal: idealWidth },
          height: { ideal: idealHeight },
          frameRate: { ideal: idealFrameRate }
        },
        audio: true
      };
      
      try {
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        setStream(newStream);

        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
          try {
            await videoRef.current.play();
          } catch (e) {
            console.warn("Auto-play prevented", e);
          }
        }
        setHasError(null); // Success! Clear any persistent errors
      } catch (innerErr) {
        // If audio access was denied, try video only
        if (innerErr instanceof Error && (innerErr.name === 'NotAllowedError' || innerErr.message.toLowerCase().includes('permission denied'))) {
          console.log("Audio/Video combined denied, trying video only...");
          const videoOnlyConstraints = { ...constraints, audio: false };
          try {
            const videoOnlyStream = await navigator.mediaDevices.getUserMedia(videoOnlyConstraints);
            setStream(videoOnlyStream);
            if (videoRef.current) {
              videoRef.current.srcObject = videoOnlyStream;
              await videoRef.current.play();
            }
            setHasError(null);
            return;
          } catch (videoOnlyErr) {
            console.error("Video-only attempt also failed", videoOnlyErr);
            throw videoOnlyErr;
          }
        }
        throw innerErr;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      if (!useBasicConstraints) {
        console.log("Retrying with basic constraints...");
        startCamera(true);
        return;
      }
      let errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.toLowerCase().includes('permission denied') || errorMsg.includes('NotAllowedError')) {
        errorMsg = "Camera access was denied. If you're on a mobile device or using a locked browser, try opening the app in a new tab using the button below. You may also need to check your site settings to allow camera/microphone.";
      }
      setHasError(errorMsg);
    }
  }, [cameraFacing, idealWidth, idealHeight, idealFrameRate, streamSource, fallbackVideoSrc]);



  // Countdown Timer Logic
  useEffect(() => {
    let timer: number;
    if (isCountdownActive && !isCountdownPaused && countdownRemaining > 0) {
      timer = window.setInterval(() => {
        setCountdownRemaining(prev => {
          if (prev <= 1) {
            setIsCountdownActive(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isCountdownActive, isCountdownPaused, countdownRemaining]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedOverlayId) {
        // Only delete if not typing in an input
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          setOverlays(prev => prev.filter(img => img.id !== selectedOverlayId));
          setSelectedOverlayId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedOverlayId]);

  useEffect(() => {
    startCamera();
    return () => {
      setStream(prev => {
        if (prev) prev.getTracks().forEach(track => track.stop());
        return null;
      });
    };
  }, [startCamera]);

  // Reconnect audio source if stream changes while streaming
  useEffect(() => {
    if (isStreaming && stream && audioContextRef.current && destNodeRef.current) {
      if (micSourceRef.current) {
        micSourceRef.current.disconnect();
        micSourceRef.current = null;
      }
      if (stream.getAudioTracks().length > 0) {
        const micSource = audioContextRef.current.createMediaStreamSource(stream);
        micSource.connect(destNodeRef.current);
        micSourceRef.current = micSource;
      }
    }
  }, [stream, isStreaming]);

  // Sync isStreaming state with destinations
  useEffect(() => {
    if (isStreaming && destinations.every(d => d.status === 'disconnected')) {
      setIsStreaming(false);
      
      // Clean up
      mediaRecordersRef.current.forEach(({ recorder, ws }) => {
        if (recorder.state !== 'inactive') recorder.stop();
        if (ws.readyState === WebSocket.OPEN) ws.close();
      });
      mediaRecordersRef.current.clear();
      
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
        audioContextRef.current = null;
        destNodeRef.current = null;
        micSourceRef.current = null;
      }
    }
  }, [destinations, isStreaming]);

  const resolutions = [
    { label: '4K (3840x2160)', w: 3840, h: 2160 },
    { label: '1080p (1920x1080)', w: 1920, h: 1080 },
    { label: '720p (1280x720)', w: 1280, h: 720 },
    { label: '480p (854x480)', w: 854, h: 480 },
  ];

  const frameRates = [60, 30, 24, 15];

  // Canvas Compositing Logic
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        // Match canvas size to video
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          if (tickerOffsetRef.current === null) {
            tickerOffsetRef.current = canvas.width;
          }
        }

        if (tickerOffsetRef.current === null) {
          tickerOffsetRef.current = canvas.width;
        }

        // 1. Draw Video Frame with Filters
        ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.filter = 'none'; // Reset filter for overlays

        // 2. Draw Overlays (Watermarks)
        overlays.forEach(overlay => {
          const size = (overlay.size / 100) * canvas.width;
          const x = (overlay.x / 100) * canvas.width;
          const y = (overlay.y / 100) * canvas.height;

          ctx.save();
          ctx.translate(x, y);
          ctx.rotate((overlay.rotation * Math.PI) / 180);
          ctx.globalAlpha = overlay.opacity !== undefined ? overlay.opacity : 1;
          
          let boxWidth = size;
          let boxHeight = size;

          if (overlay.type === 'image') {
            const img = imageElementsRef.current.get(overlay.id);
            if (img && img.complete && img.naturalWidth > 0) {
              const aspect = img.naturalHeight / img.naturalWidth;
              boxWidth = size;
              boxHeight = size * aspect;
              const left = -boxWidth / 2;
              const top = -boxHeight / 2;
              ctx.drawImage(img, left, top, boxWidth, boxHeight);
            }
          } else if (overlay.type === 'video') {
            const vid = videoElementsRef.current.get(overlay.id);
            if (vid && vid.readyState >= 2) {
              const aspect = vid.videoHeight / vid.videoWidth;
              boxWidth = size;
              boxHeight = size * aspect;
              const left = -boxWidth / 2;
              const top = -boxHeight / 2;
              ctx.drawImage(vid, left, top, boxWidth, boxHeight);
            }
          } else if (overlay.type === 'text' || overlay.type === 'clock' || overlay.type === 'date' || overlay.type === 'datetime') {
            let textContent = overlay.content;
            if (overlay.type === 'clock') {
              textContent = new Date().toLocaleTimeString();
            } else if (overlay.type === 'date') {
              textContent = new Date().toLocaleDateString();
            } else if (overlay.type === 'datetime') {
              // Alternate every 5 seconds
              const showTime = Math.floor(Date.now() / 5000) % 2 === 0;
              textContent = showTime ? new Date().toLocaleTimeString() : new Date().toLocaleDateString();
            }

            ctx.font = `${size}px sans-serif`;
            ctx.fillStyle = overlay.color || '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            ctx.fillText(textContent, 0, 0);
            ctx.shadowColor = 'transparent';
            
            boxWidth = ctx.measureText(textContent).width + 20;
            boxHeight = size + 10;
          }

          // Reset alpha for selection feedback
          ctx.globalAlpha = 1;

          // Draw selection/hover feedback
          if (selectedOverlayId === overlay.id || hoveredOverlayId === overlay.id) {
            const left = -boxWidth / 2;
            const top = -boxHeight / 2;

            ctx.strokeStyle = selectedOverlayId === overlay.id ? '#10b981' : 'rgba(16, 185, 129, 0.5)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(left - 2, top - 2, boxWidth + 4, boxHeight + 4);
            ctx.setLineDash([]);

            if (selectedOverlayId === overlay.id) {
              // Draw Resize Handle (bottom-right)
              ctx.fillStyle = '#10b981';
              ctx.fillRect(left + boxWidth - 4, top + boxHeight - 4, 8, 8);
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1;
              ctx.strokeRect(left + boxWidth - 4, top + boxHeight - 4, 8, 8);

              // Draw Rotation Handle (top-center)
              ctx.beginPath();
              ctx.moveTo(0, top - 2);
              ctx.lineTo(0, top - 20);
              ctx.strokeStyle = '#10b981';
              ctx.lineWidth = 2;
              ctx.stroke();

              ctx.beginPath();
              ctx.arc(0, top - 25, 6, 0, Math.PI * 2);
              ctx.fillStyle = '#10b981';
              ctx.fill();
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          }
          ctx.restore();
        });

        // 3. Draw Ticker
        const tickerHeight = canvas.height * (tickerHeightPercent / 100);
        const tickerY = canvas.height * (tickerYPercent / 100);
        
        ctx.fillStyle = tickerBgColor;
        ctx.fillRect(0, tickerY, canvas.width, tickerHeight);

        ctx.font = `${tickerHeight * 0.6}px sans-serif`;
        ctx.fillStyle = tickerTextColor;
        ctx.textBaseline = 'middle';
        
        const textWidth = ctx.measureText(tickerText).width;
        ctx.fillText(tickerText, tickerOffsetRef.current, tickerY + tickerHeight / 2);

        tickerOffsetRef.current -= tickerSpeed; // Use dynamic speed
        if (tickerOffsetRef.current < -textWidth) {
          tickerOffsetRef.current = canvas.width;
        }

        // 4. Draw Countdown Timer
        if (showCountdownOnStream) {
          const mins = Math.floor(countdownRemaining / 60);
          const secs = countdownRemaining % 60;
          const timeString = `${mins}:${secs.toString().padStart(2, '0')}`;
          
          const cdSize = 60; // Fixed size for timer text or adjustable
          ctx.font = `bold ${cdSize}px sans-serif`;
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'top';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
          ctx.shadowBlur = 8;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
          ctx.fillText(timeString, canvas.width - 20, 20);
          ctx.shadowColor = 'transparent';
        }
      }
      requestRef.current = requestAnimationFrame(render);
    };

    requestRef.current = requestAnimationFrame(render);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [tickerText, overlays, tickerSpeed, tickerHeightPercent, tickerYPercent, brightness, contrast, saturation, tickerTextColor, tickerBgColor, selectedOverlayId, hoveredOverlayId, rotatingImageId, resizingImageId, showCountdownOnStream, countdownRemaining]);

  // Sync video overlay volumes
  useEffect(() => {
    overlays.forEach(overlay => {
      if (overlay.type === 'video') {
        const vid = videoElementsRef.current.get(overlay.id);
        if (vid) {
          const vol = overlay.volume ?? 0;
          vid.volume = vol;
          vid.muted = vol === 0;
        }
      }
    });
  }, [overlays]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const src = reader.result as string;
        const type = file.type.startsWith('video/') ? 'video' : 'image';
        const newOverlay: StreamOverlay = {
          id: Math.random().toString(36).substr(2, 9),
          type,
          content: src,
          size: 15,
          x: 50,
          y: 50,
          rotation: 0,
          volume: type === 'video' ? 0 : undefined
        };
        setOverlays(prev => [...prev, newOverlay]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': [],
      'video/*': []
    },
    multiple: true
  } as any);

  const toggleCamera = () => {
    setCameraFacing(prev => prev === 'user' ? 'environment' : 'user');
  };

  const handleAddUser = async (e: FormEvent) => {
    e.preventDefault();
    setUserError('');
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username: newUsername, password: newPassword })
      });
      if (res.ok) {
        setNewUsername('');
        setNewPassword('');
        // Reload users
        const usersRes = await fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } });
        if (usersRes.ok) setUsers(await usersRes.json());
      } else {
        const data = await res.json();
        setUserError(data.error || 'Failed to add user');
      }
    } catch (e) {
      setUserError('Network error');
    }
  };

  const handleDeleteUser = async (id: number) => {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const usersRes = await fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } });
        if (usersRes.ok) setUsers(await usersRes.json());
      }
    } catch (e) {}
  };

  const updateDestination = async (id: string, updates: Partial<StreamDestination>) => {
    setDestinations(prev => {
      const newDestinations = prev.map(d => d.id === id ? { ...d, ...updates } : d);
      const updatedDest = newDestinations.find(d => d.id === id);
      if (updatedDest) {
        fetch("/api/destinations", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(updatedDest)
        }).then(res => {
          if (res.status === 401) onLogout();
        }).catch(e => console.error("Failed to sync destination", e));
      }
      return newDestinations;
    });
  };

  const addCustomDestination = async () => {
    const newDest: StreamDestination = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'Custom Stream',
      protocol: 'RTMP',
      serverUrl: '',
      streamKey: '',
      enabled: true,
      status: 'disconnected'
    };
    setDestinations(prev => [...prev, newDest]);
    try {
      const res = await fetch("/api/destinations", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(newDest)
      });
      if (res.status === 401) onLogout();
    } catch (e) {
      console.error("Failed to add destination to backend", e);
    }
  };

  const removeDestination = async (id: string) => {
    setDestinations(prev => prev.filter(d => d.id !== id));
    try {
      const res = await fetch(`/api/destinations/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) onLogout();
    } catch (e) {
      console.error("Failed to remove destination from backend", e);
    }
  };

  const getSupportedMimeType = () => {
    const types = [
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9,opus',
      'video/webm',
      'video/mp4'
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return '';
  };

  const startSingleDestination = useCallback((dest: StreamDestination, canvasStream: MediaStream) => {
    // If there's an existing recorder/ws for this dest, stop it first to prevent leaks
    const existing = mediaRecordersRef.current.get(dest.id);
    if (existing) {
      try {
        if (existing.recorder.state !== 'inactive') existing.recorder.stop();
        if (existing.ws.readyState === WebSocket.OPEN) existing.ws.close();
      } catch (e) {
        console.warn("Error stopping existing recorder/ws on reconnect:", e);
      }
      mediaRecordersRef.current.delete(dest.id);
    }

    try {
      updateDestination(dest.id, { status: 'connecting' });
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const baseUrl = dest.serverUrl.endsWith('/') ? dest.serverUrl.slice(0, -1) : dest.serverUrl;
      const rtmpFullUrl = `${baseUrl}/${dest.streamKey}`;
      const wsUrl = `${protocol}//${window.location.host}/?rtmpUrl=${encodeURIComponent(rtmpFullUrl)}&token=${token}`;
      
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log(`WebSocket connected for ${dest.name}`);
        
        const mimeType = getSupportedMimeType();
        if (!mimeType) {
          console.error("No supported MediaRecorder MIME type found");
          updateDestination(dest.id, { status: 'error', errorMessage: 'Unsupported browser/MIME type' });
          return;
        }

        const recorder = new MediaRecorder(canvasStream, {
          mimeType,
          videoBitsPerSecond: 2500000
        });

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            console.log(`Sending chunk: ${e.data.size} bytes to ${dest.name}`);
            ws.send(e.data);
          }
        };

        recorder.onstop = () => {
          if (ws.readyState === WebSocket.OPEN) ws.close();
        };

        recorder.start(1000); // Send data every 1 second
        mediaRecordersRef.current.set(dest.id, { recorder, ws });
        
        updateDestination(dest.id, { status: 'streaming', errorMessage: undefined });
      };

      ws.onerror = (err) => {
        console.error(`WebSocket error for ${dest.name}:`, err);
        updateDestination(dest.id, { status: 'error', errorMessage: 'Connection failed' });
      };

      ws.onclose = (event) => {
        console.log(`WebSocket closed for ${dest.name}`);
        if (event.code !== 1000 && event.code !== 1001) {
          updateDestination(dest.id, { status: 'error', errorMessage: `Closed unexpectedly (${event.code})` });
        } else {
          updateDestination(dest.id, { status: 'disconnected', errorMessage: undefined });
        }
      };

    } catch (err) {
      console.error(`Failed to start stream for ${dest.name}:`, err);
      updateDestination(dest.id, { status: 'error', errorMessage: err instanceof Error ? err.message : 'Failed to start' });
    }
  }, [token, updateDestination]);

  // Automatic Reconnection Effect on Error state
  useEffect(() => {
    if (!isStreaming || !canvasStreamRef.current) return;

    const intervalId = setInterval(() => {
      destinations.forEach(dest => {
        if (dest.enabled && dest.status === 'error') {
          console.log(`Auto-reconnecting destination ${dest.name}...`);
          startSingleDestination(dest, canvasStreamRef.current!);
        }
      });
    }, 5000);

    return () => clearInterval(intervalId);
  }, [isStreaming, destinations, startSingleDestination]);

  const handleStartStream = () => {
    const activeDestinations = destinations.filter(d => d.enabled);
    if (activeDestinations.length === 0) {
      alert("Please enable at least one stream destination.");
      return;
    }

    const isAnyStreaming = destinations.some(d => d.status !== 'disconnected');

    if (!isAnyStreaming) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Start all enabled destinations
      setDestinations(prev => prev.map(d => 
        d.enabled ? { ...d, status: 'connecting' } : d
      ));

      // Get the composite stream from canvas
      const canvasStream = canvas.captureStream(idealFrameRate);
      
      // Create a Web Audio API context to mix audio
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;
      const destNode = audioCtx.createMediaStreamDestination();
      destNodeRef.current = destNode;
      
      // 1. Add a silent oscillator to ensure there is ALWAYS an audio track
      // This prevents YouTube from rejecting the stream if the mic is muted or missing
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = 0; // Silent
      const osc = audioCtx.createOscillator();
      osc.connect(gainNode);
      gainNode.connect(destNode);
      osc.start();

      // 2. Mix in the actual microphone audio if available
      if (streamSource === 'camera' && stream && stream.getAudioTracks().length > 0) {
        console.log(`Mixing ${stream.getAudioTracks().length} microphone tracks`);
        const micSource = audioCtx.createMediaStreamSource(stream);
        micSource.connect(destNode);
        micSourceRef.current = micSource;
      } else if ((streamSource === 'videoFile' || streamSource === 'url') && videoRef.current) {
        try {
          const rawStream = (videoRef.current as any).captureStream ? (videoRef.current as any).captureStream() : (videoRef.current as any).mozCaptureStream ? (videoRef.current as any).mozCaptureStream() : null;
          if (rawStream && rawStream.getAudioTracks().length > 0) {
            const vidSource = audioCtx.createMediaStreamSource(rawStream);
            vidSource.connect(destNode);
          }
        } catch (e) {
          console.warn("Could not capture audio from fallback/URL video", e);
        }
      } else {
        console.warn("No microphone stream or fallback audio available, sending silent audio");
      }

      // 3. Mix in video overlay audio
      overlays.forEach(overlay => {
        if (overlay.type === 'video') {
          const vid = videoElementsRef.current.get(overlay.id);
          if (vid) {
            try {
              const rawStream = (vid as any).captureStream ? (vid as any).captureStream() : (vid as any).mozCaptureStream ? (vid as any).mozCaptureStream() : null;
              if (rawStream && rawStream.getAudioTracks().length > 0) {
                const vidSource = audioCtx.createMediaStreamSource(rawStream);
                vidSource.connect(destNode);
              }
            } catch (e) {
              console.warn("Could not capture audio from overlay video", e);
            }
          }
        }
      });

      // Add the mixed audio track to the canvas stream
      const mixedAudioTrack = destNode.stream.getAudioTracks()[0];
      canvasStream.addTrack(mixedAudioTrack);

      canvasStreamRef.current = canvasStream; // Save canvas composite stream to ref

      activeDestinations.forEach(dest => {
        startSingleDestination(dest, canvasStream);
      });

      setIsStreaming(true);
    } else {
      // Stop all
      mediaRecordersRef.current.forEach(({ recorder, ws }) => {
        if (recorder.state !== 'inactive') recorder.stop();
        if (ws.readyState === WebSocket.OPEN) ws.close();
      });
      mediaRecordersRef.current.clear();
      
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
        audioContextRef.current = null;
        destNodeRef.current = null;
        micSourceRef.current = null;
      }
      
      canvasStreamRef.current = null; // Clear from ref
      
      setDestinations(prev => prev.map(d => ({ ...d, status: 'disconnected' })));
      setIsStreaming(false);
    }
  };

  const handleCanvasInteraction = (e: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    // Convert screen coordinates to canvas pixel coordinates
    const px = ((clientX - rect.left) / rect.width) * canvas.width;
    const py = ((clientY - rect.top) / rect.height) * canvas.height;
    
    // Convert screen coordinates to canvas percentage coordinates
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;

    if (e.type === 'mousedown' || e.type === 'touchstart') {
      if (e.type === 'touchstart') e.preventDefault();

      // Check overlays (reverse order to pick top-most)
      for (let i = overlays.length - 1; i >= 0; i--) {
        const overlay = overlays[i];
        const sizePx = (overlay.size / 100) * canvas.width;
        const xPx = (overlay.x / 100) * canvas.width;
        const yPx = (overlay.y / 100) * canvas.height;
        const rotationRad = (overlay.rotation * Math.PI) / 180;

        let boxWidth = sizePx;
        let boxHeight = sizePx;

        if (overlay.type === 'image') {
          const img = imageElementsRef.current.get(overlay.id);
          if (img && img.complete && img.naturalWidth > 0) {
            boxHeight = sizePx * (img.naturalHeight / img.naturalWidth);
          }
        } else if (overlay.type === 'video') {
          const vid = videoElementsRef.current.get(overlay.id);
          if (vid && vid.readyState >= 2) {
            boxHeight = sizePx * (vid.videoHeight / vid.videoWidth);
          }
        } else if (overlay.type === 'text' || overlay.type === 'clock' || overlay.type === 'date') {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            let textContent = overlay.content;
            if (overlay.type === 'clock') {
              textContent = new Date().toLocaleTimeString();
            } else if (overlay.type === 'date') {
              textContent = new Date().toLocaleDateString();
            }
            ctx.font = `${sizePx}px sans-serif`;
            boxWidth = ctx.measureText(textContent).width + 20;
            boxHeight = sizePx + 10;
          }
        }

        // Check Rotation Handle (top-center)
        const handleDist = boxHeight / 2 + 25;
        const handleXPx = xPx + Math.sin(rotationRad) * handleDist;
        const handleYPx = yPx - Math.cos(rotationRad) * handleDist;
        
        const distToRotationHandle = Math.sqrt(Math.pow(px - handleXPx, 2) + Math.pow(py - handleYPx, 2));
        if (distToRotationHandle < 15 && selectedOverlayId === overlay.id) {
          setRotatingImageId(overlay.id);
          return;
        }

        // Check Resize Handle (bottom-right)
        const resizeXPx = xPx + Math.cos(rotationRad) * (boxWidth / 2) - Math.sin(rotationRad) * (boxHeight / 2);
        const resizeYPx = yPx + Math.sin(rotationRad) * (boxWidth / 2) + Math.cos(rotationRad) * (boxHeight / 2);
        
        const distToResizeHandle = Math.sqrt(Math.pow(px - resizeXPx, 2) + Math.pow(py - resizeYPx, 2));
        if (distToResizeHandle < 15 && selectedOverlayId === overlay.id) {
          setResizingImageId(overlay.id);
          return;
        }

        // Check if click is inside the overlay (accounting for rotation)
        const dx = px - xPx;
        const dy = py - yPx;
        const localX = dx * Math.cos(-rotationRad) - dy * Math.sin(-rotationRad);
        const localY = dx * Math.sin(-rotationRad) + dy * Math.cos(-rotationRad);

        if (Math.abs(localX) <= boxWidth / 2 && Math.abs(localY) <= boxHeight / 2) {
          setDraggingImageId(overlay.id);
          setSelectedOverlayId(overlay.id);
          return;
        }
      }
      
      // Clicked on empty space
      setSelectedOverlayId(null);

    } else if ((e.type === 'mousemove' || e.type === 'touchmove')) {
      // Update hover state
      let foundHover = null;
      for (let i = overlays.length - 1; i >= 0; i--) {
        const overlay = overlays[i];
        const sizePx = (overlay.size / 100) * canvas.width;
        const xPx = (overlay.x / 100) * canvas.width;
        const yPx = (overlay.y / 100) * canvas.height;
        const rotationRad = (overlay.rotation * Math.PI) / 180;

        let boxWidth = sizePx;
        let boxHeight = sizePx;

        if (overlay.type === 'image') {
          const img = imageElementsRef.current.get(overlay.id);
          if (img && img.complete && img.naturalWidth > 0) {
            boxHeight = sizePx * (img.naturalHeight / img.naturalWidth);
          }
        } else if (overlay.type === 'video') {
          const vid = videoElementsRef.current.get(overlay.id);
          if (vid && vid.readyState >= 2) {
            boxHeight = sizePx * (vid.videoHeight / vid.videoWidth);
          }
        } else if (overlay.type === 'text' || overlay.type === 'clock' || overlay.type === 'date') {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            let textContent = overlay.content;
            if (overlay.type === 'clock') {
              textContent = new Date().toLocaleTimeString();
            } else if (overlay.type === 'date') {
              textContent = new Date().toLocaleDateString();
            }
            ctx.font = `${sizePx}px sans-serif`;
            boxWidth = ctx.measureText(textContent).width + 20;
            boxHeight = sizePx + 10;
          }
        }

        const dx = px - xPx;
        const dy = py - yPx;
        const localX = dx * Math.cos(-rotationRad) - dy * Math.sin(-rotationRad);
        const localY = dx * Math.sin(-rotationRad) + dy * Math.cos(-rotationRad);

        if (Math.abs(localX) <= boxWidth / 2 && Math.abs(localY) <= boxHeight / 2) {
          foundHover = overlay.id;
          break;
        }
      }
      setHoveredOverlayId(foundHover);

      if (draggingImageId) {
        if (e.type === 'touchmove') e.preventDefault();
        setOverlays(prev => prev.map(img => 
          img.id === draggingImageId 
            ? { ...img, x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) }
            : img
        ));
      } else if (resizingImageId) {
        if (e.type === 'touchmove') e.preventDefault();
        setOverlays(prev => prev.map(img => {
          if (img.id === resizingImageId) {
            const xPx = (img.x / 100) * canvas.width;
            const yPx = (img.y / 100) * canvas.height;
            const dist = Math.sqrt(Math.pow(px - xPx, 2) + Math.pow(py - yPx, 2));
            const newSize = Math.max(2, Math.min(100, (dist * 2 / canvas.width) * 100));
            return { ...img, size: newSize };
          }
          return img;
        }));
      } else if (rotatingImageId) {
        if (e.type === 'touchmove') e.preventDefault();
        setOverlays(prev => prev.map(img => {
          if (img.id === rotatingImageId) {
            const xPx = (img.x / 100) * canvas.width;
            const yPx = (img.y / 100) * canvas.height;
            const angle = Math.atan2(py - yPx, px - xPx);
            const rotation = (angle * 180 / Math.PI) + 90;
            return { ...img, rotation };
          }
          return img;
        }));
      }
    } else if (e.type === 'mouseup' || e.type === 'touchend') {
      setDraggingImageId(null);
      setResizingImageId(null);
      setRotatingImageId(null);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* Main Viewport */}
      <div className="relative h-screen w-full flex flex-col overflow-hidden">
        
        {/* Hidden Video Source */}
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="absolute opacity-0 pointer-events-none"
        />

        {/* Hidden Image Sources for GIF Animation */}
        {overlays.filter(o => o.type === 'image').map(overlay => (
          <img 
            key={overlay.id}
            ref={el => {
              if (el) imageElementsRef.current.set(overlay.id, el);
              else imageElementsRef.current.delete(overlay.id);
            }}
            src={overlay.content}
            className="absolute opacity-0 pointer-events-none"
            alt="Overlay Source"
          />
        ))}

        {/* Hidden Video Sources for Video Overlays */}
        {overlays.filter(o => o.type === 'video').map(overlay => (
          <video 
            key={overlay.id}
            ref={el => {
              if (el) {
                videoElementsRef.current.set(overlay.id, el);
                const vol = overlay.volume ?? 0;
                el.volume = vol;
                el.muted = vol === 0;
                el.play().catch(e => console.error("Video play error:", e));
              } else {
                videoElementsRef.current.delete(overlay.id);
              }
            }}
            src={overlay.content}
            loop
            playsInline
            className="absolute opacity-0 pointer-events-none"
          />
        ))}

        {/* Composited Canvas */}
        <div className="flex-1 relative bg-black flex items-center justify-center min-h-0">
          <canvas 
            ref={canvasRef}
            onMouseDown={handleCanvasInteraction}
            onMouseMove={handleCanvasInteraction}
            onMouseUp={handleCanvasInteraction}
            onTouchStart={handleCanvasInteraction}
            onTouchMove={handleCanvasInteraction}
            onTouchEnd={handleCanvasInteraction}
            className={cn(
              "max-h-full max-w-full object-contain shadow-2xl transition-all touch-none",
              resizingImageId ? "cursor-nwse-resize" :
              rotatingImageId ? "cursor-alias" :
              draggingImageId ? "cursor-grabbing" : 
              hoveredOverlayId ? "cursor-grab" : "cursor-default"
            )}
          />
          
          {hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 backdrop-blur-md p-6 text-center">
              <div className="max-w-xs space-y-4">
                <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
                  <Camera className="w-6 h-6 text-red-500" />
                </div>
                <h3 className="text-lg font-bold">Camera Error</h3>
                <p className="text-sm text-zinc-400">{hasError}</p>
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => {
                      setHasError(null);
                      startCamera();
                    }}
                    className="w-full bg-emerald-500 text-zinc-950 rounded-xl py-3 font-bold hover:bg-emerald-600 transition-all"
                  >
                    Retry Camera
                  </button>
                  <button 
                    onClick={() => window.open(window.location.href, '_blank')}
                    className="w-full bg-white/10 text-white rounded-xl py-3 font-bold hover:bg-white/20 transition-all border border-white/10"
                  >
                    Open in New Tab
                  </button>
                  <button 
                    onClick={() => {
                      setStreamSource('videoFile');
                      setHasError(null);
                    }}
                    className="w-full bg-zinc-800 text-white rounded-xl py-3 font-bold hover:bg-zinc-700 transition-all"
                  >
                    Use Video File instead
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Status Badge */}
          <div className="absolute top-6 left-6 flex flex-col gap-2 z-20">
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md transition-all",
              isStreaming ? "bg-red-500/20 border-red-500/50 text-red-500" : 
              destinations.some(d => d.status === 'connecting') ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-500" :
              destinations.some(d => d.status === 'error') ? "bg-amber-500/20 border-amber-500/50 text-amber-500" :
              "bg-zinc-900/40 border-white/10 text-zinc-400"
            )}>
              <div className={cn(
                "w-2 h-2 rounded-full",
                isStreaming ? "bg-red-500 animate-pulse" : 
                destinations.some(d => d.status === 'connecting') ? "bg-yellow-500 animate-bounce" : 
                destinations.some(d => d.status === 'error') ? "bg-amber-500" : "bg-zinc-500"
              )} />
              <span className="text-[10px] font-black uppercase tracking-widest">
                {isStreaming ? `Live (${destinations.filter(d => d.status === 'streaming').length} Platforms)` : 
                 destinations.some(d => d.status === 'connecting') ? "Connecting..." : 
                 destinations.some(d => d.status === 'error') ? "Error" : "Standby"}
              </span>
            </div>
            
            {(isStreaming || destinations.some(d => d.status === 'error')) && (
              <div className="flex flex-col gap-1">
                {destinations.filter(d => d.status === 'streaming' || d.status === 'error').map(d => (
                  <div key={d.id} className={cn(
                    "flex items-center gap-2 px-2 py-1 backdrop-blur-md border rounded-lg",
                    d.status === 'streaming' ? "bg-red-500/10 border-red-500/20" : "bg-amber-500/10 border-amber-500/20"
                  )}>
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      d.status === 'streaming' ? "bg-red-500 animate-pulse" : "bg-amber-500"
                    )} />
                    <span className={cn(
                      "text-[8px] font-bold uppercase tracking-widest",
                      d.status === 'streaming' ? "text-red-500" : "text-amber-500"
                    )}>
                      {d.name} {d.status === 'error' ? '(Error)' : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {isStreaming && (
            <div className="absolute top-6 right-20 flex items-center gap-2 px-4 py-2 bg-red-600 rounded-lg shadow-lg shadow-red-600/40 animate-pulse">
              <div className="w-2 h-2 rounded-full bg-white" />
              <span className="text-xs font-black uppercase tracking-[0.2em] text-white">Live</span>
            </div>
          )}

          {/* Mobile Toggle Controls */}
          <div className="absolute top-6 right-6 flex flex-col gap-3">
            <button 
              onClick={() => setIsSettingsModalOpen(true)}
              className="p-3 bg-black/40 backdrop-blur-md border border-white/10 rounded-full hover:bg-white/10 transition-colors"
              title="Camera Settings"
            >
              <Settings className="w-5 h-5 text-emerald-500" />
            </button>
            <button 
              onClick={() => setShowControls(!showControls)}
              className={cn(
                "p-3 bg-black/40 backdrop-blur-md border border-white/10 rounded-full hover:bg-white/10 transition-colors",
                showControls ? "text-emerald-500" : "text-zinc-400"
              )}
              title="Toggle Controls"
            >
              {showControls ? <ChevronDown className="w-5 h-5" /> : <Sliders className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Camera Settings Modal */}
        {isSettingsModalOpen && (
          <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-zinc-900 border border-white/10 rounded-3xl p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Camera Settings</h2>
                <button onClick={() => setIsSettingsModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Resolution</label>
                  <select 
                    value={`${idealWidth}x${idealHeight}`}
                    onChange={(e) => {
                      const [w, h] = e.target.value.split('x').map(Number);
                      setIdealWidth(w);
                      setIdealHeight(h);
                    }}
                    className="w-full bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    {resolutions.map(res => (
                      <option key={res.label} value={`${res.w}x${res.h}`}>{res.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Frame Rate (FPS)</label>
                  <select 
                    value={idealFrameRate}
                    onChange={(e) => setIdealFrameRate(Number(e.target.value))}
                    className="w-full bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    {frameRates.map(fps => (
                      <option key={fps} value={fps}>{fps} FPS</option>
                    ))}
                  </select>
                </div>

                <div className="pt-4 border-t border-white/5 space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                      <span>Brightness</span>
                      <span className="text-emerald-500">{brightness}%</span>
                    </div>
                    <input 
                      type="range"
                      min="0"
                      max="200"
                      value={brightness}
                      onChange={(e) => setBrightness(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                      <span>Contrast</span>
                      <span className="text-emerald-500">{contrast}%</span>
                    </div>
                    <input 
                      type="range"
                      min="0"
                      max="200"
                      value={contrast}
                      onChange={(e) => setContrast(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                      <span>Saturation</span>
                      <span className="text-emerald-500">{saturation}%</span>
                    </div>
                    <input 
                      type="range"
                      min="0"
                      max="200"
                      value={saturation}
                      onChange={(e) => setSaturation(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <button 
                onClick={() => {
                  setIsSettingsModalOpen(false);
                  startCamera();
                }}
                className="w-full bg-emerald-500 text-zinc-950 rounded-xl py-4 font-bold hover:bg-emerald-600 transition-all"
              >
                Apply Settings
              </button>
              <button 
                onClick={onLogout}
                className="w-full bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl py-4 font-bold hover:bg-red-500/20 transition-all mt-4"
              >
                Logout
              </button>
            </div>
          </div>
        )}

        {/* Controls Panel */}
        <div className={cn(
          "bg-zinc-900/90 backdrop-blur-xl border-t border-white/5 transition-all duration-300 ease-out flex flex-col overflow-hidden shrink-0",
          showControls ? "h-[60vh] md:h-[40vh]" : "h-0 border-t-0"
        )}>
          {/* Tabs */}
          <div className="flex items-center gap-2 p-4 border-b border-white/5 overflow-x-auto shrink-0 no-scrollbar">
            <button onClick={() => setActiveTab('stream')} className={cn("px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-colors", activeTab === 'stream' ? "bg-emerald-500 text-zinc-950" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700")}>Stream</button>
            <button onClick={() => setActiveTab('overlays')} className={cn("px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-colors", activeTab === 'overlays' ? "bg-emerald-500 text-zinc-950" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700")}>Watermarks</button>
            <button onClick={() => setActiveTab('ticker')} className={cn("px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-colors", activeTab === 'ticker' ? "bg-emerald-500 text-zinc-950" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700")}>Ticker</button>
            <button onClick={() => setActiveTab('adjust')} className={cn("px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-colors", activeTab === 'adjust' ? "bg-emerald-500 text-zinc-950" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700")}>Adjust</button>
            <button onClick={() => setActiveTab('timer')} className={cn("px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-colors", activeTab === 'timer' ? "bg-emerald-500 text-zinc-950" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700")}>Timer</button>
          </div>

          <div className="p-6 overflow-y-auto flex-1">
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* User Management (Admin Only) */}
              {username === 'admin' && (
                <div className="mb-8 p-6 bg-zinc-950 rounded-2xl border border-white/5">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-emerald-500" />
                    User Management
                  </h3>
                  
                  <form onSubmit={handleAddUser} className="flex gap-2 mb-4">
                    <input 
                      type="text" 
                      placeholder="Username" 
                      value={newUsername}
                      onChange={e => setNewUsername(e.target.value)}
                      className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                      required
                    />
                    <input 
                      type="password" 
                      placeholder="Password" 
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                      required
                    />
                    <button type="submit" className="bg-emerald-500 text-zinc-950 px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-600 transition-colors">
                      Add
                    </button>
                  </form>
                  {userError && <p className="text-red-500 text-xs mb-4">{userError}</p>}
                  
                  <div className="space-y-2">
                    {users.map(u => (
                      <div key={u.id} className="flex items-center justify-between bg-zinc-900 p-3 rounded-xl border border-white/5">
                        <span className="text-sm font-medium">{u.username}</span>
                        {u.username !== 'admin' && (
                          <button onClick={() => handleDeleteUser(u.id)} className="text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ticker Settings */}
              {activeTab === 'ticker' && (
              <div className="space-y-4 md:col-span-2">
              <div className="flex items-center gap-2 text-zinc-400">
                <Type className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-widest">Ticker Settings</span>
              </div>

              {/* Placement Preview */}
              <div className="relative w-full aspect-video bg-zinc-950 rounded-xl border border-white/10 overflow-hidden shadow-inner">
                <div 
                  className="absolute left-0 right-0 bg-emerald-500/20 border-y border-emerald-500/40 transition-all duration-200"
                  style={{ 
                    height: `${tempTickerHeight}%`, 
                    top: `${tempTickerY}%` 
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-[8px] uppercase tracking-widest text-zinc-700 font-bold">Placement Preview</span>
                </div>
              </div>

              <input 
                type="text"
                value={tickerText}
                onChange={(e) => setTickerText(e.target.value)}
                className="w-full bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                placeholder="Enter scrolling text..."
              />
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                  <span>Scroll Speed</span>
                  <span className="text-emerald-500">{tickerSpeed}x</span>
                </div>
                <input 
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={tickerSpeed}
                  onChange={(e) => setTickerSpeed(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                  <span>Ticker Height</span>
                  <span className="text-emerald-500">{tempTickerHeight}%</span>
                </div>
                <input 
                  type="range"
                  min="2"
                  max="20"
                  step="1"
                  value={tempTickerHeight}
                  onChange={(e) => setTempTickerHeight(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                  <span>Ticker Position (Y)</span>
                  <span className="text-emerald-500">{tempTickerY}%</span>
                </div>
                <input 
                  type="range"
                  min="0"
                  max={100 - tempTickerHeight}
                  step="1"
                  value={tempTickerY}
                  onChange={(e) => setTempTickerY(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              <button 
                onClick={() => {
                  setTickerHeightPercent(tempTickerHeight);
                  setTickerYPercent(tempTickerY);
                }}
                disabled={tickerHeightPercent === tempTickerHeight && tickerYPercent === tempTickerY}
                className={cn(
                  "w-full py-2 rounded-lg text-[10px] uppercase tracking-widest font-bold transition-all",
                  tickerHeightPercent === tempTickerHeight && tickerYPercent === tempTickerY
                    ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                    : "bg-emerald-500 text-zinc-950 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20"
                )}
              >
                Apply Layout Changes
              </button>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Text Color</span>
                  <input 
                    type="color"
                    value={tickerTextColor}
                    onChange={(e) => setTickerTextColor(e.target.value)}
                    className="w-full h-10 bg-zinc-800 border border-white/10 rounded-xl cursor-pointer"
                  />
                </div>
                <div className="space-y-2">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">BG Color</span>
                  <div className="flex gap-2">
                    <input 
                      type="color"
                      value={tickerBgColor.startsWith('rgba') ? '#000000' : tickerBgColor}
                      onChange={(e) => setTickerBgColor(e.target.value)}
                      className="flex-1 h-10 bg-zinc-800 border border-white/10 rounded-xl cursor-pointer"
                    />
                  </div>
                </div>
              </div>
              </div>
              )}

              {/* Watermarks Settings */}
              {activeTab === 'overlays' && (
              <div className="space-y-4 md:col-span-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <ImageIcon className="w-4 h-4" />
                    <span className="text-xs font-semibold uppercase tracking-widest">Watermarks & Overlays</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-bold text-emerald-500 uppercase tracking-widest hover:bg-emerald-500/20 transition-all cursor-pointer">
                      <ImageIcon className="w-3 h-3" /> Image
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                             const reader = new FileReader();
                             reader.onload = () => {
                               const src = reader.result as string;
                               setOverlays(prev => [...prev, {
                                 id: Math.random().toString(36).substr(2, 9),
                                 type: 'image',
                                 content: src,
                                 size: 15,
                                 x: 50,
                                 y: 50,
                                 rotation: 0
                               }]);
                             };
                             reader.readAsDataURL(file);
                          }
                          e.target.value = ''; // Reset input
                        }}
                      />
                    </label>
                    <label className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-bold text-emerald-500 uppercase tracking-widest hover:bg-emerald-500/20 transition-all cursor-pointer">
                      <Video className="w-3 h-3" /> Video
                      <input 
                        type="file" 
                        accept="video/*" 
                        className="hidden" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                             const reader = new FileReader();
                             reader.onload = () => {
                               const src = reader.result as string;
                               setOverlays(prev => [...prev, {
                                 id: Math.random().toString(36).substr(2, 9),
                                 type: 'video',
                                 content: src,
                                 size: 15,
                                 x: 50,
                                 y: 50,
                                 rotation: 0,
                                 volume: 0
                               }]);
                             };
                             reader.readAsDataURL(file);
                          }
                          e.target.value = ''; // Reset input
                        }}
                      />
                    </label>
                    <button 
                      onClick={() => {
                        setOverlays(prev => [...prev, {
                          id: Math.random().toString(36).substr(2, 9),
                          type: 'text',
                          content: 'New Watermark',
                          size: 10,
                          x: 50,
                          y: 50,
                          rotation: 0,
                          color: '#ffffff'
                        }]);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-bold text-emerald-500 uppercase tracking-widest hover:bg-emerald-500/20 transition-all"
                    >
                      <Plus className="w-3 h-3" /> Text
                    </button>
                    <button 
                      onClick={() => {
                        setOverlays(prev => [...prev, {
                          id: Math.random().toString(36).substr(2, 9),
                          type: 'clock',
                          content: '',
                          size: 10,
                          x: 50,
                          y: 50,
                          rotation: 0,
                          color: '#ffffff'
                        }]);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-bold text-emerald-500 uppercase tracking-widest hover:bg-emerald-500/20 transition-all"
                    >
                      <Clock className="w-3 h-3" /> Clock
                    </button>
                    <button 
                      onClick={() => {
                        setOverlays(prev => [...prev, {
                          id: Math.random().toString(36).substr(2, 9),
                          type: 'date',
                          content: '',
                          size: 10,
                          x: 50,
                          y: 50,
                          rotation: 0,
                          color: '#ffffff'
                        }]);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-bold text-emerald-500 uppercase tracking-widest hover:bg-emerald-500/20 transition-all"
                    >
                      <Calendar className="w-3 h-3" /> Date
                    </button>
                    <button 
                      onClick={() => {
                        setOverlays(prev => [...prev, {
                          id: Math.random().toString(36).substr(2, 9),
                          type: 'datetime',
                          content: '',
                          size: 10,
                          x: 50,
                          y: 50,
                          rotation: 0,
                          color: '#ffffff'
                        }]);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-bold text-emerald-500 uppercase tracking-widest hover:bg-emerald-500/20 transition-all"
                    >
                      <Clock className="w-3 h-3" /> Date & Time
                    </button>
                  </div>
                </div>
                
                <div 
                  {...getRootProps()} 
                  className={cn(
                    "border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-6 cursor-pointer transition-all",
                    isDragActive ? "border-emerald-500 bg-emerald-500/10" : "border-white/10 hover:border-white/20"
                  )}
                >
                  <input {...getInputProps()} />
                  <Upload className="w-6 h-6 text-zinc-500 mb-2" />
                  <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest text-center">
                    Drop images, GIFs, or videos here to add as watermarks
                  </span>
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {overlays.map((overlay, index) => (
                    <div key={overlay.id} className={cn(
                      "p-3 bg-zinc-800/50 border rounded-xl space-y-3 transition-colors",
                      selectedOverlayId === overlay.id ? "border-emerald-500/50" : "border-white/5"
                    )}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {overlay.type === 'image' ? (
                            <div className="w-8 h-8 rounded bg-zinc-900 border border-white/5 overflow-hidden flex items-center justify-center">
                              <img src={overlay.content} className="max-w-full max-h-full object-contain" />
                            </div>
                          ) : overlay.type === 'video' ? (
                            <div className="w-8 h-8 rounded bg-zinc-900 border border-white/5 overflow-hidden flex items-center justify-center">
                              <video src={overlay.content} className="max-w-full max-h-full object-contain" />
                            </div>
                          ) : overlay.type === 'clock' ? (
                            <div className="w-8 h-8 rounded bg-zinc-900 border border-white/5 overflow-hidden flex items-center justify-center text-zinc-400">
                              <Clock className="w-4 h-4" />
                            </div>
                          ) : overlay.type === 'date' ? (
                            <div className="w-8 h-8 rounded bg-zinc-900 border border-white/5 overflow-hidden flex items-center justify-center text-zinc-400">
                              <Calendar className="w-4 h-4" />
                            </div>
                          ) : overlay.type === 'datetime' ? (
                            <div className="w-8 h-8 rounded bg-zinc-900 border border-white/5 overflow-hidden flex items-center justify-center text-zinc-400">
                              <div className="relative">
                                <Clock className="w-4 h-4" />
                                <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full border border-zinc-900" />
                              </div>
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded bg-zinc-900 border border-white/5 overflow-hidden flex items-center justify-center text-zinc-400">
                              <Type className="w-4 h-4" />
                            </div>
                          )}
                          <span className="text-[10px] uppercase font-bold text-zinc-400">
                            {overlay.type === 'image' ? 'Image' : overlay.type === 'video' ? 'Video' : overlay.type === 'clock' ? 'Clock' : overlay.type === 'date' ? 'Date' : overlay.type === 'datetime' ? 'Date & Time' : 'Text'} Watermark
                          </span>
                        </div>
                        <button 
                          onClick={() => setOverlays(prev => prev.filter(o => o.id !== overlay.id))}
                          className="p-1.5 hover:bg-red-500/10 text-zinc-500 hover:text-red-500 rounded-lg transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {(overlay.type === 'text' || overlay.type === 'clock' || overlay.type === 'date' || overlay.type === 'datetime') && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          {overlay.type === 'text' && (
                            <input 
                              type="text"
                              value={overlay.content}
                              onChange={(e) => setOverlays(prev => prev.map(o => o.id === overlay.id ? { ...o, content: e.target.value } : o))}
                              className="md:col-span-2 bg-zinc-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              placeholder="Watermark text..."
                            />
                          )}
                          <input 
                            type="color"
                            value={overlay.color || '#ffffff'}
                            onChange={(e) => setOverlays(prev => prev.map(o => o.id === overlay.id ? { ...o, color: e.target.value } : o))}
                            className={cn(
                              "h-8 bg-zinc-900 border border-white/10 rounded-lg cursor-pointer",
                              overlay.type === 'text' ? "w-full" : "w-full md:col-span-3"
                            )}
                          />
                        </div>
                      )}

                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-[8px] uppercase tracking-widest text-zinc-500 font-bold">
                          <span>Size</span>
                          <span className="text-emerald-500">{overlay.size}%</span>
                        </div>
                        <input 
                          type="range"
                          min="1"
                          max="100"
                          value={overlay.size}
                          onChange={(e) => setOverlays(prev => prev.map(o => o.id === overlay.id ? { ...o, size: parseInt(e.target.value) } : o))}
                          className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-[8px] uppercase tracking-widest text-zinc-500 font-bold">
                          <span>Opacity</span>
                          <span className="text-emerald-500">{Math.round((overlay.opacity !== undefined ? overlay.opacity : 1) * 100)}%</span>
                        </div>
                        <input 
                          type="range"
                          min="0"
                          max="100"
                          value={Math.round((overlay.opacity !== undefined ? overlay.opacity : 1) * 100)}
                          onChange={(e) => setOverlays(prev => prev.map(o => o.id === overlay.id ? { ...o, opacity: parseInt(e.target.value) / 100 } : o))}
                          className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                      </div>

                      {overlay.type === 'video' && (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-[8px] uppercase tracking-widest text-zinc-500 font-bold">
                            <span>Volume</span>
                            <span className="text-emerald-500">{Math.round((overlay.volume || 0) * 100)}%</span>
                          </div>
                          <input 
                            type="range"
                            min="0"
                            max="100"
                            value={Math.round((overlay.volume || 0) * 100)}
                            onChange={(e) => setOverlays(prev => prev.map(o => o.id === overlay.id ? { ...o, volume: parseInt(e.target.value) / 100 } : o))}
                            className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                  {overlays.length === 0 && (
                    <div className="text-center py-8 text-zinc-500 text-xs font-medium">
                      No watermarks added yet.
                    </div>
                  )}
                </div>
              </div>
              )}

              {/* Color Grading Settings */}
              {activeTab === 'adjust' && (
              <div className="space-y-4 md:col-span-2">
              <div className="flex items-center gap-2 text-zinc-400">
                <Settings className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-widest">Color Grading</span>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                    <span>Brightness</span>
                    <span className="text-emerald-500">{brightness}%</span>
                  </div>
                  <input 
                    type="range"
                    min="0"
                    max="200"
                    value={brightness}
                    onChange={(e) => setBrightness(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                    <span>Contrast</span>
                    <span className="text-emerald-500">{contrast}%</span>
                  </div>
                  <input 
                    type="range"
                    min="0"
                    max="200"
                    value={contrast}
                    onChange={(e) => setContrast(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                    <span>Saturation</span>
                    <span className="text-emerald-500">{saturation}%</span>
                  </div>
                  <input 
                    type="range"
                    min="0"
                    max="200"
                    value={saturation}
                    onChange={(e) => setSaturation(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
                <button 
                  onClick={() => {
                    setBrightness(100);
                    setContrast(100);
                    setSaturation(100);
                  }}
                  className="w-full py-2 bg-zinc-800 border border-white/10 rounded-lg text-[10px] uppercase tracking-widest text-zinc-400 hover:bg-zinc-700 transition-all"
                >
                  Reset Grading
                </button>
              </div>
              </div>
              )}

              {/* Stream Configuration */}
              {activeTab === 'stream' && (
              <div className="space-y-8 md:col-span-2">

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Camera className="w-4 h-4" />
                  <span className="text-xs font-semibold uppercase tracking-widest">Stream Source</span>
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-zinc-300">
                    <input 
                      type="radio" 
                      name="streamSource" 
                      checked={streamSource === 'camera'}
                      onChange={() => {
                        setStreamSource('camera');
                      }}
                      className="accent-emerald-500"
                    />
                    Camera
                  </label>
                  <label className="flex items-center gap-2 text-sm text-zinc-300">
                    <input 
                      type="radio" 
                      name="streamSource" 
                      checked={streamSource === 'videoFile'}
                      onChange={() => {
                        setStreamSource('videoFile');
                      }}
                      className="accent-emerald-500"
                    />
                    Uploaded Video
                  </label>
                  <label className="flex items-center gap-2 text-sm text-zinc-300">
                    <input 
                      type="radio" 
                      name="streamSource" 
                      checked={streamSource === 'url'}
                      onChange={() => {
                        setStreamSource('url');
                      }}
                      className="accent-emerald-500"
                    />
                    External URL
                  </label>
                </div>
                
                {streamSource === 'videoFile' && (
                  <div className="space-y-2">
                    <label className="block text-xs text-zinc-500 uppercase tracking-widest font-bold">Fallback Video Upload</label>
                    <input 
                      type="file" 
                      accept="video/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const url = URL.createObjectURL(file);
                          setFallbackVideoSrc(url);
                        }
                      }}
                      className="text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-emerald-500 file:text-zinc-950 hover:file:bg-emerald-600 outline-none w-full border border-white/10 rounded-lg p-2"
                    />
                    {fallbackVideoSrc && <p className="text-xs text-emerald-400">Video loaded successfully.</p>}
                  </div>
                )}

                {streamSource === 'url' && (
                  <div className="space-y-2">
                    <label className="block text-xs text-zinc-500 uppercase tracking-widest font-bold">External Stream URL</label>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input 
                          type="text" 
                          value={inputUrl}
                          onChange={(e) => setInputUrl(e.target.value)}
                          placeholder="https://example.com/stream.m3u8"
                          className="w-full bg-zinc-900 border border-white/10 rounded-lg pl-10 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        />
                      </div>
                      <button 
                        onClick={() => startCamera()}
                        className="px-4 bg-emerald-500 text-zinc-950 rounded-lg text-xs font-bold hover:bg-emerald-600 transition-all"
                      >
                        Load
                      </button>
                    </div>
                    <p className="text-[10px] text-zinc-500 italic">Supports direct video links and HLS (.m3u8) streams.</p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Settings className="w-4 h-4" />
                  <span className="text-xs font-semibold uppercase tracking-widest">Stream Destinations</span>
                </div>
                <div className="flex items-center gap-3">
                  {isStreaming && (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded-full">
                      <div className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-[8px] font-bold text-red-500 uppercase tracking-widest">Live</span>
                    </div>
                  )}
                  <button 
                    onClick={addCustomDestination}
                    className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-bold text-emerald-500 uppercase tracking-widest hover:bg-emerald-500/20 transition-all"
                  >
                    <Plus className="w-3 h-3" /> Add Destination
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {destinations.map(dest => (
                  <div key={dest.id} className={cn(
                    "p-4 rounded-2xl border transition-all space-y-3 relative group",
                    dest.status === 'streaming' ? "bg-red-500/5 border-red-500/30" :
                    dest.enabled ? "bg-zinc-800/50 border-emerald-500/30" : "bg-zinc-900/50 border-white/5 opacity-60"
                  )}>
                    {/* Delete Button for Custom Destinations */}
                    {dest.id !== 'youtube' && dest.id !== 'facebook' && dest.status === 'disconnected' && (
                      <button 
                        onClick={() => removeDestination(dest.id)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-zinc-900 border border-white/10 rounded-full flex items-center justify-center text-zinc-500 hover:text-red-500 hover:border-red-500/50 transition-all opacity-0 group-hover:opacity-100 shadow-xl z-10"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}

                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          dest.status === 'streaming' ? "bg-red-500 animate-pulse" : 
                          dest.status === 'connecting' ? "bg-yellow-500 animate-bounce" : 
                          dest.status === 'error' ? "bg-amber-500" : "bg-zinc-500"
                        )} />
                        {dest.id === 'youtube' || dest.id === 'facebook' ? (
                          <span className="text-xs font-bold uppercase tracking-wider">{dest.name}</span>
                        ) : (
                          <input 
                            type="text"
                            value={dest.name}
                            onChange={(e) => updateDestination(dest.id, { name: e.target.value })}
                            className="bg-transparent border-none p-0 text-xs font-bold uppercase tracking-wider focus:ring-0 w-24"
                          />
                        )}
                        <div className={cn(
                          "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter",
                          dest.status === 'streaming' ? "bg-red-500 text-white animate-pulse" :
                          dest.status === 'connecting' ? "bg-yellow-500 text-zinc-950 animate-pulse" :
                          dest.status === 'error' ? "bg-amber-500 text-white" :
                          "bg-zinc-700 text-zinc-400"
                        )}>
                          {dest.status}
                        </div>
                      </div>
                      <button 
                        onClick={() => updateDestination(dest.id, { enabled: !dest.enabled })}
                        disabled={dest.status !== 'disconnected'}
                        className={cn(
                          "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all",
                          dest.enabled ? "bg-emerald-500 text-zinc-950" : "bg-zinc-800 text-zinc-500",
                          dest.status !== 'disconnected' && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        {dest.enabled ? "Enabled" : "Disabled"}
                      </button>
                    </div>

                    {dest.status === 'error' && dest.errorMessage && (
                      <div className="text-[10px] text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 font-medium">
                        {dest.errorMessage}
                      </div>
                    )}

                    {dest.status === 'streaming' && streamStats[dest.id] ? (
                      <div className="grid grid-cols-3 gap-2 py-2 border-y border-white/5">
                        <div className="text-center">
                          <div className="text-[8px] text-zinc-500 uppercase font-bold">Bitrate</div>
                          <div className="text-[10px] font-mono text-emerald-500">{streamStats[dest.id].bitrate} kbps</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[8px] text-zinc-500 uppercase font-bold">FPS</div>
                          <div className="text-[10px] font-mono text-emerald-500">{streamStats[dest.id].fps}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[8px] text-zinc-500 uppercase font-bold">Uptime</div>
                          <div className="text-[10px] font-mono text-emerald-500">
                            {Math.floor(streamStats[dest.id].uptime / 60)}:{(streamStats[dest.id].uptime % 60).toString().padStart(2, '0')}
                          </div>
                        </div>
                      </div>
                    ) : dest.enabled && (
                      <div className="space-y-2">
                        <div className="flex gap-1 p-0.5 bg-zinc-900 rounded-lg border border-white/5">
                          {['RTMP', 'UDP'].map(p => (
                            <button 
                              key={p}
                              onClick={() => updateDestination(dest.id, { protocol: p as any })}
                              className={cn(
                                "flex-1 py-1 text-[8px] font-bold rounded-md transition-all",
                                dest.protocol === p ? "bg-zinc-700 text-white" : "text-zinc-600 hover:text-zinc-400"
                              )}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold">Server URL</label>
                          <input 
                            type="text"
                            value={dest.serverUrl}
                            onChange={(e) => updateDestination(dest.id, { serverUrl: e.target.value })}
                            className="w-full bg-zinc-900 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold">Stream Key</label>
                          <input 
                            type="password"
                            value={dest.streamKey}
                            onChange={(e) => updateDestination(dest.id, { streamKey: e.target.value })}
                            className={cn(
                              "w-full bg-zinc-900 border rounded-lg px-2 py-1.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-emerald-500/50",
                              dest.streamKey === '••••-••••-••••-••••' ? "border-amber-500/50" : "border-white/10"
                            )}
                          />
                          {dest.streamKey === '••••-••••-••••-••••' && (
                            <p className="text-[8px] text-amber-500 font-medium">Please enter your actual stream key</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              </div>
              </div>
              )}

              {/* Stream Actions */}
              {activeTab === 'stream' && (
              <div className="space-y-4 md:col-span-2 border-t border-white/5 pt-8">
              <div className="flex items-center gap-2 text-zinc-400">
                <Camera className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-widest">Actions</span>
              </div>
              <div className="flex flex-col md:flex-row gap-3">
                <button 
                  onClick={toggleCamera}
                  className="w-full md:w-auto md:flex-1 bg-zinc-800 border border-white/10 rounded-xl py-3 text-sm font-medium hover:bg-zinc-700 transition-all"
                >
                  Flip Camera
                </button>
                <div className="w-full md:flex-[2] flex flex-col gap-2">
                  <button 
                    onClick={handleStartStream}
                    disabled={destinations.some(d => d.status === 'connecting')}
                    className={cn(
                      "w-full rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg",
                      destinations.some(d => d.status === 'streaming') 
                        ? "bg-red-500 hover:bg-red-600 text-white shadow-red-500/20" 
                        : destinations.some(d => d.status === 'connecting')
                        ? "bg-zinc-700 text-zinc-400 cursor-wait"
                        : "bg-emerald-500 hover:bg-emerald-600 text-zinc-950 shadow-emerald-500/20"
                    )}
                  >
                    {destinations.some(d => d.status === 'streaming') ? (
                      <><Square className="w-4 h-4 fill-current" /> Stop All Streams</>
                    ) : destinations.some(d => d.status === 'connecting') ? (
                      <><div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" /> Connecting...</>
                    ) : (
                      <><Play className="w-4 h-4 fill-current" /> Go Live Everywhere</>
                    )}
                  </button>
                  <div className="flex flex-wrap justify-center gap-3">
                    {destinations.filter(d => d.enabled).map(dest => (
                      <div key={dest.id} className="flex items-center gap-1.5">
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          dest.status === 'streaming' ? "bg-red-500 animate-pulse" : 
                          dest.status === 'connecting' ? "bg-yellow-500 animate-bounce" : 
                          dest.status === 'error' ? "bg-amber-500" : "bg-zinc-500"
                        )} />
                        <span className={cn(
                          "text-[10px] uppercase tracking-widest font-bold",
                          dest.status === 'streaming' ? "text-red-500" : 
                          dest.status === 'connecting' ? "text-yellow-500" : 
                          dest.status === 'error' ? "text-amber-500" : "text-zinc-500"
                        )}>
                          {dest.name}: {dest.status === 'streaming' ? "Live" : 
                           dest.status === 'connecting' ? "Connecting" : 
                           dest.status === 'error' ? "Error" : "Idle"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              </div>
              )}

              {/* Timer Settings */}
              {activeTab === 'timer' && (
              <div className="space-y-4 md:col-span-2">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs font-semibold uppercase tracking-widest">Countdown Timer</span>
                </div>
                
                <div className="space-y-4 bg-zinc-950/50 p-4 rounded-xl border border-white/5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-zinc-300">Show on Stream</label>
                    <input 
                      type="checkbox" 
                      checked={showCountdownOnStream}
                      onChange={(e) => setShowCountdownOnStream(e.target.checked)}
                      className="w-4 h-4 accent-emerald-500 rounded bg-zinc-800 border-white/10"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-300">Duration (Minutes)</label>
                    <input 
                      type="number" 
                      min="1"
                      value={Math.floor(countdownDuration / 60)}
                      onChange={(e) => {
                        const mins = parseInt(e.target.value) || 1;
                        const secs = mins * 60;
                        setCountdownDuration(secs);
                        setCountdownRemaining(secs);
                        setIsCountdownActive(false);
                        setIsCountdownPaused(false);
                      }}
                      className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button 
                      onClick={() => {
                        if (!isCountdownActive) {
                          setIsCountdownActive(true);
                          setIsCountdownPaused(false);
                        } else {
                          setIsCountdownPaused(!isCountdownPaused);
                        }
                      }}
                      className="flex-1 bg-emerald-500 text-zinc-950 font-bold text-xs uppercase tracking-widest py-2 rounded-lg hover:bg-emerald-600 transition-colors"
                    >
                      {!isCountdownActive ? 'Start Timer' : isCountdownPaused ? 'Resume Timer' : 'Pause Timer'}
                    </button>
                    <button 
                      onClick={() => {
                        setIsCountdownActive(false);
                        setIsCountdownPaused(false);
                        setCountdownRemaining(countdownDuration);
                      }}
                      className="flex-1 bg-red-500/20 text-red-500 font-bold text-xs uppercase tracking-widest py-2 rounded-lg hover:bg-red-500/30 transition-colors"
                    >
                      Reset Timer
                    </button>
                  </div>
                  
                  <div className="mt-4 text-center">
                    <div className="text-3xl font-mono font-bold tracking-wider">
                      {Math.floor(countdownRemaining / 60)}:{(countdownRemaining % 60).toString().padStart(2, '0')}
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1">Remaining Time</div>
                  </div>
                </div>
              </div>
              )}

              <AdBanner />
            </div>
          </div>
        </div>

        {/* Info Overlay for "Go Live" - Removed blocking overlay */}
      </div>
    </div>
  );
}
