/**
 * Constantes de la aplicación
 */

export const CONFIG = {
    WEBHOOK_URL: 'https://primary-production-ddbf.up.railway.app/webhook-test/formulario',
    MAX_RECORDING_TIME: 120000, // 2 minutos en ms
    MIN_RECORDING_TIME: 1000,   // 1 segundo en ms
    TIMER_UPDATE_INTERVAL: 100, // Actualizar cada 100ms para mayor precisión
};

export const MESSAGES = {
    ERRORS: {
        INVALID_EMAIL: 'Por favor, ingresa un correo electrónico válido',
        EMPTY_COMPANY: 'El nombre de la empresa es obligatorio (mínimo 2 caracteres)',
        NO_AUDIO: 'Debes grabar un mensaje de audio antes de enviar',
        SHORT_AUDIO: 'El audio debe durar al menos 1 segundo',
        MICROPHONE_ACCESS: 'No se pudo acceder al micrófono. Verifica los permisos.',
        NETWORK_ERROR: 'Error de conexión. Verifica tu internet e intenta nuevamente.',
        SERVER_ERROR: 'Error del servidor. Intenta más tarde.',
        GENERIC_ERROR: 'Ocurrió un error inesperado. Intenta nuevamente.',
    },
    SUCCESS: {
        FORM_SENT: '¡Mensaje enviado exitosamente! Gracias por compartir tu historia.',
        RECORDING_STARTED: 'Grabación iniciada',
        RECORDING_STOPPED: 'Grabación detenida',
    },
    STATUS: {
        PREPARING: 'Preparando envío...',
        SENDING: 'Enviando mensaje...',
        PROCESSING: 'Procesando audio...',
    }
};