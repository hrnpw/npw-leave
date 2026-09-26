export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiClient<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      let errorMessage = 'เกิดข้อผิดพลาด';
      let errorData;

      try {
        errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        // Response is not JSON
      }

      switch (response.status) {
        case 400:
          throw new ApiError(errorMessage, 400, errorData);
        case 401:
          // Session expired or invalid - clear cookie and redirect to home
          if (typeof window !== 'undefined') {
            const currentPath = window.location.pathname;

            // Determine which session type and redirect accordingly
            if (currentPath.startsWith('/hr')) {
              // HR session expired - redirect to home page
              document.cookie = 'hr_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
              window.location.href = '/';
            } else if (currentPath.startsWith('/teacher')) {
              // Teacher session expired - redirect to home page
              document.cookie = 'teacher_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
              window.location.href = '/';
            }
          }
          throw new ApiError('กรุณาเข้าสู่ระบบใหม่', 401);
        case 403:
          throw new ApiError('คุณไม่มีสิทธิ์เข้าถึง', 403);
        case 404:
          throw new ApiError('ไม่พบข้อมูล', 404);
        case 429:
          throw new ApiError('คำขอมากเกินไป กรุณารอสักครู่', 429);
        case 500:
        case 502:
        case 503:
          throw new ApiError('ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง', response.status);
        default:
          throw new ApiError(errorMessage, response.status, errorData);
      }
    }

    return response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new ApiError(
        'ไม่สามารถเชื่อมต่อได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต',
        0
      );
    }

    throw new ApiError('เกิดข้อผิดพลาดที่ไม่คาดคิด', 0);
  }
}
