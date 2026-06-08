// server.js
// Entry point – starts the HTTP server.
// Kept separate from app.js so app.js can be imported in tests
// without actually starting a server (supertest handles that).

'use strict';

const app = require('./app');
const { testConnection } = require('./src/database/connection');
const { logger } = require('./src/middlewares/logger');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || 'localhost';

async function startServer() {
    // Test DB connection before accepting any traffic
    // If the DB is down, there's no point starting the server
    await testConnection();

    const server = app.listen(PORT, HOST, () => {
        logger.info(`Server running at http://${HOST}:${PORT}`);
        logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        logger.info(`Health check: http://${HOST}:${PORT}/health`);
    });

    // Graceful shutdown – handle Ctrl+C and process termination signals
    // Without this, active connections are abruptly killed
    const shutdown = (signal) => {
        logger.info(`${signal} received – shutting down gracefully`);
        server.close(() => {
            logger.info('HTTP server closed');
            process.exit(0);
        });

        // Force shutdown after 10 seconds if connections don't close
        setTimeout(() => {
            logger.error('Forced shutdown after timeout');
            process.exit(1);
        }, 10_000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Catch unhandled promise rejections – log them before crashing
    process.on('unhandledRejection', (reason) => {
        logger.error('Unhandled Promise Rejection:', { reason });
        process.exit(1);
    });
}

startServer();
