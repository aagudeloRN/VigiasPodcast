/**
 * Utilidades de validación
 */

export const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

export const validateCompanyName = (name) => {
    return name && name.trim().length >= 2;
};

export const validateAudioDuration = (duration) => {
    return duration >= 1000; // Mínimo 1 segundo
};