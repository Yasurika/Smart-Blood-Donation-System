# Smart Blood Donation System

The Smart Blood Donation System is a full-stack application built with Next.js (frontend + backend API routes) and a Python-based AI service. It streamlines blood donation campaigns, donor eligibility checks, appointment recommendations, inventory stock analysis, and hospital request management.

## Features

- User authentication (login/register) with role-based dashboards (donor/hospital/admin)
- Donor profiles, eligibility questionnaires, and appointment booking
- Hospital dashboards with stock tracking, requests, and campaign management
- Real-time blood heatmap and analytics
- AI-powered chatbot for blood donation Q&A
- Comprehensive audit logs, notification center, and badge progression system
- **OCR Integration**: Automatic NIC (National Identity Card) data extraction during registration

## OCR System

The application includes an intelligent OCR (Optical Character Recognition) system for donor registration:

### Features
- **NIC Photo Upload**: Users can upload photos of Sri Lankan National Identity Cards
- **Automatic Data Extraction**: Extracts NIC number, name, date of birth, gender, address, and blood type
- **Smart Pattern Recognition**: Handles both old (9-digit) and new (12-digit) NIC formats
- **Error Correction**: Automatically fixes common OCR mistakes (O→0, I→1, etc.)
- **Form Auto-Population**: Automatically fills registration form fields
- **Client-Side Processing**: Privacy-focused - images never leave the user's device

### Technical Implementation
- **OCR Engine**: Tesseract.js for client-side text recognition
- **Language Support**: English text recognition optimized for NIC documents
- **Processing Time**: ~10-25 seconds depending on image quality
- **Accuracy**: 85%+ success rate with clear, well-lit photos

### Files Involved
- `src/app/(auth)/register/page.tsx` - Main registration with OCR
- `src/app/dashboard/donors/page.tsx` - Admin donor management with OCR
- `package.json` - Includes `tesseract.js` dependency

## Tech stack

- Frontend: Next.js + Tailwind CSS + TypeScript
- Backend: Next.js API routes + next-auth
- AI engine: Python (Flask/FastAPI style integration) + scikit-learn + pandas
- Database: MongoDB (via Mongoose/next-auth adapter)
- Deployment-ready: Vercel/Node, Docker-compatible

## Prerequisites

- Node.js 20+ (LTS)
- npm or pnpm
- Python 3.11+
- MongoDB connection URI (local or cloud)

## Local setup

1. Clone the repo

```bash
git clone https://github.com/<your-org>/Smart-Blood-Donation-System.git
cd Smart-Blood-Donation-System
```

2. Install Node dependencies

```bash
npm install
```

3. Set up Python virtual environment and install Python deps

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r src/ai/requirements.txt
```

4. Create `.env.local` in project root with (example values):

```env
NEXTAUTH_SECRET=your_nextauth_secret
MONGODB_URI=mongodb://localhost:27017/smartblood
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
AI_API_URL=http://localhost:5000
```

5. Launch all services

```bash
# Windows PowerShell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
Unblock-File .\RUN_ALL.ps1
.\RUN_ALL.ps1
```

Or start services individually:

```bash
npm run dev
python src/ai/chatbot_api.py   # if required for AI API
```

6. Open app in browser: http://localhost:3000

## Scripts

- `npm run dev` - Start Next.js in development mode
- `npm run build` - Build production assets
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm test` - Run test suite (if configured)

## AI module

The AI engine lives in `src/ai`. It uses:

- `src/ai/chatbot_api.py` for REST endpoints
- `src/ai/chatbot_core.py` and `src/ai/engine.py` for logic
- `src/ai/add_more_data.py` helper for augmenting dataset

## Project structure

- `src/app` - Next.js app routes and pages
- `src/app/api` - API endpoints
- `src/components` - UI components
- `src/lib` - utility helpers and database integration
- `src/providers` - context providers
- `src/types` - TypeScript type definitions

## Troubleshooting

- `RUN_ALL.ps1` blocked: run `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` and `Unblock-File .\RUN_ALL.ps1`
- Missing .env variables: ensure required keys are set
- MongoDB connection errors: verify URI and firewall access

## Contributing

1. Create a feature branch
2. Commit with meaningful message
3. Open PR with issue reference
4. Ensure checks pass (lint/test)

## License

MIT

