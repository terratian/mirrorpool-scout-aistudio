import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HOST = '0.0.0.0';

// Serve all static assets from the project root
app.use(express.static(__dirname, {
    index: false
}));

// Route / to index.html (the terminal dashboard)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Route /dashboard to index.html / dashboard.html
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'mirrorpool-scout', port: PORT });
});

const server = app.listen(PORT, HOST, () => {
    console.log(`◈ Mirror Pool Scout terminal running at http://${HOST}:${PORT}`);
});

process.on('SIGTERM', () => {
    server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
    server.close(() => process.exit(0));
});
