/**
 * Componente para manejo de grabación de audio
 */

import { CONFIG, MESSAGES } from '../utils/constants.js';

export class AudioRecorder {
    constructor(elements, callbacks = {}) {
        this.elements = elements;
        this.callbacks = callbacks;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.timerInterval = null;
        this.startTime = null;
        this.stream = null;
        this.isRecording = false;
        
        this.init();
    }

    init() {
        this.elements.startBtn.addEventListener('click', () => this.startRecording());
        this.elements.stopBtn.addEventListener('click', () => this.stopRecording());
        
        // Keyboard accessibility
        this.elements.startBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.startRecording();
            }
        });
        
        this.elements.stopBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.stopRecording();
            }
        });
    }

    async startRecording() {
        if (this.isRecording) return;

        try {
            // Solicitar permisos de micrófono con configuración específica
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 44100
                }
            });

            // Verificar soporte de MediaRecorder
            const mimeTypes = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/mp4',
                'audio/ogg;codecs=opus'
            ];
            
            let selectedMimeType = '';
            for (const mimeType of mimeTypes) {
                if (MediaRecorder.isTypeSupported(mimeType)) {
                    selectedMimeType = mimeType;
                    break;
                }
            }

            this.mediaRecorder = new MediaRecorder(this.stream, {
                mimeType: selectedMimeType
            });

            this.audioChunks = [];
            this.setupMediaRecorderEvents();
            
            this.mediaRecorder.start(100); // Capturar datos cada 100ms
            this.startTimer();
            this.updateUI(true);
            this.isRecording = true;

            this.callbacks.onStart?.(MESSAGES.SUCCESS.RECORDING_STARTED);

        } catch (error) {
            console.error('Error al iniciar grabación:', error);
            this.handleRecordingError(error);
        }
    }

    setupMediaRecorderEvents() {
        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.audioChunks.push(event.data);
            }
        };

        this.mediaRecorder.onstop = () => {
            this.processRecording();
        };

        this.mediaRecorder.onerror = (event) => {
            console.error('Error en MediaRecorder:', event.error);
            this.callbacks.onError?.(MESSAGES.ERRORS.GENERIC_ERROR);
        };
    }

    processRecording() {
        if (this.audioChunks.length === 0) {
            this.callbacks.onError?.(MESSAGES.ERRORS.NO_AUDIO);
            return;
        }

        const mimeType = this.mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        
        // Verificar duración mínima (aproximada por tamaño)
        if (audioBlob.size < 1000) {
            this.callbacks.onError?.(MESSAGES.ERRORS.SHORT_AUDIO);
            return;
        }

        const audioUrl = URL.createObjectURL(audioBlob);
        this.elements.preview.src = audioUrl;
        this.elements.preview.style.display = 'block';
        
        // Limpiar URL anterior si existe
        if (this.elements.preview.dataset.previousUrl) {
            URL.revokeObjectURL(this.elements.preview.dataset.previousUrl);
        }
        this.elements.preview.dataset.previousUrl = audioUrl;

        this.callbacks.onStop?.(MESSAGES.SUCCESS.RECORDING_STOPPED, audioBlob, mimeType);
    }

    stopRecording() {
        if (!this.isRecording || !this.mediaRecorder) return;

        try {
            if (this.mediaRecorder.state === 'recording') {
                this.mediaRecorder.stop();
            }
            
            this.stopTimer();
            this.cleanupStream();
            this.updateUI(false);
            this.isRecording = false;

        } catch (error) {
            console.error('Error al detener grabación:', error);
            this.callbacks.onError?.(MESSAGES.ERRORS.GENERIC_ERROR);
        }
    }

    startTimer() {
        this.startTime = Date.now();
        this.timerInterval = setInterval(() => {
            const elapsed = Date.now() - this.startTime;
            this.updateTimerDisplay(elapsed);
            
            // Auto-stop al llegar al límite
            if (elapsed >= CONFIG.MAX_RECORDING_TIME) {
                this.stopRecording();
            }
        }, CONFIG.TIMER_UPDATE_INTERVAL);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    updateTimerDisplay(elapsed) {
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        const centiseconds = Math.floor((elapsed % 1000) / 10);
        
        this.elements.timer.textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
        
        // Cambiar color cuando se acerque al límite
        const remainingTime = CONFIG.MAX_RECORDING_TIME - elapsed;
        if (remainingTime <= 10000) { // Últimos 10 segundos
            this.elements.timer.style.color = 'var(--color-orange)';
        } else {
            this.elements.timer.style.color = 'var(--color-yellow)';
        }
    }

    updateUI(isRecording) {
        this.elements.startBtn.disabled = isRecording;
        this.elements.stopBtn.disabled = !isRecording;
        
        // Actualizar aria-labels para accesibilidad
        this.elements.startBtn.setAttribute('aria-label', 
            isRecording ? 'Grabación en curso' : 'Iniciar grabación de audio');
        this.elements.stopBtn.setAttribute('aria-label', 
            isRecording ? 'Detener grabación actual' : 'No hay grabación activa');
    }

    cleanupStream() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => {
                track.stop();
            });
            this.stream = null;
        }
    }

    handleRecordingError(error) {
        let errorMessage = MESSAGES.ERRORS.MICROPHONE_ACCESS;
        
        if (error.name === 'NotAllowedError') {
            errorMessage = 'Permisos de micrófono denegados. Habilita el acceso en la configuración del navegador.';
        } else if (error.name === 'NotFoundError') {
            errorMessage = 'No se encontró micrófono. Conecta un dispositivo de audio.';
        } else if (error.name === 'NotReadableError') {
            errorMessage = 'El micrófono está siendo usado por otra aplicación.';
        }
        
        this.callbacks.onError?.(errorMessage);
    }

    getAudioData() {
        if (this.audioChunks.length === 0) return null;
        
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        
        return {
            blob: audioBlob,
            mimeType: mimeType,
            extension: mimeType.split('/')[1].split(';')[0]
        };
    }

    reset() {
        this.stopRecording();
        this.audioChunks = [];
        this.elements.preview.style.display = 'none';
        this.elements.timer.textContent = '00:00.00';
        this.elements.timer.style.color = 'var(--color-yellow)';
        
        // Limpiar URL del preview
        if (this.elements.preview.dataset.previousUrl) {
            URL.revokeObjectURL(this.elements.preview.dataset.previousUrl);
            delete this.elements.preview.dataset.previousUrl;
        }
    }

    destroy() {
        this.stopRecording();
        this.cleanupStream();
        
        if (this.elements.preview.dataset.previousUrl) {
            URL.revokeObjectURL(this.elements.preview.dataset.previousUrl);
        }
    }
}