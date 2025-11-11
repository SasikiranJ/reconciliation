import request from 'supertest';
import app from '../src/app';
import Contact from '../src/models/Contact';
import sequelize from '../src/database/config';

describe('POST /identify', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    await Contact.destroy({ where: {}, force: true });
  });

  describe('Request Validation', () => {
    it('should return 400 when both email and phoneNumber are missing', async () => {
      const response = await request(app).post('/identify').send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should accept request with only email', async () => {
      const response = await request(app)
        .post('/identify')
        .send({ email: 'test@test.com' });

      expect(response.status).toBe(200);
      expect(response.body.contact).toBeDefined();
    });

    it('should accept request with only phoneNumber', async () => {
      const response = await request(app)
        .post('/identify')
        .send({ phoneNumber: '123456' });

      expect(response.status).toBe(200);
      expect(response.body.contact).toBeDefined();
    });
  });

  describe('Response Format', () => {
    it('should return correctly formatted response for new contact', async () => {
      const response = await request(app).post('/identify').send({
        email: 'test@example.com',
        phoneNumber: '123456',
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('contact');
      expect(response.body.contact).toHaveProperty('primaryContatctId');
      expect(response.body.contact).toHaveProperty('emails');
      expect(response.body.contact).toHaveProperty('phoneNumbers');
      expect(response.body.contact).toHaveProperty('secondaryContactIds');

      expect(Array.isArray(response.body.contact.emails)).toBe(true);
      expect(Array.isArray(response.body.contact.phoneNumbers)).toBe(true);
      expect(Array.isArray(response.body.contact.secondaryContactIds)).toBe(
        true
      );
    });
  });

  describe('Example from Requirements', () => {
    it('should handle the lorraine@hillvalley.edu example correctly', async () => {
      // First request
      const response1 = await request(app).post('/identify').send({
        email: 'lorraine@hillvalley.edu',
        phoneNumber: '123456',
      });

      expect(response1.status).toBe(200);
      const primaryId = response1.body.contact.primaryContatctId;

      // Second request
      const response2 = await request(app).post('/identify').send({
        email: 'mcfly@hillvalley.edu',
        phoneNumber: '123456',
      });

      expect(response2.status).toBe(200);
      expect(response2.body.contact.primaryContatctId).toBe(primaryId);
      expect(response2.body.contact.emails).toContain(
        'lorraine@hillvalley.edu'
      );
      expect(response2.body.contact.emails).toContain('mcfly@hillvalley.edu');
      expect(response2.body.contact.phoneNumbers).toEqual(['123456']);
      expect(response2.body.contact.secondaryContactIds).toHaveLength(1);

      // Third request - all variations should return same result
      const response3 = await request(app).post('/identify').send({
        email: 'mcfly@hillvalley.edu',
      });

      expect(response3.body.contact.primaryContatctId).toBe(primaryId);
      expect(response3.body.contact.emails).toHaveLength(2);
    });

    it('should handle the primary merging example correctly', async () => {
      // Create first primary contact
      await Contact.create({
        id: 11,
        phoneNumber: '919191',
        email: 'george@hillvalley.edu',
        linkedId: null,
        linkPrecedence: 'primary',
        createdAt: new Date('2023-04-11T00:00:00.374Z'),
        updatedAt: new Date('2023-04-11T00:00:00.374Z'),
      });

      // Create second primary contact
      await Contact.create({
        id: 27,
        phoneNumber: '717171',
        email: 'biffsucks@hillvalley.edu',
        linkedId: null,
        linkPrecedence: 'primary',
        createdAt: new Date('2023-04-21T05:30:00.11Z'),
        updatedAt: new Date('2023-04-21T05:30:00.11Z'),
      });

      // Request that should link them
      const response = await request(app).post('/identify').send({
        email: 'george@hillvalley.edu',
        phoneNumber: '717171',
      });

      expect(response.status).toBe(200);
      expect(response.body.contact.primaryContatctId).toBe(11);
      expect(response.body.contact.emails).toContain('george@hillvalley.edu');
      expect(response.body.contact.emails).toContain(
        'biffsucks@hillvalley.edu'
      );
      expect(response.body.contact.phoneNumbers).toContain('919191');
      expect(response.body.contact.phoneNumbers).toContain('717171');
      expect(response.body.contact.secondaryContactIds).toContain(27);
    });
  });

  describe('Health Check', () => {
    it('should return 200 for health check endpoint', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    });
  });

  describe('Error Handling', () => {
    it('should return 500 for internal server errors', async () => {
      // Mock Contact.findAll to throw an error
      const originalFindAll = Contact.findAll;
      Contact.findAll = jest.fn().mockRejectedValue(new Error('DB Error'));

      const response = await request(app).post('/identify').send({
        email: 'test@test.com',
      });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');

      // Restore original method
      Contact.findAll = originalFindAll;
    });
  });
});
