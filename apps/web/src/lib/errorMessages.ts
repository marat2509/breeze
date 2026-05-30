type UiLocale = 'en' | 'ru';

/**
 * Maps fetch errors to user-friendly messages based on error type.
 */
export function getErrorMessage(error: unknown, locale: UiLocale = 'en'): string {
  const ru = locale === 'ru';
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return ru ? 'Не удалось подключиться к серверу. Проверьте соединение и повторите попытку.' : 'Unable to reach the server. Check your connection and try again.';
  }
  if (error instanceof Response) {
    if (error.status === 401 || error.status === 403)
      return ru ? 'Сессия истекла. Войдите снова.' : 'Your session has expired. Please sign in again.';
    if (error.status >= 500)
      return ru ? 'На нашей стороне произошла ошибка. Мы уже разбираемся.' : "Something went wrong on our end. We're looking into it.";
  }
  const msg = error instanceof Error ? error.message : String(error);
  if (
    msg.includes('NetworkError') ||
    msg.includes('ERR_CONNECTION') ||
    msg.includes('Failed to fetch')
  ) {
    return ru ? 'Не удалось подключиться к серверу. Проверьте соединение и повторите попытку.' : 'Unable to reach the server. Check your connection and try again.';
  }
  return ru ? 'Не удалось загрузить данные. Попробуйте обновить страницу.' : "Couldn't load data. Try refreshing the page.";
}

/**
 * Extracts a short title from a fetch error for the error UI header.
 */
export function getErrorTitle(error: unknown, locale: UiLocale = 'en'): string {
  const ru = locale === 'ru';
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return ru ? 'Ошибка подключения' : 'Connection error';
  }
  if (error instanceof Response) {
    if (error.status === 401 || error.status === 403) return ru ? 'Сессия истекла' : 'Session expired';
    if (error.status >= 500) return ru ? 'Ошибка сервера' : 'Server error';
  }
  const msg = error instanceof Error ? error.message : String(error);
  if (
    msg.includes('NetworkError') ||
    msg.includes('ERR_CONNECTION') ||
    msg.includes('Failed to fetch')
  ) {
    return ru ? 'Ошибка подключения' : 'Connection error';
  }
  return ru ? 'Не удалось загрузить' : 'Failed to load';
}
