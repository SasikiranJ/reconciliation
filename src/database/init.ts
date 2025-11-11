import sequelize from './config';
// Import Contact model to ensure it's registered with Sequelize
import '../models/Contact';

export async function initDatabase() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    await sequelize.sync({ alter: true });
    console.log('Database tables synchronized.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    throw error;
  }
}

export async function closeDatabase() {
  await sequelize.close();
}
