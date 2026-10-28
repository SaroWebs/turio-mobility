export type NotificationLevel = 'success' | 'error' | 'info' | 'warning';

const notify = (message: string, type: NotificationLevel) => {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app:notification', {
            detail: { message, type },
        }));
    }
};

export const notificationService = {
    success: (message: string) => notify(message, 'success'),
    error: (message: string) => notify(message, 'error'),
    info: (message: string) => notify(message, 'info'),
    warning: (message: string) => notify(message, 'warning'),
};
