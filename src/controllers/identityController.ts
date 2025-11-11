import { Request, Response } from 'express';
import { IdentityService } from '../services/identityService';
import logger from '../utils/logger';

const identityService = new IdentityService();

export async function identify(req: Request, res: Response): Promise<void> {
  try {
    const { email, phoneNumber } = req.body;

    // Validate input
    if (!email && !phoneNumber) {
      res.status(400).json({
        error: 'At least one of email or phoneNumber must be provided',
      });
      return;
    }

    // Process the identity reconciliation
    const result = await identityService.identify({ email, phoneNumber });

    res.status(200).json(result);
  } catch (error) {
    logger.error({ err: error, body: req.body }, 'Error in identify endpoint');
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
