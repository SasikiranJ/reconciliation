import { IdentityService } from '../src/services/identityService';
import Contact from '../src/models/Contact';
import sequelize from '../src/database/config';

describe('IdentityService', () => {
  let service: IdentityService;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    service = new IdentityService();
    await Contact.destroy({ where: {}, force: true });
  });

  describe('New Contact Creation', () => {
    it('should create a new primary contact when no matches exist', async () => {
      const result = await service.identify({
        email: 'lorraine@hillvalley.edu',
        phoneNumber: '123456',
      });

      expect(result.contact.primaryContatctId).toBeDefined();
      expect(result.contact.emails).toEqual(['lorraine@hillvalley.edu']);
      expect(result.contact.phoneNumbers).toEqual(['123456']);
      expect(result.contact.secondaryContactIds).toEqual([]);

      const contact = await Contact.findByPk(
        result.contact.primaryContatctId
      );
      expect(contact?.linkPrecedence).toBe('primary');
      expect(contact?.linkedId).toBeNull();
    });

    it('should create primary contact with only email', async () => {
      const result = await service.identify({
        email: 'doc@hillvalley.edu',
      });

      expect(result.contact.emails).toEqual(['doc@hillvalley.edu']);
      expect(result.contact.phoneNumbers).toEqual([]);
      expect(result.contact.secondaryContactIds).toEqual([]);
    });

    it('should create primary contact with only phoneNumber', async () => {
      const result = await service.identify({
        phoneNumber: '555-1234',
      });

      expect(result.contact.phoneNumbers).toEqual(['555-1234']);
      expect(result.contact.emails).toEqual([]);
      expect(result.contact.secondaryContactIds).toEqual([]);
    });
  });

  describe('Secondary Contact Creation', () => {
    it('should create secondary contact when new email with existing phone', async () => {
      // First request - creates primary
      await service.identify({
        email: 'lorraine@hillvalley.edu',
        phoneNumber: '123456',
      });

      // Second request - should create secondary
      const result = await service.identify({
        email: 'mcfly@hillvalley.edu',
        phoneNumber: '123456',
      });

      expect(result.contact.emails).toContain('lorraine@hillvalley.edu');
      expect(result.contact.emails).toContain('mcfly@hillvalley.edu');
      expect(result.contact.phoneNumbers).toEqual(['123456']);
      expect(result.contact.secondaryContactIds).toHaveLength(1);
    });

    it('should create secondary contact when new phone with existing email', async () => {
      // First request - creates primary
      await service.identify({
        email: 'george@hillvalley.edu',
        phoneNumber: '919191',
      });

      // Second request - should create secondary
      const result = await service.identify({
        email: 'george@hillvalley.edu',
        phoneNumber: '717171',
      });

      expect(result.contact.emails).toEqual(['george@hillvalley.edu']);
      expect(result.contact.phoneNumbers).toContain('919191');
      expect(result.contact.phoneNumbers).toContain('717171');
      expect(result.contact.secondaryContactIds).toHaveLength(1);
    });

    it('should not create duplicate when exact match exists', async () => {
      // Create initial contact
      await service.identify({
        email: 'same@email.com',
        phoneNumber: '123456',
      });

      // Same request again
      const result = await service.identify({
        email: 'same@email.com',
        phoneNumber: '123456',
      });

      expect(result.contact.secondaryContactIds).toHaveLength(0);

      const allContacts = await Contact.findAll();
      expect(allContacts).toHaveLength(1);
    });
  });

  describe('Primary Contact Merging', () => {
    it('should merge two separate primary contacts', async () => {
      // Create first primary
      const first = await Contact.create({
        email: 'george@hillvalley.edu',
        phoneNumber: '919191',
        linkedId: null,
        linkPrecedence: 'primary',
        createdAt: new Date('2023-04-11T00:00:00.374Z'),
        updatedAt: new Date('2023-04-11T00:00:00.374Z'),
      });

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Create second primary
      await Contact.create({
        email: 'biffsucks@hillvalley.edu',
        phoneNumber: '717171',
        linkedId: null,
        linkPrecedence: 'primary',
        createdAt: new Date('2023-04-21T05:30:00.11Z'),
        updatedAt: new Date('2023-04-21T05:30:00.11Z'),
      });

      // Request that links them
      const result = await service.identify({
        email: 'george@hillvalley.edu',
        phoneNumber: '717171',
      });

      expect(result.contact.primaryContatctId).toBe(first.id);
      expect(result.contact.emails).toContain('george@hillvalley.edu');
      expect(result.contact.emails).toContain('biffsucks@hillvalley.edu');
      expect(result.contact.phoneNumbers).toContain('919191');
      expect(result.contact.phoneNumbers).toContain('717171');
      expect(result.contact.secondaryContactIds).toHaveLength(2);

      // Verify the older primary is still primary
      const firstContact = await Contact.findByPk(first.id);
      expect(firstContact?.linkPrecedence).toBe('primary');
    });

    it('should maintain oldest primary when merging multiple chains', async () => {
      // Create first chain
      const oldest = await Contact.create({
        email: 'first@test.com',
        phoneNumber: '111',
        linkedId: null,
        linkPrecedence: 'primary',
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T00:00:00Z'),
      });

      // Create second chain
      await Contact.create({
        email: 'second@test.com',
        phoneNumber: '222',
        linkedId: null,
        linkPrecedence: 'primary',
        createdAt: new Date('2023-02-01T00:00:00Z'),
        updatedAt: new Date('2023-02-01T00:00:00Z'),
      });

      // Link them
      const result = await service.identify({
        email: 'first@test.com',
        phoneNumber: '222',
      });

      expect(result.contact.primaryContatctId).toBe(oldest.id);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle multiple secondary contacts correctly', async () => {
      // Create primary
      await service.identify({
        email: 'primary@test.com',
        phoneNumber: '100',
      });

      // Add multiple secondaries
      await service.identify({
        email: 'primary@test.com',
        phoneNumber: '200',
      });

      await service.identify({
        email: 'secondary@test.com',
        phoneNumber: '100',
      });

      const result = await service.identify({
        email: 'primary@test.com',
      });

      expect(result.contact.emails).toHaveLength(2);
      expect(result.contact.phoneNumbers).toHaveLength(2);
      expect(result.contact.secondaryContactIds).toHaveLength(2);
    });

    it('should return all contacts when querying by any field', async () => {
      await service.identify({
        email: 'email1@test.com',
        phoneNumber: '111',
      });

      await service.identify({
        email: 'email2@test.com',
        phoneNumber: '111',
      });

      // Query by first email
      const result1 = await service.identify({ email: 'email1@test.com' });

      // Query by second email
      const result2 = await service.identify({ email: 'email2@test.com' });

      // Query by phone
      const result3 = await service.identify({ phoneNumber: '111' });

      // All should return same consolidated result
      expect(result1.contact.emails).toEqual(result2.contact.emails);
      expect(result1.contact.emails).toEqual(result3.contact.emails);
      expect(result1.contact.secondaryContactIds).toEqual(
        result2.contact.secondaryContactIds
      );
    });

    it('should handle null values correctly', async () => {
      const result = await service.identify({
        email: 'test@test.com',
        phoneNumber: null,
      });

      expect(result.contact.emails).toEqual(['test@test.com']);
      expect(result.contact.phoneNumbers).toEqual([]);
    });
  });

  describe('Validation', () => {
    it('should throw error when both email and phone are missing', async () => {
      await expect(service.identify({})).rejects.toThrow(
        'Either email or phoneNumber must be provided'
      );
    });

    it('should throw error when both email and phone are null', async () => {
      await expect(
        service.identify({ email: null, phoneNumber: null })
      ).rejects.toThrow('Either email or phoneNumber must be provided');
    });
  });
});
