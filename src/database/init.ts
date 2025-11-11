import sequelize from './config';
// Import Contact model to ensure it's registered with Sequelize
import '../models/Contact';
import logger from '../utils/logger';

export async function initDatabase() {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully');

    await sequelize.sync({ alter: true });
    logger.info('Database tables synchronized');
  } catch (error) {
    logger.error({ err: error }, 'Unable to connect to the database');
    throw error;
  }
}

export async function closeDatabase() {
  await sequelize.close();
}
