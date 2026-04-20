# 🎓 Smart Attendance System – Backend

A production-ready REST API + real-time WebSocket backend for a QR-based Smart Attendance System, built with Node.js, Express.js, MongoDB, and Socket.io.

---

## 📁 Project Structure

```
smart-attendance/
├── config/
│   └── db.js                  # MongoDB connection with retry logic
├── controllers/
│   ├── authController.js      # Register, login, getMe
│   ├── sessionController.js   # Create/end/view QR sessions
│   └── attendanceController.js# Mark & retrieve attendance
├── middleware/
│   ├── auth.js                # JWT protect + role authorise
│   ├── validate.js            # express-validator error formatter
│   └── errorHandler.js        # Global error handler
├── models/
│   ├── User.js                # name, email, password (hashed), role
│   ├── Session.js             # qrToken, isActive, expiresAt
│   └── Attendance.js          # studentId, sessionId, status
├── routes/
│   ├── authRoutes.js
│   ├── sessionRoutes.js
│   └── attendanceRoutes.js
├── utils/
│   ├── response.js            # sendSuccess / sendError helpers
│   └── token.js               # JWT sign / verify
├── .env.example
├── package.json
└── server.js                  # App entry point + Socket.io setup
```

---

## ⚙️ Setup & Installation

### 1. Clone & install dependencies

```bash
git clone <your-repo-url>
cd smart-attendance
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/smart_attendance
JWT_SECRET=your_super_secret_key_change_this
JWT_EXPIRES_IN=7d
SESSION_DURATION_SECONDS=60
CLIENT_ORIGIN=http://localhost:3000
```

### 3. Start the server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

You should see:
```
╔══════════════════════════════════════════════╗
║       Smart Attendance System  🎓            ║
║  REST   → http://localhost:5000/api          ║
║  Socket → ws://localhost:5000                ║
╚══════════════════════════════════════════════╝
```

---

## 🔌 API Reference

### Base URL
```
http://localhost:5000/api
```

### Response Format
Every response follows this consistent shape:
```json
{
  "success": true | false,
  "message": "Human-readable message",
  "data": { ... },      // present on success
  "meta": { ... },      // present on paginated responses
  "errors": [ ... ]     // present on validation failures
}
```

---

### 🔐 Auth Routes

#### `POST /api/auth/register`
Register a new user (student or teacher).

**Body:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "securepass123",
  "role": "student"
}
```

**Response `201`:**
```json
{
  "success": true,
  "message": "Registration successful.",
  "data": {
    "token": "eyJhbGci...",
    "user": { "_id": "...", "name": "Jane Doe", "email": "jane@example.com", "role": "student" }
  }
}
```

---

#### `POST /api/auth/login`
Login and receive a JWT token.

**Body:**
```json
{
  "email": "jane@example.com",
  "password": "securepass123"
}
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "token": "eyJhbGci...",
    "user": { "_id": "...", "name": "Jane Doe", "role": "student" }
  }
}
```

---

#### `GET /api/auth/me`
Get currently authenticated user. Requires `Authorization: Bearer <token>`.

---

### 📋 Session Routes *(Teacher only)*

All session routes require:
```
Authorization: Bearer <teacher_token>
```

#### `POST /api/session/create`
Start a new QR attendance session.

**Body (optional):**
```json
{ "subject": "Mathematics 101" }
```

**Response `201`:**
```json
{
  "success": true,
  "message": "Attendance session created.",
  "data": {
    "session": {
      "_id": "665f...",
      "qrToken": "550e8400-e29b-41d4-a716-446655440000",
      "subject": "Mathematics 101",
      "isActive": true,
      "expiresAt": "2024-06-05T10:01:00.000Z"
    }
  }
}
```
> 💡 Encode the `qrToken` into a QR code image on the frontend using a library like `qrcode.react`.

---

#### `POST /api/session/end`
End the current active session.

**Body (optional — omit to end most recent active):**
```json
{ "sessionId": "665f..." }
```

---

#### `GET /api/session/active`
Get the currently active session with live attendance count.

---

#### `GET /api/session/history?page=1&limit=20`
Paginated list of all sessions created by the teacher.

---

### ✅ Attendance Routes

#### `POST /api/attendance/mark` *(Student only)*
Student submits the scanned QR token.

**Body:**
```json
{ "qrToken": "550e8400-e29b-41d4-a716-446655440000" }
```

**Validations performed:**
- Session must exist
- Session must be `isActive: true`
- Token must not be expired
- Student must not have already marked attendance

---

#### `GET /api/attendance/student` *(Student only)*
Get all attendance records for the logged-in student (paginated).

```
GET /api/attendance/student?page=1&limit=20
```

---

#### `GET /api/attendance/session/:id` *(Teacher only)*
Get all students who marked attendance for a specific session.

```
GET /api/attendance/session/665f...
```

**Response:**
```json
{
  "success": true,
  "data": {
    "session": { "_id": "...", "subject": "Math", "isActive": false },
    "records": [
      {
        "studentId": { "name": "Jane Doe", "email": "jane@example.com" },
        "status": "present",
        "markedAt": "2024-06-05T10:00:30.000Z"
      }
    ],
    "totalPresent": 1
  }
}
```

---

## ⚡ Real-time (Socket.io)

Connect to `ws://localhost:5000` from your React frontend.

### Events (Client → Server)

| Event | Payload | Description |
|---|---|---|
| `join:teacher` | `{ teacherId }` | Teacher joins their personal room |
| `join:session` | `{ sessionId }` | Subscribe to a session's live feed |

### Events (Server → Client)

| Event | Payload | Description |
|---|---|---|
| `session:created` | `{ sessionId, qrToken, expiresAt, subject }` | Fired when teacher starts session |
| `session:ended` | `{ sessionId }` | Fired when teacher ends session |
| `attendance:new` | `{ studentId, studentName, sessionId, markedAt, totalCount }` | Fired each time a student marks attendance |

### React frontend example

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000');

// Teacher dashboard
socket.emit('join:teacher', { teacherId: user._id });
socket.emit('join:session', { sessionId: activeSession._id });

socket.on('attendance:new', ({ studentName, totalCount }) => {
  console.log(`${studentName} marked present! Total: ${totalCount}`);
});
```

---

## 🔒 Security Features

| Feature | Implementation |
|---|---|
| Password hashing | bcryptjs, 12 salt rounds |
| Authentication | JWT (RS-style secret, 7d expiry) |
| Role-based access | `authorise('teacher' \| 'student')` middleware |
| Rate limiting | 200 req/15min (API), 20 req/15min (auth) |
| HTTP headers | Helmet.js |
| Input validation | express-validator on all routes |
| Duplicate attendance | MongoDB compound unique index |
| Expired QR tokens | Checked on every mark request |
| CORS | Whitelist-based origin checking |
| Body size limit | 10kb max payload |

---

## 🗄️ Database Indexes

| Model | Index | Purpose |
|---|---|---|
| User | `email` (unique) | Fast login lookup |
| Session | `qrToken` (unique) | Fast token validation |
| Session | `teacherId`, `isActive` | Active session queries |
| Session | `expiresAt` (TTL) | Auto-delete expired sessions |
| Attendance | `(studentId, sessionId)` (unique) | Prevent duplicate records |
| Attendance | `studentId`, `sessionId` | Fast lookups |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 18 |
| Framework | Express.js 4 |
| Database | MongoDB + Mongoose 8 |
| Auth | JWT (jsonwebtoken) |
| Hashing | bcryptjs |
| Real-time | Socket.io 4 |
| Validation | express-validator |
| Security | Helmet, express-rate-limit |
| Config | dotenv |

---

## 🚀 Connecting a React Frontend

1. Use `axios` or `fetch` with `Authorization: Bearer <token>` header for all protected routes.
2. Store the token in `localStorage` or an HTTP-only cookie.
3. Install `socket.io-client` for real-time features.
4. Use `qrcode.react` to render the `qrToken` as a scannable QR code.
5. Use a mobile QR scanner (or `react-qr-reader`) to capture and submit the token.

---

## 📄 License
MIT