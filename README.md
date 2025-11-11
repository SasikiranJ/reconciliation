# Bitespeed Identity Reconciliation Service

A web service for identifying and consolidating customer contact information across multiple purchases. Built for FluxKart.com to help track Doc's time machine parts purchases!

## Features

- **Contact Consolidation**: Links customer identities across different email addresses and phone numbers
- **Primary/Secondary Hierarchy**: Maintains a primary contact with secondary contacts linked to it
- **Automatic Merging**: Intelligently merges separate contact chains when they share common information
- **RESTful API**: Simple POST endpoint for identity reconciliation
- **Comprehensive Testing**: Full test coverage with unit and integration tests

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Sequelize ORM
- **Testing**: Jest with Supertest
- **Deployment**: Render.com

## API Documentation

### Endpoint: POST /identify

Identifies and consolidates customer contact information.

**URL**: `/identify`

**Method**: `POST`

**Content-Type**: `application/json`

**Request Body**:
```json
{
  "email": "string (optional)",
  "phoneNumber": "string (optional)"
}
```

**Note**: At least one of `email` or `phoneNumber` must be provided.

**Success Response**:
- **Code**: 200
- **Content**:
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [23]
  }
}
```

**Error Response**:
- **Code**: 400 BAD REQUEST
- **Content**: `{ "error": "At least one of email or phoneNumber must be provided" }`

**Example Requests**:

1. New customer (creates primary contact):
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{
    "email": "lorraine@hillvalley.edu",
    "phoneNumber": "123456"
  }'
```

2. Same customer with new email (creates secondary contact):
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{
    "email": "mcfly@hillvalley.edu",
    "phoneNumber": "123456"
  }'
```

3. Query by single field:
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{ "email": "lorraine@hillvalley.edu" }'
```

### Health Check Endpoint

**URL**: `/health`

**Method**: `GET`

**Success Response**:
```json
{
  "status": "ok",
  "message": "Server is running"
}
```

## Local Development Setup

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd reconciliation
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and configure your database settings:
```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=bitespeed_identity
DB_USER=postgres
DB_PASSWORD=your_password
```

4. Create the database:
```bash
createdb bitespeed_identity
```

5. Build the project:
```bash
npm run build
```

6. Start the development server:
```bash
npm run dev
```

The server will start on `http://localhost:3000`

## Running Tests

Run the full test suite with coverage:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## Database Schema

### Contact Table

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key, auto-increment |
| phoneNumber | STRING | Customer phone number (nullable) |
| email | STRING | Customer email (nullable) |
| linkedId | INTEGER | Foreign key to primary contact (nullable) |
| linkPrecedence | ENUM | Either "primary" or "secondary" |
| createdAt | TIMESTAMP | Record creation timestamp |
| updatedAt | TIMESTAMP | Record update timestamp |
| deletedAt | TIMESTAMP | Soft delete timestamp (nullable) |

**Indexes**:
- `email`
- `phoneNumber`
- `linkedId`

## How It Works

### Identity Reconciliation Logic

1. **New Contact**: If no matching email or phone exists, create a new primary contact
2. **Existing Match**: If a match is found, return the consolidated contact information
3. **New Information**: If new email/phone is provided with existing phone/email, create a secondary contact
4. **Primary Merging**: If two separate primary contacts are linked, convert the newer one to secondary

### Example Scenarios

#### Scenario 1: New Customer
```
Request: { email: "doc@example.com", phoneNumber: "555-1234" }
Result: Creates primary contact #1
```

#### Scenario 2: Same Customer, New Email
```
Request: { email: "emmett@example.com", phoneNumber: "555-1234" }
Result: Creates secondary contact #2, linked to primary #1
```

#### Scenario 3: Merging Two Primaries
```
Existing:
  - Primary #1: { email: "george@example.com", phone: "111" }
  - Primary #2: { email: "biff@example.com", phone: "222" }

Request: { email: "george@example.com", phoneNumber: "222" }

Result:
  - Primary #1 stays primary (it's older)
  - Primary #2 becomes secondary, linked to #1
  - New secondary #3 created with the request data
```

## Deployment to Render

### Prerequisites
- GitHub repository
- Render account

### Steps

1. Push your code to GitHub:
```bash
git remote add origin <your-github-repo-url>
git push -u origin master
```

2. Create a PostgreSQL database on Render:
   - Go to Render Dashboard
   - Click "New +" → "PostgreSQL"
   - Choose a name and create
   - Note the "Internal Database URL"

3. Create a Web Service on Render:
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Configure:
     - **Name**: bitespeed-identity-reconciliation
     - **Environment**: Node
     - **Build Command**: `npm install && npm run build`
     - **Start Command**: `npm start`
     - **Environment Variables**:
       - `NODE_ENV`: `production`
       - `DATABASE_URL`: (paste Internal Database URL from step 2)

4. Deploy!
   - Click "Create Web Service"
   - Render will automatically deploy your application

Your API will be available at: `https://<your-service-name>.onrender.com`

## Project Structure

```
reconciliation/
├── src/
│   ├── controllers/       # Request handlers
│   │   └── identityController.ts
│   ├── database/          # Database configuration
│   │   ├── config.ts
│   │   └── init.ts
│   ├── models/            # Sequelize models
│   │   └── Contact.ts
│   ├── routes/            # API routes
│   │   └── identityRoutes.ts
│   ├── services/          # Business logic
│   │   └── identityService.ts
│   ├── app.ts             # Express app setup
│   └── index.ts           # Server entry point
├── tests/                 # Test files
│   ├── setup.ts
│   ├── identityService.test.ts
│   └── api.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Scripts

- `npm run dev` - Start development server with ts-node
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Start production server
- `npm test` - Run tests with coverage
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Lint TypeScript files
- `npm run format` - Format code with Prettier

## License

ISC

## Support

For issues and questions, please open an issue in the GitHub repository.
