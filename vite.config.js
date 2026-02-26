import { defineConfig } from 'vite';

// Generate version from timestamp
const APP_VERSION = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

export default defineConfig({
    root: '.',
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        // Add content hash to assets for cache busting
        rollupOptions: {
            output: {
                entryFileNames: 'assets/[name]-[hash].js',
                chunkFileNames: 'assets/[name]-[hash].js',
                assetFileNames: (assetInfo) => {
                    const info = assetInfo.name.split('.');
                    const ext = info[info.length - 1];
                    if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(assetInfo.name)) {
                        return 'assets/images/[name]-[hash][extname]';
                    }
                    return 'assets/[name]-[hash][extname]';
                },
            },
        },
    },
    server: {
        port: 3001,
        open: true,
        strictPort: false,
    },
    define: {
        // Inject version as global constant
        __APP_VERSION__: JSON.stringify(APP_VERSION),
    },
});
