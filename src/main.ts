import { createApp } from 'vue'
import App from './App.vue'
import router from './components/router'
import './style.css'

if (window.location.hash.startsWith('#/')) {
  window.history.replaceState(null, '', window.location.hash.slice(1))
}

const app = createApp(App)
app.use(router)
app.mount('#app')
