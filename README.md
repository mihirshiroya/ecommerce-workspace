# Listing Studio

For the current application, changed-file list, and step-by-step **Cloudflare Workers + Neon** hosting instructions, read [HOSTING.md](./HOSTING.md). Deployment is not performed automatically. The historical authentication-boilerplate material below is retained for reference only; its Prisma migration, Google OAuth, directory, port, and deployment instructions do not describe the current application and must not be used for hosting.

## Historical boilerplate reference

# 🔐 Auth Template

A production-ready, full-stack authentication boilerplate with modern security practices and developer-friendly features.

![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)

## ✨ Features

- 🔒 **Secure JWT Authentication** - Access and refresh token management with automatic rotation
- 🌐 **Google OAuth 2.0** - One-click social login integration
- ✉️ **Email Services** - Automated verification and password reset flows
- 🍪 **HTTP-Only Cookies** - Secure token storage preventing XSS attacks
- 🛡️ **Security First** - Rate limiting, CORS, Helmet, and input validation
- 💾 **PostgreSQL + Prisma** - Type-safe database operations with migrations
- ⚡ **Modern Frontend** - React 19 with Redux Toolkit and React Query
- 🎨 **Beautiful UI** - TailwindCSS with responsive design
- 📱 **Mobile Ready** - Fully responsive across all devices

---

## 🛠️ Tech Stack

### Backend
| Technology | Purpose |
|------------|---------|
| **Express.js** | RESTful API framework |
| **Prisma** | Next-generation ORM |
| **PostgreSQL** | Robust relational database |
| **JWT** | Stateless authentication |
| **Passport.js** | OAuth middleware |
| **Nodemailer** | Email delivery service |
| **Bcrypt** | Password hashing |
| **Helmet** | Security headers |

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 19** | UI library |
| **Vite** | Lightning-fast build tool |
| **Redux Toolkit** | State management |
| **React Query** | Server state synchronization |
| **React Router v7** | Client-side routing |
| **Formik + Yup** | Form validation |
| **TailwindCSS** | Utility-first CSS |
| **React Toastify** | Toast notifications |

---

## 🚀 Quick Start

### Prerequisites

Ensure you have the following installed:
- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)
- npm or yarn

### Installation

**1. Clone the repository**
```bash
git clone https://github.com/yourusername/auth-template.git
cd auth-template
```

**2. Backend Setup**
```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory:

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/auth_db"

# JWT Secrets (Generate strong random strings)
JWT_SECRET="your_super_secret_jwt_key_here"
JWT_REFRESH_SECRET="your_super_secret_refresh_key_here"
JWT_EXPIRE="15m"
JWT_REFRESH_EXPIRE="7d"

# Google OAuth 2.0
GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_client_secret"
GOOGLE_CALLBACK_URL="http://localhost:5000/api/auth/google/callback"

# Email Configuration (Gmail example)
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT="587"
EMAIL_USER="your_email@gmail.com"
EMAIL_PASS="your_gmail_app_password"
EMAIL_FROM="noreply@yourapp.com"

# Application
PORT="5000"
NODE_ENV="development"
CLIENT_URL="http://localhost:3000"
SERVER_URL="http://localhost:5000"

# Security
BCRYPT_ROUNDS="12"
RATE_LIMIT_MAX="100"
RATE_LIMIT_WINDOW_MS="900000"
```

**3. Database Setup**
```bash
# Run Prisma migrations
npm run migrate

# Seed database (optional)
npm run seed
```

**4. Start Backend Server**
```bash
npm run dev
```
Backend runs on `http://localhost:5000`

**5. Frontend Setup**

Open a new terminal:
```bash
cd front
npm install
npm run dev
```
Frontend runs on `http://localhost:3000`

---

## 📚 API Documentation

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/auth/register` | Create new user account | No |
| `POST` | `/api/auth/login` | Login with credentials | No |
| `GET` | `/api/auth/verify-email/:token` | Verify email address | No |
| `POST` | `/api/auth/forgot-password` | Request password reset | No |
| `POST` | `/api/auth/reset-password/:token` | Reset password | No |
| `GET` | `/api/auth/google` | Initiate Google OAuth | No |
| `GET` | `/api/auth/google/callback` | Google OAuth callback | No |
| `POST` | `/api/auth/refresh` | Refresh access token | Yes (Refresh Token) |
| `POST` | `/api/auth/logout` | Logout user | Yes |
| `GET` | `/api/auth/profile` | Get current user | Yes |


---

## 📁 Project Structure

```
auth-template/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Database schema
│   │   ├── migrations/            # Database migrations
│   │   └── seed.js                # Seed data
│   ├── src/
│   │   ├── controllers/           # Business logic
│   │   ├── middleware/            # Auth, validation, error handling
│   │   ├── routes/                # API routes
│   │   ├── utils/                 # Helper functions
│   │   └── config/                # Configuration files
│   ├── .env                       # Environment variables
│   ├── server.js                  # Entry point
│   └── package.json
│
├── front/
│   ├── src/
│   │   ├── components/            # Reusable components
│   │   ├── pages/                 # Page components
│   │   ├── store/                 # Redux store & slices
│   │   ├── hooks/                 # Custom React hooks
│   │   ├── services/              # API services
│   │   ├── utils/                 # Helper functions
│   │   └── main.tsx               # Entry point
│   ├── public/                    # Static assets
│   ├── vite.config.ts             # Vite configuration
│   └── package.json
│
└── README.md
```

---

## 🔧 Configuration

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:5000/api/auth/google/callback`
6. Copy Client ID and Client Secret to `.env`

### Email Setup (Gmail)

1. Enable 2-Factor Authentication on your Gmail account
2. Generate an [App Password](https://myaccount.google.com/apppasswords)
3. Use the app password in `EMAIL_PASS` environment variable


## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Commit your changes**
   ```bash
   git commit -m 'feat: add amazing feature'
   ```
4. **Push to the branch**
   ```bash
   git push origin feature/amazing-feature
   ```
5. **Open a Pull Request**

### Commit Convention

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

---

## 🗺️ Roadmap

- [ ] **Role-Based Access Control (RBAC)** - Admin, User, Moderator roles
- [ ] **Two-Factor Authentication (2FA)** - TOTP support
- [ ] **Multi-Provider OAuth** - GitHub, Facebook, Twitter
- [ ] **API Documentation** - Swagger/OpenAPI integration
- [ ] **Docker Support** - Containerized deployment
- [ ] **Rate Limiting per User** - Advanced rate limiting strategies
- [ ] **Audit Logging** - Track user actions and changes

