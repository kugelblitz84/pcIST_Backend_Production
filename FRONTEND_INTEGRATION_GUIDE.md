# pcIST Backend - Quick Integration Guide

## 🚀 Quick Setup

### 1. Environment Setup

```javascript
// config.js
export const API_BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://your-heroku-app.herokuapp.com"
    : "http://localhost:5000";
```

### 2. API Client Setup

```javascript
// api.js
import axios from "axios";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error.response?.data || error.message);
  }
);

export default api;
```

## 🔐 Authentication Methods

### Register User

```javascript
export const registerUser = async (userData) => {
  try {
    const response = await api.post("/api/users/register", userData);
    if (response.status) {
      localStorage.setItem("token", response.token);
      localStorage.setItem("userSlug", response.slug);
    }
    return response;
  } catch (error) {
    throw error;
  }
};
```

### Login User

```javascript
export const loginUser = async (classroll, password) => {
  const response = await api.post("/api/users/login", { classroll, password });
  if (response.status) {
    localStorage.setItem("token", response.token);
    localStorage.setItem("userSlug", response.slug);
  }
  return response;
};
```

### Logout User

```javascript
export const logoutUser = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("userSlug");
  window.location.href = "/login";
};
```

## 👤 User Operations

### Get User Profile

```javascript
export const getUserProfile = async (slug) => {
  return await api.post("/api/users/profile", { slug });
};
```

### Update Profile

```javascript
export const updateProfile = async (profileData) => {
  return await api.put("/api/users/update-profile", profileData);
};
```

## 🎯 Event Operations

### Get All Events

```javascript
export const getAllEvents = async () => {
  return await api.get("/api/events/get_all_event");
};
```

### Register for Solo Event

```javascript
export const registerSoloEvent = async (eventId, name) => {
  return await api.post(`/api/events/register_for_solo_event/${eventId}`, {
    Name: name,
  });
};
```

### Register Team for Event

```javascript
export const registerTeamEvent = async (eventId, teamName, members) => {
  return await api.post(`/api/events/register_for_team_event/${eventId}`, {
    teamName,
    members,
  });
};
```

### Create Event (Admin)

```javascript
export const createEvent = async (eventData, images) => {
  const formData = new FormData();

  Object.keys(eventData).forEach((key) => {
    formData.append(key, eventData[key]);
  });

  images.forEach((image) => {
    formData.append("images", image);
  });

  return await api.post("/api/events/add_event", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};
```

## 🔔 Notification Operations

### Send Notification to All (Admin)

```javascript
export const notifyAllUsers = async (title, message) => {
  return await api.post("/api/notifications/notify-all", { title, message });
};
```

## 📱 React Hook Examples

### useAuth Hook

```javascript
import { useState, useEffect, createContext, useContext } from "react";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem("token"));

  useEffect(() => {
    if (token) {
      // Validate token and get user data
      validateToken();
    } else {
      setLoading(false);
    }
  }, [token]);

  const validateToken = async () => {
    try {
      const slug = localStorage.getItem("userSlug");
      if (slug) {
        const userData = await getUserProfile(slug);
        setUser(userData);
      }
    } catch (error) {
      localStorage.removeItem("token");
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (classroll, password) => {
    try {
      const response = await loginUser(classroll, password);
      if (response.status) {
        setToken(response.token);
        setUser(response.user);
        return { success: true };
      }
      return { success: false, error: response.message };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    logoutUser();
    setUser(null);
    setToken(null);
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    isAuthenticated: !!token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
```

### useEvents Hook

```javascript
import { useState, useEffect } from "react";

export const useEvents = () => {
  const [events, setEvents] = useState({ soloEvents: [], teamEvents: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const data = await getAllEvents();
      setEvents(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const registerForEvent = async (
    eventId,
    registrationData,
    isTeam = false
  ) => {
    try {
      let response;
      if (isTeam) {
        response = await registerTeamEvent(
          eventId,
          registrationData.teamName,
          registrationData.members
        );
      } else {
        response = await registerSoloEvent(eventId, registrationData.name);
      }

      if (response.status) {
        await fetchEvents(); // Refresh events
        return { success: true, message: response.message };
      }
      return { success: false, error: response.message };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  return {
    events,
    loading,
    error,
    fetchEvents,
    registerForEvent,
  };
};
```

## 🎨 Component Examples

### Event Registration Form

```jsx
import React, { useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { useEvents } from "./hooks/useEvents";

const EventRegistration = ({ event }) => {
  const { user, isAuthenticated } = useAuth();
  const { registerForEvent } = useEvents();
  const [loading, setLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState([""]);

  const handleSoloRegistration = async () => {
    if (!user?.name) {
      alert("Please complete your profile first");
      return;
    }

    setLoading(true);
    try {
      const result = await registerForEvent(event._id, { name: user.name });
      if (result.success) {
        alert("Registration successful!");
      } else {
        alert(`Registration failed: ${result.error}`);
      }
    } catch (error) {
      alert("Registration error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleTeamRegistration = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const teamName = formData.get("teamName");
    const members = teamMembers.filter((email) => email.trim());

    if (!teamName || members.length === 0) {
      alert("Please provide team name and at least one member email");
      return;
    }

    setLoading(true);
    try {
      const result = await registerForEvent(
        event._id,
        { teamName, members },
        true
      );
      if (result.success) {
        alert("Team registration successful!");
      } else {
        alert(`Registration failed: ${result.error}`);
      }
    } catch (error) {
      alert("Registration error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return <p>Please login to register for events.</p>;
  }

  return (
    <div className="event-registration">
      <h3>{event.eventName}</h3>
      <p>{event.description}</p>
      <p>📅 {new Date(event.date).toLocaleDateString()}</p>
      <p>
        ⏰ Registration deadline:{" "}
        {new Date(event.registrationDeadline).toLocaleDateString()}
      </p>

      {event.needMembership && (
        <div className="membership-warning">
          ⚠️ This event requires active membership
        </div>
      )}

      {event.eventType === "solo" ? (
        <button
          onClick={handleSoloRegistration}
          disabled={loading}
          className="register-btn"
        >
          {loading ? "Registering..." : "Register"}
        </button>
      ) : (
        <form onSubmit={handleTeamRegistration} className="team-form">
          <input type="text" name="teamName" placeholder="Team Name" required />

          {teamMembers.map((email, index) => (
            <input
              key={index}
              type="email"
              value={email}
              placeholder={`Member ${index + 1} Email`}
              onChange={(e) => {
                const newMembers = [...teamMembers];
                newMembers[index] = e.target.value;
                setTeamMembers(newMembers);
              }}
            />
          ))}

          <button
            type="button"
            onClick={() => setTeamMembers([...teamMembers, ""])}
          >
            Add Member
          </button>

          <button type="submit" disabled={loading}>
            {loading ? "Registering Team..." : "Register Team"}
          </button>
        </form>
      )}
    </div>
  );
};
```

## 🛠️ Utility Functions

### Format Date

```javascript
export const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
```

### Validate Form Data

```javascript
export const validateRegistration = ({ classroll, email, password }) => {
  const errors = {};

  if (!classroll || classroll < 1000) {
    errors.classroll = "Please enter a valid class roll";
  }

  if (!email || !email.endsWith("@gmail.com")) {
    errors.email = "Please enter a valid Gmail address";
  }

  if (!password || password.length < 8) {
    errors.password = "Password must be at least 8 characters";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};
```

### Handle API Errors

```javascript
export const handleApiError = (error) => {
  if (typeof error === "string") {
    return error;
  }

  if (error?.message) {
    return error.message;
  }

  return "An unexpected error occurred. Please try again.";
};
```

## 📦 Environment Variables

### Frontend (.env)

```bash
REACT_APP_API_BASE_URL=http://localhost:5000
REACT_APP_ENVIRONMENT=development
```

### Usage in React

```javascript
const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
```

## 🚀 Deployment Checklist

- [ ] Update API base URL for production
- [ ] Configure CORS settings on backend
- [ ] Set up environment variables on hosting platform
- [ ] Test all API endpoints in production
- [ ] Implement error logging
- [ ] Set up monitoring for API calls
- [ ] Configure proper authentication flow
- [ ] Test file upload functionality
- [ ] Verify notification system works

---

This quick reference guide provides the essential code snippets and patterns needed to integrate your frontend application with the pcIST backend API efficiently.
