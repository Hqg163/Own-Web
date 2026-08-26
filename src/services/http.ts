import axios from 'axios'

export function clearCachedAuth() {
  localStorage.removeItem('isLoggedIn')
  localStorage.removeItem('userInfo')
  localStorage.removeItem('userId')
  localStorage.removeItem('userEmail')
}

export function cacheAuthenticatedUser(user: Record<string, unknown>) {
  localStorage.setItem('isLoggedIn', 'true')
  if (user.id !== undefined) localStorage.setItem('userId', String(user.id))
  if (user.email !== undefined) localStorage.setItem('userEmail', String(user.email))
  localStorage.setItem('userInfo', JSON.stringify(user))
}

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 15000,
  withCredentials: true,
})

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || ''
    const isAuthEndpoint = ['/api/login', '/api/register'].some((path) => url.startsWith(path))
    if (error.response?.status === 401 && !isAuthEndpoint) {
      clearCachedAuth()
      window.dispatchEvent(new CustomEvent('auth-expired'))
    }
    return Promise.reject(error)
  },
)

export default http
