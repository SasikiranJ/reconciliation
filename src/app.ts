import express, { Application } from 'express';
import cors from 'cors';
import identityRoutes from './routes/identityRoutes';

const app: Application = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/', identityRoutes);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

export default app;
