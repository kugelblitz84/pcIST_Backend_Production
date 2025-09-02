# pcIST Backend API Documentation

## Table of Contents

- [Getting Started](#getting-started)
- [Authentication](#authentication)
- [User Management](#user-management)
- [Event Management](#event-management)
- [Notification System](#notification-system)
- [Error Handling](#error-handling)
- [Frontend Integration Examples](#frontend-integration-examples)

---

## Getting Started

### Base URL

```
Local Development: http://localhost:5000
Production: https://your-heroku-app.herokuapp.com
```

### Common Headers

```javascript
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt_token>" // For protected routes
}
```

---

## Authentication

### JWT Token Structure

All protected routes require a JWT token in the Authorization header:

```javascript
headers: {
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Token Payload

```javascript
{
  id: "user_mongodb_id",
  classroll: 123456,
  email: "user@gmail.com",
  role: 1 // 1 = member, 2 = admin
}
```

---

## User Management

### 1. Register Member

**Endpoint:** `POST /api/users/register`

**Request Body:**

```javascript
{
  "classroll": 123456,
  "email": "student@gmail.com",
  "password": "securepass123"
}
```

**Success Response:**

```javascript
{
  "status": true,
  "message": "User created successfully",
  "token": "jwt_token_here",
  "slug": "123456"
}
```

**Validation Rules:**

- Class roll must be unique
- Email must be valid Gmail address (@gmail.com)
- Password minimum 8 characters

### 2. Login

**Endpoint:** `POST /api/users/login`

**Request Body:**

```javascript
{
  "classroll": 123456,
  "password": "securepass123"
}
```

**Success Response:**

```javascript
{
  "status": true,
  "message": "Login Successful",
  "token": "jwt_token_here",
  "slug": "123456"
}
```

### 3. Get User Profile

**Endpoint:** `POST /api/users/profile`
**Authentication:** Required

**Request Body:**

```javascript
{
  "slug": "123456"
}
```

**Success Response:**

```javascript
{
  "_id": "mongodb_id",
  "classroll": 123456,
  "email": "user@gmail.com",
  "name": "John Doe",
  "phone": "01234567890",
  "gender": "Male",
  "batch": 2024,
  "dept": "CSE",
  "membership": true,
  "membershipExpiresAt": "2024-12-31T23:59:59.999Z"
}
```

### 4. Update Profile

**Endpoint:** `PUT /api/users/update-profile`
**Authentication:** Required

**Request Body:**

```javascript
{
  "name": "John Doe",
  "phone": "01234567890",
  "gender": "Male",
  "tshirt": "L",
  "batch": 2024,
  "dept": "CSE",
  "cfhandle": "john_cf",
  "atchandle": "john_at",
  "cchandle": "john_cc"
}
```

### 5. Email Verification

**Send Verification Code:**

```javascript
POST /api/users/send-verification
Authorization: Bearer <token>
```

**Verify Code:**

```javascript
POST /api/users/verify-email
Authorization: Bearer <token>
Body: { "code": "123456" }
```

### 6. Password Recovery

**Send Reset Code:**

```javascript
POST /api/users/forgot-password
Body: { "email": "user@gmail.com" }
```

**Reset Password:**

```javascript
POST /api/users/recover-password
Body: {
  "email": "user@gmail.com",
  "code": "123456",
  "password": "newpassword123"
}
```

### 7. Admin Functions

**Get All Users:**

```javascript
GET /api/users/list
Authorization: Bearer <admin_token>
```

**Update Membership:**

```javascript
PUT /api/users/membership/:userId
Authorization: Bearer <admin_token>
Body: {
  "membership": true,
  "durationInMonths": 3 // 1, 2, or 3 months
}
```

---

## Event Management

### 1. Get All Events

**Endpoint:** `GET /api/events/get_all_event`

**Success Response:**

```javascript
{
  "message": "All current events",
  "soloEvents": [...],
  "teamEvents": [...]
}
```

### 2. Get Single Event

**Endpoint:** `GET /api/events/get_one_event/:eventId`

### 3. Create Event (Admin Only)

**Endpoint:** `POST /api/events/add_event`
**Authentication:** Admin Required
**Content-Type:** `multipart/form-data`

**Form Data:**

```javascript
{
  "eventName": "Programming Contest",
  "eventType": "solo", // or "team"
  "date": "2024-12-31T10:00:00.000Z",
  "registrationDeadline": "2024-12-25T23:59:59.999Z",
  "location": "Main Auditorium",
  "description": "Annual programming contest",
  "needMembership": true,
  "images": [File1, File2] // Multiple image files
}
```

### 4. Register for Solo Event

**Endpoint:** `POST /api/events/register_for_solo_event/:eventId`
**Authentication:** Required

**Request Body:**

```javascript
{
  "Name": "John Doe"
}
```

**Membership Check:**

- If event requires membership, user must have valid membership
- Returns 403 if membership required but user doesn't have it

### 5. Register for Team Event

**Endpoint:** `POST /api/events/register_for_team_event/:eventId`
**Authentication:** Required

**Request Body:**

```javascript
{
  "teamName": "Code Warriors",
  "members": [
    "member1@gmail.com",
    "member2@gmail.com",
    "member3@gmail.com"
  ]
}
```

**Validation:**

- All members must exist in system
- All members must have valid membership if event requires it
- No member can be in multiple teams for same event

### 6. Update/Delete Events (Admin Only)

**Update:**

```javascript
PUT /api/events/update_event/:eventId
Authorization: Bearer <admin_token>
```

**Delete:**

```javascript
POST /api/events/delete_event/:eventId
Authorization: Bearer <admin_token>
```

### 7. Gallery Management

**Upload Images:**

```javascript
POST /api/events/upload_images_to_gallery
Content-Type: multipart/form-data
Form Data: { "images": [File1, File2, ...] }
```

---

## Notification System

### 1. Send Notification to All Users

**Endpoint:** `POST /api/notifications/notify-all`
**Authentication:** Admin Required

**Request Body:**

```javascript
{
  "title": "New Event Announcement",
  "message": "Programming contest registration is now open!"
}
```

### 2. Send Notification to Specific User

**Endpoint:** `POST /api/notifications/notify/:fcmToken`
**Authentication:** Admin Required

**Request Body:**

```javascript
{
  "title": "Personal Message",
  "message": "Your registration has been approved!"
}
```

---

## PAD Statement System

### 1. Send PAD Statement Email

**Endpoint:** `POST /api/users/pad/send`
**Authentication:** Optional (user context preferred)

**Request Body (New Array Format - Recommended):**

```javascript
{
  "receiverEmail": "recipient@email.com",
  "subject": "pcIST — Official Statement", // Optional, defaults to "pcIST Statement"
  "statement": "Dear Sir/Madam,\n\nWe are pleased to share updates on upcoming activities...",
  "authorizers": [
    {
      "name": "Md Sazzad Hossain",
      "role": "General Secretary"
    },
    {
      "name": "Dr. A. K. M. Rahman", 
      "role": "Head of Department"
    },
    {
      "name": "Prof. Jane Smith",
      "role": "Faculty Advisor"
    }
  ],
  "contactEmail": "contact@pcist.org",
  "contactPhone": "+8801XXXXXXXXX",
  "address": "Institute of Science & Technology (IST), Dhaka"
}
```

**Request Body (Legacy Format - Backward Compatibility):**

```javascript
{
  "receiverEmail": "recipient@email.com",
  "subject": "pcIST — Official Statement",
  "statement": "Dear Sir/Madam,\n\nWe are pleased to share updates...",
  "authorizedBy": "Md Sazzad Hossain",
  "authorizerName": "General Secretary",
  "authorizedBy2": "Dr. A. K. M. Rahman",
  "authorizerName2": "Head of Department",
  "authorizedBy3": "Prof. Jane Smith",
  "authorizerName3": "Faculty Advisor",
  "contactEmail": "contact@pcist.org",
  "contactPhone": "+8801XXXXXXXXX",
  "address": "Institute of Science & Technology (IST), Dhaka"
}
```

**Response:**

```javascript
{
  "success": true,
  "message": "Statement email sent",
  "serial": "pcIST-2025-0001",
  "date": "02 September 2025",
  "id": "64a7b8c9d1e2f3a4b5c6d7e8"
}
```

### 2. Download PAD Statement PDF

**Endpoint:** `POST /api/users/pad/download`
**Authentication:** Optional (user context preferred)

**Request Body (New Array Format - Recommended):**

```javascript
{
  "statement": "Dear Sir/Madam,\n\nWe are pleased to share updates on upcoming activities...",
  "authorizers": [
    {
      "name": "Md Sazzad Hossain",
      "role": "General Secretary"
    },
    {
      "name": "Dr. A. K. M. Rahman", 
      "role": "Head of Department"
    }
  ],
  "contactEmail": "contact@pcist.org",
  "contactPhone": "+8801XXXXXXXXX",
  "address": "Institute of Science & Technology (IST), Dhaka"
}
```

**Response:** 
- Content-Type: `application/pdf`
- Content-Disposition: `attachment; filename="pcIST-2025-0001.pdf"`
- Body: PDF file buffer

### 3. List PAD Statement History

**Endpoint:** `GET /api/users/pad/history`
**Authentication:** Admin Required

**Response:**

```javascript
{
  "success": true,
  "count": 15,
  "data": [
    {
      "_id": "64a7b8c9d1e2f3a4b5c6d7e8",
      "receiverEmail": "recipient@email.com",
      "subject": "pcIST Statement",
      "statement": "Dear Sir/Madam...",
      "authorizers": [
        {
          "name": "Md Sazzad Hossain",
          "role": "General Secretary"
        }
      ],
      "serial": "pcIST-2025-0001",
      "dateStr": "02 September 2025",
      "sent": true,
      "sentAt": "2025-09-02T10:30:00.000Z",
      "createdAt": "2025-09-02T10:30:00.000Z"
    }
  ]
}
```

### Notes on Authorizers

- **Recommended**: Use the `authorizers` array format for new implementations
- **Legacy Support**: Individual fields (`authorizedBy`, `authorizerName`, etc.) are still supported
- **Maximum**: Up to 3 authorizers are supported
- **Signature Layout**: 
  - 1 signature: positioned at bottom right
  - 2 signatures: positioned at opposite sides
  - 3 signatures: two at sides, one in the middle
- **Serial Numbers**: Auto-incremented 4-digit format (e.g., pcIST-2025-0001)

---

## Error Handling

### Standard Error Response Format

```javascript
{
  "status": false,
  "message": "Error description",
  "code": 400 // HTTP status code
}
```

### Common Error Codes

- `400`: Bad Request (validation errors)
- `401`: Unauthorized (invalid credentials)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found (resource doesn't exist)
- `500`: Internal Server Error

### Membership-Related Errors

```javascript
{
  "status": false,
  "message": "This event requires membership. Please purchase a membership to register."
}
```

---

## Frontend Integration Examples

### React/JavaScript Examples

#### 1. User Registration

```javascript
const registerUser = async (userData) => {
  try {
    const response = await fetch("/api/users/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
    });

    const data = await response.json();

    if (data.status) {
      // Save token to localStorage
      localStorage.setItem("token", data.token);
      localStorage.setItem("userSlug", data.slug);
      return { success: true, data };
    } else {
      return { success: false, error: data.message };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Usage
const result = await registerUser({
  classroll: 123456,
  email: "student@gmail.com",
  password: "securepass123",
});
```

#### 2. User Login

```javascript
const loginUser = async (classroll, password) => {
  try {
    const response = await fetch("/api/users/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ classroll, password }),
    });

    const data = await response.json();

    if (data.status) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("userSlug", data.slug);
      return { success: true, token: data.token };
    } else {
      return { success: false, error: data.message };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
};
```

#### 3. Authenticated API Calls

```javascript
const makeAuthenticatedRequest = async (url, options = {}) => {
  const token = localStorage.getItem("token");

  const config = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (response.status === 401) {
      // Token expired, redirect to login
      localStorage.removeItem("token");
      window.location.href = "/login";
      return;
    }

    return data;
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
};

// Usage
const userProfile = await makeAuthenticatedRequest("/api/users/profile", {
  method: "POST",
  body: JSON.stringify({ slug: localStorage.getItem("userSlug") }),
});
```

#### 4. Event Registration

```javascript
const registerForSoloEvent = async (eventId, name) => {
  return await makeAuthenticatedRequest(
    `/api/events/register_for_solo_event/${eventId}`,
    {
      method: "POST",
      body: JSON.stringify({ Name: name }),
    }
  );
};

const registerForTeamEvent = async (eventId, teamName, memberEmails) => {
  return await makeAuthenticatedRequest(
    `/api/events/register_for_team_event/${eventId}`,
    {
      method: "POST",
      body: JSON.stringify({
        teamName,
        members: memberEmails,
      }),
    }
  );
};
```

#### 5. File Upload (Event Images)

```javascript
const uploadEventImages = async (eventData, imageFiles) => {
  const formData = new FormData();

  // Add text fields
  Object.keys(eventData).forEach((key) => {
    formData.append(key, eventData[key]);
  });

  // Add image files
  imageFiles.forEach((file) => {
    formData.append("images", file);
  });

  try {
    const token = localStorage.getItem("token");
    const response = await fetch("/api/events/add_event", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        // Don't set Content-Type for FormData
      },
      body: formData,
    });

    return await response.json();
  } catch (error) {
    console.error("Upload error:", error);
    throw error;
  }
};
```

#### 6. React Component Example

```jsx
import React, { useState, useEffect } from "react";

const EventList = () => {
  const [events, setEvents] = useState({ soloEvents: [], teamEvents: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await fetch("/api/events/get_all_event");
      const data = await response.json();
      setEvents(data);
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSolo = async (eventId) => {
    const name = prompt("Enter your name:");
    if (!name) return;

    try {
      const result = await registerForSoloEvent(eventId, name);
      if (result.status) {
        alert("Registration successful!");
      } else {
        alert(`Registration failed: ${result.message}`);
      }
    } catch (error) {
      alert("Registration error. Please try again.");
    }
  };

  if (loading) return <div>Loading events...</div>;

  return (
    <div>
      <h2>Solo Events</h2>
      {events.soloEvents.map((event) => (
        <div key={event._id} className="event-card">
          <h3>{event.eventName}</h3>
          <p>{event.description}</p>
          <p>Date: {new Date(event.date).toLocaleDateString()}</p>
          <p>
            Registration Deadline:{" "}
            {new Date(event.registrationDeadline).toLocaleDateString()}
          </p>
          {event.needMembership && <p>⚠️ Membership required</p>}
          <button onClick={() => handleRegisterSolo(event._id)}>
            Register
          </button>
        </div>
      ))}
    </div>
  );
};
```

### State Management (Redux/Context)

```javascript
// auth.slice.js (Redux Toolkit)
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

export const loginUser = createAsyncThunk(
  "auth/login",
  async ({ classroll, password }, { rejectWithValue }) => {
    try {
      const response = await fetch("/api/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classroll, password }),
      });

      const data = await response.json();

      if (data.status) {
        localStorage.setItem("token", data.token);
        return data;
      } else {
        return rejectWithValue(data.message);
      }
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
    token: localStorage.getItem("token"),
    loading: false,
    error: null,
  },
  reducers: {
    logout: (state) => {
      localStorage.removeItem("token");
      localStorage.removeItem("userSlug");
      state.user = null;
      state.token = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.user = action.payload.user;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});
```

---

## Best Practices

### 1. Token Management

- Store JWT tokens securely (localStorage for web, secure storage for mobile)
- Implement automatic token refresh
- Clear tokens on logout

### 2. Error Handling

- Always check response status
- Implement global error handling
- Show user-friendly error messages

### 3. Loading States

- Show loading indicators during API calls
- Implement proper loading states for better UX

### 4. Validation

- Validate data on frontend before sending
- Handle server-side validation errors gracefully

### 5. File Uploads

- Show upload progress
- Validate file types and sizes on frontend
- Handle upload errors appropriately

---

## Testing

### API Testing with curl

```bash
# Test registration
curl -X POST http://localhost:5000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"classroll": 123456, "email": "test@gmail.com", "password": "password123"}'

# Test login
curl -X POST http://localhost:5000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"classroll": 123456, "password": "password123"}'

# Test authenticated route
curl -X GET http://localhost:5000/api/events/get_all_event \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

This documentation provides a comprehensive guide for frontend developers to integrate with your pcIST backend API. Update the base URLs and routes according to your specific deployment configuration.
