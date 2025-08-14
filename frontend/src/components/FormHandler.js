/**
 * Manejador principal del formulario
 */

import { validateEmail, validateCompanyName } from '../utils/validation.js';
import { CONFIG, MESSAGES } from '../utils/constants.js';
import { AudioRecorder } from './AudioRecorder.js';

export class FormHandler {
    constructor() {
        this.elements = this.getElements();
        this.audioRecorder = null;
        this.isSubmitting = false;
        
        this.init();
    }

    getElements() {
        const elements = {
            form: document.getElementById('registroForm'),
            emailInput: document.getElementById('email'),
            empresaInput: document.getElementById('empresa'),
            startRecordingBtn: document.getElementById('startRecording'),
            stopRecordingBtn: document.getElementById('stopRecording'),
            audioPreview: document.getElementById('audioPreview'),
            timerDisplay: document.getElementById('timerDisplay'),
            submitBtn: document.getElementById('submitBtn'),
            submitStatus: document.getElementById('submitStatus'),
            emailError: document.getElementById('emailError'),
            empresaError: document.getElementById('empresaError'),
            audioError: document.getElementById('audioError')
        };

        // Verificar que todos los elementos existen
        const missingElements = Object.entries(elements)
            .filter(([key, element]) => !element)
            .map(([key]) => key);

        if (missingElements.length > 0) {
            console.error('Elementos faltantes:', missingElements);
            throw new Error(`Elementos del DOM no encontrados: ${missingElements.join(', ')}`);
        }

        return elements;
    }

    init() {
        this.setupEventListeners();
        this.initializeAudioRecorder();
        this.setupFormValidation();
    }

    setupEventListeners() {
        // Transformar empresa a mayúsculas
        this.elements.empresaInput.addEventListener('input', (e) => {
            const cursorPosition = e.target.selectionStart;
            e.target.value = e.target.value.toUpperCase();
            e.target.setSelectionRange(cursorPosition, cursorPosition);
        });

        // Validación en tiempo real
        this.elements.emailInput.addEventListener('blur', () => this.validateEmailField());
        this.elements.empresaInput.addEventListener('blur', () => this.validateCompanyField());

        // Envío del formulario
        this.elements.form.addEventListener('submit', (e) => this.handleSubmit(e));

        // Prevenir envío accidental con Enter en campos de texto
        [this.elements.emailInput, this.elements.empresaInput].forEach(input => {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    input.blur();
                }
            });
        });
    }

    initializeAudioRecorder() {
        const audioElements = {
            startBtn: this.elements.startRecordingBtn,
            stopBtn: this.elements.stopRecordingBtn,
            preview: this.elements.audioPreview,
            timer: this.elements.timerDisplay
        };

        const callbacks = {
            onStart: (message) => this.showStatus(message, 'info'),
            onStop: (message) => this.showStatus(message, 'success'),
            onError: (message) => {
                this.showError('audioError', message);
                this.showStatus(message, 'error');
            }
        };

        this.audioRecorder = new AudioRecorder(audioElements, callbacks);
    }

    setupFormValidation() {
        // Configurar atributos de accesibilidad
        this.elements.emailInput.setAttribute('aria-describedby', 'emailError');
        this.elements.empresaInput.setAttribute('aria-describedby', 'empresaError');
        this.elements.startRecordingBtn.setAttribute('aria-describedby', 'audioError');
    }

    validateEmailField() {
        const email = this.elements.emailInput.value.trim();
        if (email && !validateEmail(email)) {
            this.showError('emailError', MESSAGES.ERRORS.INVALID_EMAIL);
            return false;
        }
        this.clearError('emailError');
        return true;
    }

    validateCompanyField() {
        const company = this.elements.empresaInput.value.trim();
        if (company && !validateCompanyName(company)) {
            this.showError('empresaError', MESSAGES.ERRORS.EMPTY_COMPANY);
            return false;
        }
        this.clearError('empresaError');
        return true;
    }

    validateForm() {
        let isValid = true;
        this.clearAllErrors();

        // Validar email
        const email = this.elements.emailInput.value.trim();
        if (!email) {
            this.showError('emailError', 'El correo electrónico es obligatorio');
            isValid = false;
        } else if (!validateEmail(email)) {
            this.showError('emailError', MESSAGES.ERRORS.INVALID_EMAIL);
            isValid = false;
        }

        // Validar empresa
        const empresa = this.elements.empresaInput.value.trim();
        if (!empresa) {
            this.showError('empresaError', 'El nombre de la empresa es obligatorio');
            isValid = false;
        } else if (!validateCompanyName(empresa)) {
            this.showError('empresaError', MESSAGES.ERRORS.EMPTY_COMPANY);
            isValid = false;
        }

        // Validar audio
        const audioData = this.audioRecorder.getAudioData();
        if (!audioData) {
            this.showError('audioError', MESSAGES.ERRORS.NO_AUDIO);
            isValid = false;
        }

        return isValid;
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        if (this.isSubmitting) return;
        
        if (!this.validateForm()) {
            this.focusFirstError();
            return;
        }

        this.isSubmitting = true;
        this.elements.submitBtn.disabled = true;
        
        try {
            await this.submitForm();
        } catch (error) {
            console.error('Error en envío:', error);
            this.handleSubmitError(error);
        } finally {
            this.isSubmitting = false;
            this.elements.submitBtn.disabled = false;
        }
    }

    async submitForm() {
        this.showStatus(MESSAGES.STATUS.PREPARING, 'info');

        const formData = new FormData();
        formData.append('email', this.elements.emailInput.value.trim());
        formData.append('empresa', this.elements.empresaInput.value.trim().toUpperCase());

        const audioData = this.audioRecorder.getAudioData();
        if (audioData) {
            formData.append('audio', audioData.blob, `pitch.${audioData.extension}`);
        }

        this.showStatus(MESSAGES.STATUS.SENDING, 'info');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos timeout

        try {
            const response = await fetch(CONFIG.WEBHOOK_URL, {
                method: 'POST',
                body: formData,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Intentar parsear respuesta JSON si está disponible
            let responseData = null;
            try {
                responseData = await response.json();
            } catch {
                // Respuesta no es JSON, continuar
            }

            this.handleSubmitSuccess(responseData);

        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    handleSubmitSuccess(responseData) {
        this.showStatus(MESSAGES.SUCCESS.FORM_SENT, 'success');
        
        // Reset form
        this.elements.form.reset();
        this.audioRecorder.reset();
        this.clearAllErrors();
        
        // Scroll to top para mostrar mensaje de éxito
        this.elements.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        // Focus en el primer campo para nueva entrada
        setTimeout(() => {
            this.elements.emailInput.focus();
        }, 1000);
    }

    handleSubmitError(error) {
        let errorMessage = MESSAGES.ERRORS.GENERIC_ERROR;

        if (error.name === 'AbortError') {
            errorMessage = 'La solicitud tardó demasiado. Verifica tu conexión e intenta nuevamente.';
        } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            errorMessage = MESSAGES.ERRORS.NETWORK_ERROR;
        } else if (error.message.includes('HTTP 5')) {
            errorMessage = MESSAGES.ERRORS.SERVER_ERROR;
        } else if (error.message.includes('HTTP 4')) {
            errorMessage = 'Error en los datos enviados. Verifica la información e intenta nuevamente.';
        }

        this.showStatus(errorMessage, 'error');
    }

    showError(elementId, message) {
        const errorElement = this.elements[elementId];
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.color = 'var(--color-orange)';
            
            // Agregar clase para animación
            errorElement.classList.add('error-show');
        }
    }

    clearError(elementId) {
        const errorElement = this.elements[elementId];
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.classList.remove('error-show');
        }
    }

    clearAllErrors() {
        ['emailError', 'empresaError', 'audioError'].forEach(errorId => {
            this.clearError(errorId);
        });
    }

    focusFirstError() {
        const errorElements = [
            { element: this.elements.emailError, input: this.elements.emailInput },
            { element: this.elements.empresaError, input: this.elements.empresaInput },
            { element: this.elements.audioError, input: this.elements.startRecordingBtn }
        ];

        for (const { element, input } of errorElements) {
            if (element.textContent) {
                input.focus();
                input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                break;
            }
        }
    }

    showStatus(message, type = 'info') {
        this.elements.submitStatus.textContent = message;
        this.elements.submitStatus.className = `status-message ${type}`;
        
        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                if (this.elements.submitStatus.classList.contains('success')) {
                    this.elements.submitStatus.textContent = '';
                    this.elements.submitStatus.className = 'status-message';
                }
            }, 5000);
        }
    }

    destroy() {
        if (this.audioRecorder) {
            this.audioRecorder.destroy();
        }
    }
}