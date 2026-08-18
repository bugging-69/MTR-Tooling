import React, { useState, useEffect, useRef } from 'react';
import { Video, Mic, Monitor, Volume2, Play, RefreshCw, X, AlertCircle } from 'lucide-react';

export const LiveWebTester: React.FC = () => {
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [selectedMic, setSelectedMic] = useState<string>('');
  
  const [hasStarted, setHasStarted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isPlayingTestSound, setIsPlayingTestSound] = useState(false);
  
  const [camRes, setCamRes] = useState<string>('');
  const [screenRes, setScreenRes] = useState<string>('');

  const activeAudioContext = useRef<AudioContext | null>(null);
  const activeStream = useRef<MediaStream | null>(null);
  const micStream = useRef<MediaStream | null>(null);
  const screenStream = useRef<MediaStream | null>(null);

  const requestPermissions = async () => {
    setErrorMsg(null);
    try {
      // User gesture triggered, attempt to get devices
      const initialStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      initialStream.getTracks().forEach(t => t.stop());
      await refreshDevices();
      setHasStarted(true);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Device access denied. Make sure permissions are granted.');
    }
  };

  const refreshDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      
      setCameras(videoInputs);
      setMics(audioInputs);
      
      if (videoInputs.length > 0 && !selectedCamera) setSelectedCamera(videoInputs[0].deviceId);
      if (audioInputs.length > 0 && !selectedMic) setSelectedMic(audioInputs[0].deviceId);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!selectedCamera) return;
    
    const startCam = async () => {
      try {
        if (activeStream.current) {
          activeStream.current.getTracks().forEach(t => t.stop());
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: selectedCamera } }
        });
        
        activeStream.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        const track = stream.getVideoTracks()[0];
        if (track) {
          const settings = track.getSettings();
          setCamRes(`${settings.width}x${settings.height} @ ${Math.round(settings.frameRate || 0)}fps`);
        }
      } catch (err) {
        console.error("Camera Error:", err);
      }
    };

    startCam();
    
    return () => {
      if (activeStream.current) {
        activeStream.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [selectedCamera]);

  useEffect(() => {
    if (!selectedMic) return;
    
    const startMic = async () => {
      try {
        if (micStream.current) {
          micStream.current.getTracks().forEach(t => t.stop());
        }
        if (activeAudioContext.current) {
          activeAudioContext.current.close();
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: selectedMic } }
        });
        micStream.current = stream;

        const actx = new (window.AudioContext || (window as any).webkitAudioContext)();
        activeAudioContext.current = actx;
        const source = actx.createMediaStreamSource(stream);
        const analyser = actx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        const updateLevel = () => {
          if (!activeAudioContext.current) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for(let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          let avg = sum / dataArray.length;
          setAudioLevel(Math.min(100, Math.round((avg / 255) * 100 * 2))); 
          requestAnimationFrame(updateLevel);
        };
        updateLevel();

      } catch (err) {
        console.error("Mic Error:", err);
      }
    };

    startMic();
    
    return () => {
      if (micStream.current) {
        micStream.current.getTracks().forEach(t => t.stop());
      }
      if (activeAudioContext.current) {
        activeAudioContext.current.close();
        activeAudioContext.current = null;
      }
    };
  }, [selectedMic]);

  const startScreen = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStream.current = stream;
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
      }
      const track = stream.getVideoTracks()[0];
      if (track) {
        const settings = track.getSettings();
        setScreenRes(`${settings.width}x${settings.height} @ ${Math.round(settings.frameRate || 0)}fps`);
        
        track.onended = () => {
          stopScreen();
        };
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Screen sharing access denied or not supported in this context.');
    }
  };

  const stopScreen = () => {
    if (screenStream.current) {
      screenStream.current.getTracks().forEach(t => t.stop());
      screenStream.current = null;
    }
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null;
    }
    setScreenRes('');
  };

  const playSpeakerTestChime = () => {
    setIsPlayingTestSound(true);
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = ctx.currentTime;
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(440, now);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.8);
      
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, now + 0.25);
      gain2.gain.setValueAtTime(0.3, now + 0.25);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.25);
      osc2.stop(now + 1.0);
      
      setTimeout(() => {
        setIsPlayingTestSound(false);
      }, 1600);
    } catch (e) {
      console.error(e);
      setIsPlayingTestSound(false);
    }
  };

  if (!hasStarted) {
    return (
      <div className="max-w-xl mx-auto space-y-6 mt-12 text-center">
        <div className="p-4 bg-slate-800 rounded-2xl border border-slate-700 shadow-xl max-w-sm mx-auto">
          <div className="w-16 h-16 mx-auto bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
            <Video className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-100 mb-2">Hardware Tester</h2>
          <p className="text-sm text-slate-400 mb-6">
            To test your camera, microphone, and screen, this app requires device permissions.
          </p>
          <button
            onClick={requestPermissions}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition shadow-lg shadow-blue-500/20"
          >
            Request Permissions
          </button>
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm flex items-start justify-center space-x-3 max-w-md mx-auto">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-left">
              <h4 className="font-semibold text-red-300">Device Access Denied</h4>
              <p className="mt-1 opacity-80">{errorMsg}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Live Hardware Test</h2>
          <p className="text-sm text-slate-400">Select and verify your cameras, microphones, and screens.</p>
        </div>
        <button
          onClick={refreshDevices}
          className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-sm transition"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh Devices</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Camera Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center space-x-2">
            <Video className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-slate-100">Camera</h3>
          </div>
          
          <select
            value={selectedCamera}
            onChange={(e) => setSelectedCamera(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="">Select a camera...</option>
            {cameras.map(c => (
              <option key={c.deviceId} value={c.deviceId}>
                {c.label || `Camera ${c.deviceId.slice(0, 5)}`}
              </option>
            ))}
          </select>

          <div className="bg-slate-950 rounded-lg aspect-video border border-slate-800 overflow-hidden relative flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>
          
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-400">Resolution & FPS:</span>
            <span className="text-blue-300 font-mono">{camRes || 'N/A'}</span>
          </div>
        </div>

        {/* Microphone Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center space-x-2">
            <Mic className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-slate-100">Microphone</h3>
          </div>
          
          <select
            value={selectedMic}
            onChange={(e) => setSelectedMic(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="">Select a microphone...</option>
            {mics.map(m => (
              <option key={m.deviceId} value={m.deviceId}>
                {m.label || `Mic ${m.deviceId.slice(0, 5)}`}
              </option>
            ))}
          </select>

          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-sm text-slate-400">
              <span>Input Level</span>
              <span className="font-mono text-indigo-400">{audioLevel}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-4 overflow-hidden border border-slate-700">
              <div
                className="bg-gradient-to-r from-emerald-500 via-yellow-400 to-red-500 h-full rounded-full transition-all duration-75"
                style={{ width: `${audioLevel}%` }}
              />
            </div>
          </div>
        </div>

        {/* Screen Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Monitor className="w-5 h-5 text-amber-400" />
              <h3 className="font-semibold text-slate-100">Screen Share</h3>
            </div>
            {screenRes && (
              <button onClick={stopScreen} className="text-red-400 hover:text-red-300 p-1">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {!screenRes ? (
            <button
              onClick={startScreen}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-2 rounded-lg text-sm transition flex items-center justify-center space-x-2"
            >
              <Monitor className="w-4 h-4" />
              <span>Select Screen/Window to Test</span>
            </button>
          ) : (
            <div className="bg-slate-950 rounded-lg aspect-video border border-slate-800 overflow-hidden relative flex items-center justify-center">
              <video
                ref={screenVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain"
              />
            </div>
          )}

          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-400">Resolution & FPS:</span>
            <span className="text-amber-300 font-mono">{screenRes || 'N/A'}</span>
          </div>
        </div>

        {/* Audio Output Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center space-x-2">
            <Volume2 className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-slate-100">Speakers</h3>
          </div>
          
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-center space-y-3">
            <p className="text-sm text-slate-400">
              Test default audio output device.
            </p>
            <button
              onClick={playSpeakerTestChime}
              disabled={isPlayingTestSound}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition flex items-center justify-center space-x-2"
            >
              <Play className="w-4 h-4" />
              <span>{isPlayingTestSound ? 'Playing Chime...' : 'Play Test Chime'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
