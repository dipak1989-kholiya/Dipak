import { useState, useRef, useEffect, useCallback, MouseEvent, TouchEvent } from 'react';
import { Camera, Image as ImageIcon, Type, Play, Square, Settings, Upload, X, Plus, Sliders, ChevronDown, ChevronUp } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
  status: 'disconnected' | 'connecting' | 'streaming';
};

type ImageOverlay = {
  id: string;
  src: string;
  size: number;
  x: number;
  y: number;
  rotation: number;
};

const STORAGE_KEY = 'live_stream_settings';

export default function StreamApp({ token, onLogout }: { token: string; onLogout: () => void }) {
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
  const [imageOverlays, setImageOverlays] = useState<ImageOverlay[]>([]);
  const [draggingImageId, setDraggingImageId] = useState<string | null>(null);
  const [resizingImageId, setResizingImageId] = useState<string | null>(null);
  const [rotatingImageId, setRotatingImageId] = useState<string | null>(null);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [hoveredOverlayId, setHoveredOverlayId] = useState<string | null>(null);
  const [overlayText, setOverlayText] = useState('');
  const [overlayTextColor, setOverlayTextColor] = useState('#ffffff');
  const [overlayTextSize, setOverlayTextSize] = useState(40);
  const [overlayTextX, setOverlayTextX] = useState(50);
  const [overlayTextY, setOverlayTextY] = useState(50);
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [activeTab, setActiveTab] = useState<'stream' | 'overlays' | 'ticker' | 'adjust'>('stream');
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [idealWidth, setIdealWidth] = useState(1280);
  const [idealHeight, setIdealHeight] = useState(720);
  const [idealFrameRate, setIdealFrameRate] = useState(30);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [streamStats, setStreamStats] = useState<Record<string, { bitrate: number; uptime: number; fps: number }>>({});
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [hasError, setHasError] = useState<string | null>(null);

  // Load settings on startup
  useEffect(() => {
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
          if (settings.imageOverlays !== undefined) setImageOverlays(settings.imageOverlays);
          if (settings.overlayText !== undefined) setOverlayText(settings.overlayText);
          if (settings.overlayTextColor !== undefined) setOverlayTextColor(settings.overlayTextColor);
          if (settings.overlayTextSize !== undefined) setOverlayTextSize(settings.overlayTextSize);
          if (settings.overlayTextX !== undefined) setOverlayTextX(settings.overlayTextX);
          if (settings.overlayTextY !== undefined) setOverlayTextY(settings.overlayTextY);
          if (settings.cameraFacing !== undefined) setCameraFacing(settings.cameraFacing);
          if (settings.idealWidth !== undefined) setIdealWidth(settings.idealWidth);
          if (settings.idealHeight !== undefined) setIdealHeight(settings.idealHeight);
          if (settings.idealFrameRate !== undefined) setIdealFrameRate(settings.idealFrameRate);
          if (settings.brightness !== undefined) setBrightness(settings.brightness);
          if (settings.contrast !== undefined) setContrast(settings.contrast);
          if (settings.saturation !== undefined) setSaturation(settings.saturation);
        } catch (e) {
          console.error("Failed to load settings", e);
        }
      }
    };
    loadData();
  }, []);

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
      imageOverlays,
      overlayText,
      overlayTextColor,
      overlayTextSize,
      overlayTextX,
      overlayTextY,
      cameraFacing,
      idealWidth,
      idealHeight,
      idealFrameRate,
      brightness,
      contrast,
      saturation
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [
    destinations, tickerText, tickerSpeed, tickerHeightPercent, tickerYPercent,
    tickerTextColor, tickerBgColor, imageOverlays, overlayText, overlayTextColor,
    overlayTextSize, overlayTextX, overlayTextY, cameraFacing, idealWidth,
    idealHeight, idealFrameRate, brightness, contrast, saturation
  ]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);
  const tickerOffsetRef = useRef<number | null>(null);
  const imageElementsRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const mediaRecordersRef = useRef<Map<string, { recorder: MediaRecorder; ws: WebSocket }>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const destNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

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
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setHasError("Your browser does not support camera access.");
      return;
    }

    // Stop existing stream first to release the device
    setStream(prevStream => {
      if (prevStream) {
        prevStream.getTracks().forEach(track => track.stop());
      }
      return null;
    });

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
    } catch (err) {
      console.error("Error accessing camera:", err);
      if (!useBasicConstraints) {
        console.log("Retrying with basic constraints...");
        startCamera(true);
        return;
      }
      const errorMsg = err instanceof Error ? err.message : String(err);
      setHasError(errorMsg);
    }
  }, [cameraFacing, idealWidth, idealHeight, idealFrameRate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedOverlayId) {
        // Only delete if not typing in an input
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          setImageOverlays(prev => prev.filter(img => img.id !== selectedOverlayId));
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

        // 2. Draw Image Overlays
        imageOverlays.forEach(overlay => {
          const img = imageElementsRef.current.get(overlay.id);
          if (img && img.complete && img.naturalWidth > 0) {
            const size = (overlay.size / 100) * canvas.width;
            const x = (overlay.x / 100) * canvas.width;
            const y = (overlay.y / 100) * canvas.height;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate((overlay.rotation * Math.PI) / 180);
            
            const left = -size / 2;
            const top = -size / 2;

            ctx.drawImage(img, left, top, size, size);

            // Draw selection/hover feedback
            if (selectedOverlayId === overlay.id || hoveredOverlayId === overlay.id) {
              ctx.strokeStyle = selectedOverlayId === overlay.id ? '#10b981' : 'rgba(16, 185, 129, 0.5)';
              ctx.lineWidth = 2;
              ctx.setLineDash([5, 5]);
              ctx.strokeRect(left - 2, top - 2, size + 4, size + 4);
              ctx.setLineDash([]);

              if (selectedOverlayId === overlay.id) {
                // Draw Resize Handle (bottom-right)
                ctx.fillStyle = '#10b981';
                ctx.fillRect(left + size - 4, top + size - 4, 8, 8);
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.strokeRect(left + size - 4, top + size - 4, 8, 8);

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
          }
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

        // 4. Draw Text Overlay (if any)
        if (overlayText) {
          ctx.font = `${(overlayTextSize / 1000) * canvas.width}px sans-serif`;
          ctx.fillStyle = overlayTextColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // Add a subtle shadow for readability
          ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
          ctx.shadowBlur = 4;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
          
          ctx.fillText(
            overlayText, 
            (overlayTextX / 100) * canvas.width, 
            (overlayTextY / 100) * canvas.height
          );
          
          // Reset shadow
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        }
      }
      requestRef.current = requestAnimationFrame(render);
    };

    requestRef.current = requestAnimationFrame(render);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [tickerText, imageOverlays, tickerSpeed, overlayText, overlayTextColor, overlayTextSize, overlayTextX, overlayTextY, tickerHeightPercent, tickerYPercent, brightness, contrast, saturation, tickerTextColor, tickerBgColor, selectedOverlayId, hoveredOverlayId, rotatingImageId, resizingImageId]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const src = reader.result as string;
        const newOverlay: ImageOverlay = {
          id: Math.random().toString(36).substr(2, 9),
          src,
          size: 15,
          x: 50,
          y: 50,
          rotation: 0
        };
        setImageOverlays(prev => [...prev, newOverlay]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': []
    },
    multiple: true
  } as any);

  const toggleCamera = () => {
    setCameraFacing(prev => prev === 'user' ? 'environment' : 'user');
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
      if (stream && stream.getAudioTracks().length > 0) {
        console.log(`Mixing ${stream.getAudioTracks().length} microphone tracks`);
        const micSource = audioCtx.createMediaStreamSource(stream);
        micSource.connect(destNode);
        micSourceRef.current = micSource;
      } else {
        console.warn("No microphone stream available, sending silent audio");
      }

      // Add the mixed audio track to the canvas stream
      const mixedAudioTrack = destNode.stream.getAudioTracks()[0];
      canvasStream.addTrack(mixedAudioTrack);

      activeDestinations.forEach(dest => {
        try {
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
            
            setDestinations(prev => prev.map(d => 
              d.id === dest.id ? { ...d, status: 'streaming' } : d
            ));
          };

          ws.onerror = (err) => {
            console.error(`WebSocket error for ${dest.name}:`, err);
            updateDestination(dest.id, { status: 'disconnected' });
          };

          ws.onclose = () => {
            console.log(`WebSocket closed for ${dest.name}`);
            updateDestination(dest.id, { status: 'disconnected' });
          };

        } catch (err) {
          console.error(`Failed to start stream for ${dest.name}:`, err);
          updateDestination(dest.id, { status: 'disconnected' });
        }
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
      
      // Check if click is near the text (within 10% threshold)
      if (overlayText) {
        const distText = Math.sqrt(Math.pow(x - overlayTextX, 2) + Math.pow(y - overlayTextY, 2));
        if (distText < 10) {
          setIsDraggingText(true);
          setSelectedOverlayId(null);
          return;
        }
      }

      // Check images (reverse order to pick top-most)
      for (let i = imageOverlays.length - 1; i >= 0; i--) {
        const overlay = imageOverlays[i];
        const sizePx = (overlay.size / 100) * canvas.width;
        const xPx = (overlay.x / 100) * canvas.width;
        const yPx = (overlay.y / 100) * canvas.height;
        const rotationRad = (overlay.rotation * Math.PI) / 180;

        // Check Rotation Handle (top-center)
        // Handle is at (0, -size/2 - 25) in rotated space
        const handleDist = sizePx / 2 + 25;
        const handleXPx = xPx + Math.sin(rotationRad) * handleDist;
        const handleYPx = yPx - Math.cos(rotationRad) * handleDist;
        
        const distToRotationHandle = Math.sqrt(Math.pow(px - handleXPx, 2) + Math.pow(py - handleYPx, 2));
        if (distToRotationHandle < 15 && selectedOverlayId === overlay.id) {
          setRotatingImageId(overlay.id);
          return;
        }

        // Check Resize Handle (bottom-right)
        // Handle is at (size/2, size/2) in rotated space
        const handleOffset = sizePx / 2;
        const resizeXPx = xPx + Math.cos(rotationRad) * handleOffset - Math.sin(rotationRad) * handleOffset;
        const resizeYPx = yPx + Math.sin(rotationRad) * handleOffset + Math.cos(rotationRad) * handleOffset;
        
        const distToResizeHandle = Math.sqrt(Math.pow(px - resizeXPx, 2) + Math.pow(py - resizeYPx, 2));
        if (distToResizeHandle < 15 && selectedOverlayId === overlay.id) {
          setResizingImageId(overlay.id);
          return;
        }

        // Check if click is inside the image (accounting for rotation)
        const dx = px - xPx;
        const dy = py - yPx;
        const localX = dx * Math.cos(-rotationRad) - dy * Math.sin(-rotationRad);
        const localY = dx * Math.sin(-rotationRad) + dy * Math.cos(-rotationRad);

        if (Math.abs(localX) <= sizePx / 2 && Math.abs(localY) <= sizePx / 2) {
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
      for (let i = imageOverlays.length - 1; i >= 0; i--) {
        const overlay = imageOverlays[i];
        const sizePx = (overlay.size / 100) * canvas.width;
        const xPx = (overlay.x / 100) * canvas.width;
        const yPx = (overlay.y / 100) * canvas.height;
        const rotationRad = (overlay.rotation * Math.PI) / 180;

        const dx = px - xPx;
        const dy = py - yPx;
        const localX = dx * Math.cos(-rotationRad) - dy * Math.sin(-rotationRad);
        const localY = dx * Math.sin(-rotationRad) + dy * Math.cos(-rotationRad);

        if (Math.abs(localX) <= sizePx / 2 && Math.abs(localY) <= sizePx / 2) {
          foundHover = overlay.id;
          break;
        }
      }
      setHoveredOverlayId(foundHover);

      if (isDraggingText) {
        if (e.type === 'touchmove') e.preventDefault();
        setOverlayTextX(Math.max(0, Math.min(100, x)));
        setOverlayTextY(Math.max(0, Math.min(100, y)));
      } else if (draggingImageId) {
        if (e.type === 'touchmove') e.preventDefault();
        setImageOverlays(prev => prev.map(img => 
          img.id === draggingImageId 
            ? { ...img, x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) }
            : img
        ));
      } else if (resizingImageId) {
        if (e.type === 'touchmove') e.preventDefault();
        setImageOverlays(prev => prev.map(img => {
          if (img.id === resizingImageId) {
            const xPx = (img.x / 100) * canvas.width;
            const yPx = (img.y / 100) * canvas.height;
            const dist = Math.sqrt(Math.pow(px - xPx, 2) + Math.pow(py - yPx, 2));
            const newSize = Math.max(5, Math.min(100, (dist * 2 / canvas.width) * 100));
            return { ...img, size: newSize };
          }
          return img;
        }));
      } else if (rotatingImageId) {
        if (e.type === 'touchmove') e.preventDefault();
        setImageOverlays(prev => prev.map(img => {
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
      setIsDraggingText(false);
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
        {imageOverlays.map(overlay => (
          <img 
            key={overlay.id}
            ref={el => {
              if (el) imageElementsRef.current.set(overlay.id, el);
              else imageElementsRef.current.delete(overlay.id);
            }}
            src={overlay.src}
            className="absolute opacity-0 pointer-events-none"
            alt="Overlay Source"
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
              (isDraggingText || draggingImageId) ? "cursor-grabbing" : 
              (hoveredOverlayId || isDraggingText) ? "cursor-grab" : "cursor-default"
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
                <button 
                  onClick={() => startCamera()}
                  className="w-full bg-emerald-500 text-zinc-950 rounded-xl py-3 font-bold hover:bg-emerald-600 transition-all"
                >
                  Retry Camera
                </button>
              </div>
            </div>
          )}

          {/* Status Badge */}
          <div className="absolute top-6 left-6 flex flex-col gap-2 z-20">
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md transition-all",
              isStreaming ? "bg-red-500/20 border-red-500/50 text-red-500" : 
              destinations.some(d => d.status === 'connecting') ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-500" :
              "bg-zinc-900/40 border-white/10 text-zinc-400"
            )}>
              <div className={cn(
                "w-2 h-2 rounded-full",
                isStreaming ? "bg-red-500 animate-pulse" : 
                destinations.some(d => d.status === 'connecting') ? "bg-yellow-500 animate-bounce" : "bg-zinc-500"
              )} />
              <span className="text-[10px] font-black uppercase tracking-widest">
                {isStreaming ? `Live (${destinations.filter(d => d.status === 'streaming').length} Platforms)` : 
                 destinations.some(d => d.status === 'connecting') ? "Connecting..." : "Standby"}
              </span>
            </div>
            
            {isStreaming && (
              <div className="flex flex-col gap-1">
                {destinations.filter(d => d.status === 'streaming').map(d => (
                  <div key={d.id} className="flex items-center gap-2 px-2 py-1 bg-red-500/10 backdrop-blur-md border border-red-500/20 rounded-lg">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[8px] font-bold uppercase tracking-widest text-red-500">{d.name}</span>
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
            <button onClick={() => setActiveTab('overlays')} className={cn("px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-colors", activeTab === 'overlays' ? "bg-emerald-500 text-zinc-950" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700")}>Overlays</button>
            <button onClick={() => setActiveTab('ticker')} className={cn("px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-colors", activeTab === 'ticker' ? "bg-emerald-500 text-zinc-950" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700")}>Ticker</button>
            <button onClick={() => setActiveTab('adjust')} className={cn("px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-colors", activeTab === 'adjust' ? "bg-emerald-500 text-zinc-950" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700")}>Adjust</button>
          </div>

          <div className="p-6 overflow-y-auto flex-1">
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
              
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

              {/* Text Overlay Settings */}
              {activeTab === 'overlays' && (
              <div className="space-y-4">
              <div className="flex items-center gap-2 text-zinc-400">
                <Type className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-widest">Text Overlay</span>
              </div>
              <input 
                type="text"
                value={overlayText}
                onChange={(e) => setOverlayText(e.target.value)}
                className="w-full bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                placeholder="Overlay text..."
              />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Color</span>
                  <input 
                    type="color"
                    value={overlayTextColor}
                    onChange={(e) => setOverlayTextColor(e.target.value)}
                    className="w-full h-10 bg-zinc-800 border border-white/10 rounded-xl cursor-pointer"
                  />
                </div>
                <div className="space-y-2">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Size</span>
                  <input 
                    type="number"
                    value={overlayTextSize}
                    onChange={(e) => setOverlayTextSize(parseInt(e.target.value))}
                    className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                  <span>Position X/Y</span>
                </div>
                <div className="flex gap-2">
                  <input 
                    type="range"
                    min="0"
                    max="100"
                    value={overlayTextX}
                    onChange={(e) => setOverlayTextX(parseInt(e.target.value))}
                    className="flex-1 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <input 
                    type="range"
                    min="0"
                    max="100"
                    value={overlayTextY}
                    onChange={(e) => setOverlayTextY(parseInt(e.target.value))}
                    className="flex-1 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
              </div>
              </div>
              )}

              {/* Overlay Settings */}
              {activeTab === 'overlays' && (
              <div className="space-y-4">
              <div className="flex items-center gap-2 text-zinc-400">
                <ImageIcon className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-widest">Image / GIF Overlays</span>
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
                  Drop images or GIFs here
                </span>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {imageOverlays.map((overlay, index) => (
                  <div key={overlay.id} className="p-3 bg-zinc-800/50 border border-white/5 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-zinc-900 border border-white/5 overflow-hidden flex items-center justify-center">
                          <img src={overlay.src} className="max-w-full max-h-full object-contain" />
                        </div>
                        <span className="text-[10px] uppercase font-bold text-zinc-400">Overlay #{index + 1}</span>
                      </div>
                      <button 
                        onClick={() => setImageOverlays(prev => prev.filter(img => img.id !== overlay.id))}
                        className="p-1.5 hover:bg-red-500/10 text-zinc-500 hover:text-red-500 rounded-lg transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[8px] uppercase tracking-widest text-zinc-500 font-bold">
                        <span>Size</span>
                        <span className="text-emerald-500">{overlay.size}%</span>
                      </div>
                      <input 
                        type="range"
                        min="5"
                        max="50"
                        value={overlay.size}
                        onChange={(e) => setImageOverlays(prev => prev.map(img => img.id === overlay.id ? { ...img, size: parseInt(e.target.value) } : img))}
                        className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <span className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold">X: {overlay.x}%</span>
                        <input 
                          type="range"
                          min="0"
                          max="100"
                          value={overlay.x}
                          onChange={(e) => setImageOverlays(prev => prev.map(img => img.id === overlay.id ? { ...img, x: parseInt(e.target.value) } : img))}
                          className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold">Y: {overlay.y}%</span>
                        <input 
                          type="range"
                          min="0"
                          max="100"
                          value={overlay.y}
                          onChange={(e) => setImageOverlays(prev => prev.map(img => img.id === overlay.id ? { ...img, y: parseInt(e.target.value) } : img))}
                          className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
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
              <div className="space-y-4 md:col-span-2">
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
                          dest.status === 'connecting' ? "bg-yellow-500 animate-bounce" : "bg-zinc-500"
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
                          dest.status === 'connecting' ? "bg-yellow-500 animate-bounce" : "bg-zinc-500"
                        )} />
                        <span className={cn(
                          "text-[10px] uppercase tracking-widest font-bold",
                          dest.status === 'streaming' ? "text-red-500" : 
                          dest.status === 'connecting' ? "text-yellow-500" : "text-zinc-500"
                        )}>
                          {dest.name}: {dest.status === 'streaming' ? "Live" : 
                           dest.status === 'connecting' ? "Connecting" : "Idle"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              </div>
              )}

            </div>
          </div>
        </div>

        {/* Info Overlay for "Go Live" - Removed blocking overlay */}
      </div>
    </div>
  );
}
