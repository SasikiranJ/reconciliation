import { Op } from 'sequelize';
import Contact from '../models/Contact';

export interface IdentifyRequest {
  email?: string | null;
  phoneNumber?: string | null;
}

export interface ConsolidatedContact {
  primaryContatctId: number; // Note: typo in requirements says "Contatct"
  emails: string[];
  phoneNumbers: string[];
  secondaryContactIds: number[];
}

export interface IdentifyResponse {
  contact: ConsolidatedContact;
}

export class IdentityService {
  /**
   * Main method to identify and consolidate contact information
   */
  async identify(request: IdentifyRequest): Promise<IdentifyResponse> {
    const { email, phoneNumber } = request;

    // Validate that at least one parameter is provided
    if (!email && !phoneNumber) {
      throw new Error('Either email or phoneNumber must be provided');
    }

    // Find all existing contacts matching email or phoneNumber
    const existingContacts = await this.findMatchingContacts(
      email,
      phoneNumber
    );

    if (existingContacts.length === 0) {
      // No existing contacts - create a new primary contact
      const newContact = await this.createPrimaryContact(email, phoneNumber);
      return this.buildResponse([newContact]);
    }

    // Get all contacts in the linked group(s)
    const allLinkedContacts = await this.getAllLinkedContacts(existingContacts);

    // Check if we need to create a new secondary contact
    const needsNewContact = this.shouldCreateNewContact(
      allLinkedContacts,
      email,
      phoneNumber
    );

    if (needsNewContact) {
      // Determine the primary contact
      const primaryContact = this.findPrimaryContact(allLinkedContacts);

      // Create new secondary contact
      const newSecondary = await Contact.create({
        email,
        phoneNumber,
        linkedId: primaryContact.id,
        linkPrecedence: 'secondary',
      });

      allLinkedContacts.push(newSecondary);
    }

    // Handle merging of separate primary contacts
    await this.mergePrimaryContacts(allLinkedContacts);

    // Refresh contacts after potential updates
    const finalContacts = await this.getAllLinkedContacts(allLinkedContacts);

    return this.buildResponse(finalContacts);
  }

  /**
   * Find contacts matching the given email or phoneNumber
   */
  private async findMatchingContacts(
    email?: string | null,
    phoneNumber?: string | null
  ): Promise<Contact[]> {
    const whereConditions: any[] = [];

    if (email) {
      whereConditions.push({ email });
    }

    if (phoneNumber) {
      whereConditions.push({ phoneNumber });
    }

    return await Contact.findAll({
      where: {
        [Op.or]: whereConditions,
      },
    });
  }

  /**
   * Get all contacts linked to the given contacts (transitive closure)
   */
  private async getAllLinkedContacts(contacts: Contact[]): Promise<Contact[]> {
    if (contacts.length === 0) {
      return [];
    }

    // Get all primary IDs
    const primaryIds = new Set<number>();
    contacts.forEach((contact) => {
      if (contact.linkPrecedence === 'primary') {
        primaryIds.add(contact.id);
      } else if (contact.linkedId) {
        primaryIds.add(contact.linkedId);
      }
    });

    // Find all contacts linked to these primaries
    const allContacts = await Contact.findAll({
      where: {
        [Op.or]: [
          { id: { [Op.in]: Array.from(primaryIds) } },
          { linkedId: { [Op.in]: Array.from(primaryIds) } },
        ],
      },
      order: [['createdAt', 'ASC']],
    });

    return allContacts;
  }

  /**
   * Find the primary contact (oldest in the group)
   */
  private findPrimaryContact(contacts: Contact[]): Contact {
    return contacts.reduce((oldest, current) => {
      if (current.linkPrecedence === 'primary') {
        return oldest.createdAt < current.createdAt ? oldest : current;
      }
      return oldest;
    });
  }

  /**
   * Check if we need to create a new contact
   * Returns true if the exact email+phone combination doesn't exist
   */
  private shouldCreateNewContact(
    contacts: Contact[],
    email?: string | null,
    phoneNumber?: string | null
  ): boolean {
    // If both email and phoneNumber are provided, check if this exact combination exists
    if (email && phoneNumber) {
      const exactMatch = contacts.find(
        (c) => c.email === email && c.phoneNumber === phoneNumber
      );
      if (exactMatch) {
        return false;
      }

      // Check if we have at least one match on email OR phoneNumber
      const hasEmailMatch = contacts.some((c) => c.email === email);
      const hasPhoneMatch = contacts.some((c) => c.phoneNumber === phoneNumber);

      // Create new contact if we have a match on one but not the exact combination
      return hasEmailMatch || hasPhoneMatch;
    }

    // If only one field is provided, no new contact needed
    return false;
  }

  /**
   * Merge separate primary contacts into one group
   * The oldest primary stays primary, others become secondary
   */
  private async mergePrimaryContacts(contacts: Contact[]): Promise<void> {
    const primaries = contacts.filter((c) => c.linkPrecedence === 'primary');

    if (primaries.length <= 1) {
      return; // Nothing to merge
    }

    // Sort by creation date to find the oldest
    primaries.sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );

    const oldestPrimary = primaries[0];

    // Convert other primaries to secondaries
    for (let i = 1; i < primaries.length; i++) {
      const primaryToConvert = primaries[i];
      await primaryToConvert.update({
        linkedId: oldestPrimary.id,
        linkPrecedence: 'secondary',
      });

      // Update any contacts that were linked to this primary
      await Contact.update(
        { linkedId: oldestPrimary.id },
        {
          where: {
            linkedId: primaryToConvert.id,
          },
        }
      );
    }
  }

  /**
   * Create a new primary contact
   */
  private async createPrimaryContact(
    email?: string | null,
    phoneNumber?: string | null
  ): Promise<Contact> {
    return await Contact.create({
      email: email || null,
      phoneNumber: phoneNumber || null,
      linkedId: null,
      linkPrecedence: 'primary',
    });
  }

  /**
   * Build the response in the required format
   */
  private buildResponse(contacts: Contact[]): IdentifyResponse {
    const primary = contacts.find((c) => c.linkPrecedence === 'primary');
    if (!primary) {
      throw new Error('No primary contact found');
    }

    const emails: string[] = [];
    const phoneNumbers: string[] = [];
    const secondaryContactIds: number[] = [];

    // Add primary's email and phone first
    if (primary.email) {
      emails.push(primary.email);
    }
    if (primary.phoneNumber) {
      phoneNumbers.push(primary.phoneNumber);
    }

    // Process secondary contacts
    contacts
      .filter((c) => c.linkPrecedence === 'secondary')
      .forEach((contact) => {
        secondaryContactIds.push(contact.id);

        if (contact.email && !emails.includes(contact.email)) {
          emails.push(contact.email);
        }
        if (
          contact.phoneNumber &&
          !phoneNumbers.includes(contact.phoneNumber)
        ) {
          phoneNumbers.push(contact.phoneNumber);
        }
      });

    return {
      contact: {
        primaryContatctId: primary.id,
        emails,
        phoneNumbers,
        secondaryContactIds,
      },
    };
  }
}
