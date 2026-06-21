import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // host:true exposes the dev server on the LAN (http://<your-ip>:5173) so
  // phones/laptops on the same WiFi can join online games during testing.
  // Ignore the native project so the copied web bundle doesn't trigger reloads.
  server: { host: true, watch: { ignored: ['**/android/**', '**/ios/**'] } },
});
