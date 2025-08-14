/**
 * Punto de entrada principal de la aplicación
 */

import { FormHandler } from './src/components/FormHandler.js';

// Inicializar aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Verificar soporte de APIs necesarias
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Tu navegador no soporta grabación de audio');
        }

        if (!window.MediaRecorder) {
            throw new Error('Tu navegador no soporta MediaRecorder');
        }

        // Inicializar manejador del formulario
        const formHandler = new FormHandler();
        
        // Manejar cleanup cuando se cierre la página
        window.addEventListener('beforeunload', () => {
            formHandler.destroy();
        });

        // Manejar errores globales
        window.addEventListener('error', (event) => {
            console.error('Error global:', event.error);
        });

        window.addEventListener('unhandledrejection', (event) => {
            console.error('Promise rechazada:', event.reason);
        });

    } catch (error) {
        console.error('Error al inicializar aplicación:', error);
        
        // Mostrar mensaje de error al usuario
        const container = document.querySelector('.container');
        if (container) {
            container.innerHTML = `
                <div class="error-container">
                    <h2>Error de Compatibilidad</h2>
                    <p>${error.message}</p>
                    <p>Por favor, usa un navegador moderno como Chrome, Firefox o Safari.</p>
                </div>
            `;
        }
    }
});