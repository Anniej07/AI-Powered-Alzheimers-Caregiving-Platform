# 🏥 AI-Powered Alzheimer's Care – Backend API

A production-ready Node.js / Express / MongoDB REST API for the
Alzheimer's Care platform.  Covers user management, medications,
prescriptions, AI emotion logging, automated alerts, and real-time
dashboards.

---

## Tech Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Runtime     | Node.js 18+                       |
| Framework   | Express 4                         |
| Database    | MongoDB + Mongoose                 |
| Auth        | JWT (Bearer token)                |
| Email       | Nodemailer (SMTP / Gmail)         |
| SMS         | Twilio                            |
| Scheduling  | node-cron                         |
| File upload | Multer                            |
| Security    | Helmet, CORS, express-rate-limit  |

---

## Project Structure

```
alzheimer-backend/
├── server.js                    # Entry point
├── config/
│   └── db.js                    # MongoDB connection
├── models/
│   ├── User.js                  # Patient / Caregiver / Doctor
│   ├── Medication.js            # Medicine + dose logs
│   ├── Prescription.js          # Doctor prescriptions
│   ├── Emotion.js               # Face & voice emotion records
│   └── Alert.js                 # System alerts
├── controllers/
│   ├── authController.js
│   ├── userController.js
│   ├── medicationController.js
│   ├── prescriptionController.js
│   ├── emotionController.js
│   ├── alertController.js
│   └── dashboardController.js
├── routes/
│   ├── auth.js
│   ├── users.js
│   ├── medications.js
│   ├── prescriptions.js
│   ├── emotions.js
│   ├── alerts.js
│   └── dashboard.js
├── middleware/
│   ├── auth.js                  # JWT protect + role authorize
│   ├── errorHandler.js
│   ├── upload.js                # Multer config
│   └── validate.js              # express-validator rules
├── services/
│   ├── notificationService.js   # Email + SMS
│   ├── alertService.js          # Auto-alert logic
│   ├── reminderService.js       # Cron-based reminders
│   └── cronService.js           # All scheduled jobs
└── utils/
    ├── seeder.js                # Demo data seeder
    └── apiResponse.js           # Response helpers
```

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy and configure environment
cp .env.example .env
# Edit .env with your MongoDB URI, JWT secret, SMTP, Twilio

# 3. Seed demo data (optional)
npm run seed

# 4. Start development server
npm run dev

# 5. Production
npm start
```

---

## Environment Variables

| Variable                    | Description                              |
|-----------------------------|------------------------------------------|
| `PORT`                      | Server port (default 5000)               |
| `MONGO_URI`                 | MongoDB connection string                |
| `JWT_SECRET`                | Secret for JWT signing                   |
| `JWT_EXPIRE`                | Token expiry (e.g. `7d`)                 |
| `EMAIL_HOST/PORT/USER/PASS` | SMTP credentials                         |
| `EMAIL_FROM`                | Sender display name + address            |
| `TWILIO_ACCOUNT_SID`        | Twilio account SID                       |
| `TWILIO_AUTH_TOKEN`         | Twilio auth token                        |
| `TWILIO_PHONE_NUMBER`       | Twilio outgoing number                   |
| `NEGATIVE_EMOTION_THRESHOLD`| Negative count before alert (default 3)  |
| `NEGATIVE_EMOTION_WINDOW_MIN`| Time window in minutes (default 60)     |
| `INACTIVITY_HOURS`          | Hours before inactivity alert (default 6)|

---

## API Reference

All endpoints are prefixed with `/api`.  
Protected routes require: `Authorization: Bearer <token>`

### Auth

| Method | Endpoint                  | Access  | Description              |
|--------|---------------------------|---------|--------------------------|
| POST   | `/auth/register`          | Public  | Register new user        |
| POST   | `/auth/login`             | Public  | Login, receive JWT       |
| GET    | `/auth/me`                | Private | Get current user profile |
| PUT    | `/auth/profile`           | Private | Update profile / avatar  |
| PUT    | `/auth/change-password`   | Private | Change password          |
| POST   | `/auth/logout`            | Private | Logout                   |

### Users

| Method | Endpoint                              | Access           | Description                      |
|--------|---------------------------------------|------------------|----------------------------------|
| GET    | `/users/patients`                     | Doctor/Caregiver | List assigned patients           |
| GET    | `/users/patients/:patientId`          | Doctor/Caregiver | Patient profile                  |
| POST   | `/users/assign-patient`               | Doctor/Caregiver | Assign patient by email          |
| DELETE | `/users/assign-patient/:patientId`    | Doctor/Caregiver | Remove patient assignment        |
| GET    | `/users/providers`                    | All              | List doctors & caregivers        |
| PUT    | `/users/patients/:patientId/medical`  | Doctor           | Update diagnosis & history       |

### Medications

| Method | Endpoint                              | Access           | Description                      |
|--------|---------------------------------------|------------------|----------------------------------|
| GET    | `/medications/patient/:patientId`     | All (assigned)   | List medications                 |
| GET    | `/medications/schedule/:patientId?`   | All              | Today's dose schedule            |
| GET    | `/medications/adherence/:patientId`   | Doctor/Caregiver | Adherence report (default 30d)   |
| POST   | `/medications`                        | Doctor/Caregiver | Add medication + schedule        |
| PUT    | `/medications/:id`                    | Doctor/Caregiver | Update medication                |
| DELETE | `/medications/:id`                    | Doctor           | Soft-delete (deactivate)         |
| POST   | `/medications/:id/dose-log`           | Patient/Caregiver| Mark dose taken / missed         |

### Prescriptions

| Method | Endpoint                              | Access   | Description                      |
|--------|---------------------------------------|----------|----------------------------------|
| GET    | `/prescriptions/patient/:patientId`   | All      | List prescriptions               |
| GET    | `/prescriptions/:id`                  | All      | Single prescription              |
| POST   | `/prescriptions`                      | Doctor   | Create + upload file             |
| PUT    | `/prescriptions/:id`                  | Doctor   | Update prescription              |
| DELETE | `/prescriptions/:id`                  | Doctor   | Delete prescription              |
| POST   | `/prescriptions/:id/share`            | Doctor   | Share with caregiver             |

### Emotions

| Method | Endpoint                              | Access           | Description                      |
|--------|---------------------------------------|------------------|----------------------------------|
| POST   | `/emotions`                           | Patient/Caregiver| Submit detection result          |
| GET    | `/emotions/patient/:patientId`        | All (assigned)   | History (filter: type, days)     |
| GET    | `/emotions/analytics/:patientId`      | Doctor/Caregiver | Aggregated trend data            |
| GET    | `/emotions/latest/:patientId`         | All (assigned)   | Latest face & voice result       |

### Alerts

| Method | Endpoint                    | Access           | Description              |
|--------|-----------------------------|------------------|--------------------------|
| GET    | `/alerts`                   | All              | List alerts (filterable) |
| GET    | `/alerts/count`             | All              | Unread alert counts      |
| POST   | `/alerts`                   | Doctor/Caregiver | Create manual alert      |
| PUT    | `/alerts/:id/acknowledge`   | Doctor/Caregiver | Acknowledge alert        |
| PUT    | `/alerts/:id/resolve`       | Doctor/Caregiver | Resolve alert            |

### Dashboard

| Method | Endpoint                            | Access    | Description                     |
|--------|-------------------------------------|-----------|---------------------------------|
| GET    | `/dashboard/me`                     | Patient   | Patient's own dashboard         |
| GET    | `/dashboard/patient/:patientId`     | Doc/CG    | Full patient snapshot           |
| GET    | `/dashboard/caregiver`              | Caregiver | All patients overview           |
| GET    | `/dashboard/doctor`                 | Doctor    | Patients + adherence + Rx stats |

---

## Automated Background Jobs

| Job              | Schedule       | Description                                    |
|------------------|----------------|------------------------------------------------|
| Missed doses     | Every 30 min   | Marks overdue pending logs as missed & alerts  |
| Patient activity | Every hour     | Alerts if patient inactive > N hours           |
| Low adherence    | Daily at 08:00 | Alerts if 7-day adherence drops below 50 %     |
| Med reminders    | Per schedule   | Sends email + SMS at each medication's times   |

---

## Emotion Detection Integration

The backend receives processed results from your AI models (frontend/Python service).
Submit results to `POST /api/emotions` with:

```json
{
  "detectionType": "face",
  "emotion": "anxious",
  "confidence": 87.3,
  "emotionScores": { "happy": 2.1, "anxious": 87.3, "neutral": 10.6 },
  "sessionId": "session-uuid-here"
}
```

For voice detection, additionally include `audioFeatures` and `speechText`.  
The API auto-calculates `sentiment` and triggers alerts when the threshold is breached.

---

## Demo Credentials (after `npm run seed`)

| Role      | Email                  | Password  |
|-----------|------------------------|-----------|
| Doctor    | doctor@demo.com        | Demo@1234 |
| Caregiver | caregiver@demo.com     | Demo@1234 |
| Patient   | patient@demo.com       | Demo@1234 |
