class Metronome {
    constructor() {
        this.bpm = 120;
        this.timeSignature = 4;
        this.isPlaying = false;
        this.currentBeat = 0;
        this.intervalId = null;
        this.audioContext = null;
        this.volume = 0.7;
        this.accentFirst = true;
        this.wakeLock = null;
        this.tapTimes = [];
        
        this.initializeAudio();
        this.initializeElements();
        this.bindEvents();
        this.updateDisplay();
        this.requestWakeLock();
    }

    initializeAudio() {
        // Initialize Web Audio API
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create master gain node for volume control
        this.masterGain = this.audioContext.createGain();
        this.masterGain.connect(this.audioContext.destination);
        this.masterGain.gain.value = this.volume;
    }

    initializeElements() {
        // Get DOM elements
        this.bpmValue = document.getElementById('bpmValue');
        this.bpmSlider = document.getElementById('bpmSlider');
        this.decreaseBpm = document.getElementById('decreaseBpm');
        this.increaseBpm = document.getElementById('increaseBpm');
        this.startStopBtn = document.getElementById('startStopBtn');
        this.tapTempoBtn = document.getElementById('tapTempoBtn');
        this.timeSignatureSelect = document.getElementById('timeSignature');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.accentFirstCheckbox = document.getElementById('accentFirst');
        this.keepScreenOnCheckbox = document.getElementById('keepScreenOn');
        this.beatDots = document.getElementById('beatDots');
        this.app = document.querySelector('.app');
    }

    bindEvents() {
        // BPM controls
        this.bpmSlider.addEventListener('input', (e) => {
            this.setBPM(parseInt(e.target.value));
        });

        this.decreaseBpm.addEventListener('click', () => {
            this.setBPM(Math.max(40, this.bpm - 1));
        });

        this.increaseBpm.addEventListener('click', () => {
            this.setBPM(Math.min(200, this.bpm + 1));
        });

        // Start/Stop button
        this.startStopBtn.addEventListener('click', () => {
            this.togglePlayback();
        });

        // Tap tempo
        this.tapTempoBtn.addEventListener('click', () => {
            this.tapTempo();
        });

        // Time signature
        this.timeSignatureSelect.addEventListener('change', (e) => {
            this.setTimeSignature(parseInt(e.target.value));
        });

        // Volume control
        this.volumeSlider.addEventListener('input', (e) => {
            this.setVolume(parseFloat(e.target.value));
        });

        // Settings
        this.accentFirstCheckbox.addEventListener('change', (e) => {
            this.accentFirst = e.target.checked;
        });

        this.keepScreenOnCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.requestWakeLock();
            } else {
                this.releaseWakeLock();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.togglePlayback();
            } else if (e.code === 'ArrowUp') {
                e.preventDefault();
                this.setBPM(Math.min(200, this.bpm + 1));
            } else if (e.code === 'ArrowDown') {
                e.preventDefault();
                this.setBPM(Math.max(40, this.bpm - 1));
            }
        });
    }

    setBPM(bpm) {
        this.bpm = bpm;
        this.bpmSlider.value = bpm;
        this.updateDisplay();
        
        if (this.isPlaying) {
            this.stop();
            this.start();
        }
    }

    setTimeSignature(beats) {
        this.timeSignature = beats;
        this.currentBeat = 0;
        this.updateBeatDisplay();
    }

    setVolume(volume) {
        this.volume = volume;
        if (this.masterGain) {
            this.masterGain.gain.value = volume;
        }
    }

    updateDisplay() {
        this.bpmValue.textContent = this.bpm;
    }

    updateBeatDisplay() {
        // Clear existing dots
        this.beatDots.innerHTML = '';
        
        // Create dots for current time signature
        for (let i = 0; i < this.timeSignature; i++) {
            const dot = document.createElement('div');
            dot.className = 'dot';
            if (i === this.currentBeat) {
                if (i === 0 && this.accentFirst) {
                    dot.classList.add('accent');
                } else {
                    dot.classList.add('active');
                }
            }
            this.beatDots.appendChild(dot);
        }
    }

    createBeep(frequency = 800, duration = 0.1, accent = false) {
        if (!this.audioContext) return;

        const now = this.audioContext.currentTime;
        
        // Create multiple oscillators for a richer mechanical sound
        const oscillator1 = this.audioContext.createOscillator();
        const oscillator2 = this.audioContext.createOscillator();
        const noiseBuffer = this.createNoiseBuffer();
        const noiseSource = this.audioContext.createBufferSource();
        
        const gainNode = this.audioContext.createGain();
        const noiseGain = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        // Configure main oscillators for the "tick" sound
        const baseFreq = accent ? 1200 : 800;
        oscillator1.frequency.value = baseFreq;
        oscillator1.type = 'square'; // Square wave for sharper attack
        
        oscillator2.frequency.value = baseFreq * 2; // Harmonic for richness
        oscillator2.type = 'triangle';
        
        // Configure noise for mechanical texture
        noiseSource.buffer = noiseBuffer;
        filter.type = 'highpass';
        filter.frequency.value = 2000;
        filter.Q.value = 1;
        
        // Connect audio nodes
        oscillator1.connect(gainNode);
        oscillator2.connect(gainNode);
        noiseSource.connect(noiseGain);
        noiseGain.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.masterGain);

        // Create mechanical metronome envelope (sharp attack, quick decay)
        const attackTime = 0.005; // Very quick attack (5ms)
        const decayTime = 0.03;   // Quick decay (30ms)
        const sustainLevel = accent ? 0.4 : 0.25;
        const releaseTime = accent ? 0.08 : 0.05;
        
        // Main oscillator envelope
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(sustainLevel, now + attackTime);
        gainNode.gain.exponentialRampToValueAtTime(sustainLevel * 0.3, now + attackTime + decayTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + attackTime + decayTime + releaseTime);
        
        // Noise envelope (even shorter for just the initial "click")
        const noiseLevel = accent ? 0.15 : 0.08;
        noiseGain.gain.setValueAtTime(0, now);
        noiseGain.gain.linearRampToValueAtTime(noiseLevel, now + 0.002);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);

        // Start and stop sounds
        oscillator1.start(now);
        oscillator1.stop(now + attackTime + decayTime + releaseTime);
        
        oscillator2.start(now);
        oscillator2.stop(now + attackTime + decayTime + releaseTime);
        
        noiseSource.start(now);
        noiseSource.stop(now + 0.02);
    }

    createNoiseBuffer() {
        const bufferSize = this.audioContext.sampleRate * 0.02; // 20ms of noise
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const output = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1; // White noise
        }

        return buffer;
    }

    beat() {
        const isAccent = this.currentBeat === 0 && this.accentFirst;
        this.createBeep(800, 0.1, isAccent);
        
        // Visual feedback
        this.updateBeatDisplay();
        
        // Add pulse animation to BPM display
        this.bpmValue.classList.add('beat-pulse');
        setTimeout(() => {
            this.bpmValue.classList.remove('beat-pulse');
        }, 100);

        this.currentBeat = (this.currentBeat + 1) % this.timeSignature;
    }

    start() {
        if (this.isPlaying) return;

        // Resume audio context if suspended
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        this.isPlaying = true;
        this.currentBeat = 0;
        
        // Calculate interval (60000ms / BPM)
        const interval = 60000 / this.bpm;
        
        // Start immediately with first beat
        this.beat();
        
        // Set up recurring beats
        this.intervalId = setInterval(() => {
            this.beat();
        }, interval);

        // Update UI
        this.startStopBtn.innerHTML = '<span class="btn-text">STOP</span>';
        this.startStopBtn.classList.add('stop');
        this.app.classList.add('playing');
    }

    stop() {
        if (!this.isPlaying) return;

        this.isPlaying = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        this.currentBeat = 0;
        this.updateBeatDisplay();

        // Update UI
        this.startStopBtn.innerHTML = '<span class="btn-text">START</span>';
        this.startStopBtn.classList.remove('stop');
        this.app.classList.remove('playing');
    }

    togglePlayback() {
        if (this.isPlaying) {
            this.stop();
        } else {
            this.start();
        }
    }

    tapTempo() {
        const now = Date.now();
        this.tapTimes.push(now);

        // Keep only the last 8 taps
        if (this.tapTimes.length > 8) {
            this.tapTimes.shift();
        }

        // Need at least 2 taps to calculate tempo
        if (this.tapTimes.length >= 2) {
            const intervals = [];
            for (let i = 1; i < this.tapTimes.length; i++) {
                intervals.push(this.tapTimes[i] - this.tapTimes[i - 1]);
            }

            const averageInterval = intervals.reduce((a, b) => a + b) / intervals.length;
            const bpm = Math.round(60000 / averageInterval);

            // Only update if BPM is within reasonable range
            if (bpm >= 40 && bpm <= 200) {
                this.setBPM(bpm);
            }
        }

        // Clear old taps after 3 seconds of inactivity
        setTimeout(() => {
            const currentTime = Date.now();
            this.tapTimes = this.tapTimes.filter(time => currentTime - time < 3000);
        }, 3000);

        // Visual feedback
        this.tapTempoBtn.style.transform = 'scale(0.95)';
        setTimeout(() => {
            this.tapTempoBtn.style.transform = '';
        }, 100);
    }

    async requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                this.wakeLock = await navigator.wakeLock.request('screen');
                console.log('Screen wake lock acquired');
                
                this.wakeLock.addEventListener('release', () => {
                    console.log('Screen wake lock released');
                });
            } catch (err) {
                console.error('Failed to acquire screen wake lock:', err);
            }
        } else {
            console.log('Screen Wake Lock API not supported');
        }
    }

    releaseWakeLock() {
        if (this.wakeLock) {
            this.wakeLock.release();
            this.wakeLock = null;
        }
    }
}

// Initialize the metronome when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.metronome = new Metronome();
});

// Handle page visibility changes to maintain wake lock
document.addEventListener('visibilitychange', () => {
    if (window.metronome && window.metronome.keepScreenOnCheckbox.checked) {
        if (document.visibilityState === 'visible') {
            window.metronome.requestWakeLock();
        }
    }
});

// Register service worker for PWA functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}