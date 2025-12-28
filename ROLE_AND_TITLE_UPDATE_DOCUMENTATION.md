# Role and Title Management - Update Documentation

This document provides comprehensive documentation for the new Role-Based Access Control (RBAC) features including user titles and treasurer functionality.

## Table of Contents

1. [Overview](#overview)
2. [Data Model Changes](#data-model-changes)
3. [New API Endpoints](#new-api-endpoints)
4. [Authentication & Authorization](#authentication--authorization)
5. [Frontend Integration Guide](#frontend-integration-guide)
6. [Error Handling](#error-handling)
7. [Migration Notes](#migration-notes)

---

## Overview

### New Features

1. **User Titles**: Users can now be assigned organizational titles:
   - `GS` - General Secretary (only ONE user can have this title)
   - `JS` - Joint Secretary
   - `OS` - Organizing Secretary
   - `Member` - Default title for all users

2. **Treasurer Role**: A boolean flag that grants invoice generation privileges without requiring full admin access.

3. **Role Management**: Admins can now:
   - Assign/change user titles
   - Promote/demote users to/from admin
   - Enable/disable treasurer status

### Permission Matrix

| Feature | Admin | Treasurer | Regular User |
|---------|-------|-----------|--------------|
| View Users | ✅ | ❌ | ❌ |
| Update User Titles | ✅ | ❌ | ❌ |
| Toggle Admin Status | ✅ | ❌ | ❌ |
| Toggle Treasurer Status | ✅ | ❌ | ❌ |
| Generate/Send Invoices | ✅ | ✅ | ❌ |
| View Invoice History | ✅ | ✅ | ❌ |
| PAD Statement Operations | ✅ | ❌ | ❌ |
| Membership Management | ✅ | ❌ | ❌ |

---

## Data Model Changes

### User Model Updates

```javascript
// New fields added to User schema
{
  title: {
    type: String,
    enum: ['GS', 'JS', 'OS', 'Member'],
    default: 'Member'
  },
  treasurer: {
    type: Boolean,
    default: false
  }
}
```

### Field Descriptions

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `title` | String (enum) | `'Member'` | Organizational title. Values: `GS`, `JS`, `OS`, `Member` |
| `treasurer` | Boolean | `false` | If `true`, user can generate invoices |
| `role` | Number | `1` | `1` = Regular member, `2` = Admin |

---

## New API Endpoints

### 1. Update User Title

**Endpoint:** `PUT /api/user/update-title/:id`

**Authentication:** Admin only

**Description:** Assign or change a user's organizational title. Note that only ONE user can hold the `GS` (General Secretary) title at any time. If assigning `GS` to a new user, the previous `GS` will automatically be demoted to `Member`.

**Request:**
```http
PUT /api/user/update-title/507f1f77bcf86cd799439011
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "slug": "admin-slug",
  "title": "GS"
}
```

**Parameters:**
| Parameter | Type | Location | Required | Description |
|-----------|------|----------|----------|-------------|
| `id` | ObjectId | URL Param | Yes | Target user's MongoDB ID |
| `slug` | String | Body | Yes | Requesting admin's slug |
| `title` | String | Body | Yes | New title: `GS`, `JS`, `OS`, or `Member` |

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "User title updated to GS successfully.",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@gmail.com",
    "slug": "12345",
    "title": "GS",
    "role": 1,
    "treasurer": false
  }
}
```

**Response (Error - 400):**
```json
{
  "success": false,
  "message": "Invalid title. Must be one of: GS, JS, OS, Member"
}
```

---

### 2. Toggle Admin Status

**Endpoint:** `PUT /api/user/toggle-admin/:id`

**Authentication:** Admin only

**Description:** Promote a user to admin or demote an admin to regular member. Admins cannot demote themselves.

**Request:**
```http
PUT /api/user/toggle-admin/507f1f77bcf86cd799439011
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "slug": "admin-slug",
  "isAdmin": true
}
```

**Parameters:**
| Parameter | Type | Location | Required | Description |
|-----------|------|----------|----------|-------------|
| `id` | ObjectId | URL Param | Yes | Target user's MongoDB ID |
| `slug` | String | Body | Yes | Requesting admin's slug |
| `isAdmin` | Boolean | Body | Yes | `true` to promote, `false` to demote |

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "User promoted to admin successfully.",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@gmail.com",
    "slug": "12345",
    "title": "Member",
    "role": 2,
    "treasurer": false
  }
}
```

**Response (Error - 403):**
```json
{
  "success": false,
  "message": "You cannot demote yourself from admin."
}
```

---

### 3. Toggle Treasurer Status

**Endpoint:** `PUT /api/user/toggle-treasurer/:id`

**Authentication:** Admin only

**Description:** Enable or disable treasurer privileges for a user. Treasurers can generate invoices without being admins.

**Request:**
```http
PUT /api/user/toggle-treasurer/507f1f77bcf86cd799439011
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "slug": "admin-slug",
  "isTreasurer": true
}
```

**Parameters:**
| Parameter | Type | Location | Required | Description |
|-----------|------|----------|----------|-------------|
| `id` | ObjectId | URL Param | Yes | Target user's MongoDB ID |
| `slug` | String | Body | Yes | Requesting admin's slug |
| `isTreasurer` | Boolean | Body | Yes | `true` to enable, `false` to disable |

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "User treasurer status enabled successfully.",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@gmail.com",
    "slug": "12345",
    "title": "Member",
    "role": 1,
    "treasurer": true
  }
}
```

---

### 4. Get User Data (Updated)

**Endpoint:** `POST /api/user/get-user-data`

**Authentication:** Required (any authenticated user)

**Description:** Retrieve user data by slug. Returns different data based on who is requesting:

- **Self or Admin**: Returns full user data (excluding sensitive fields like password)
- **Other Users**: Returns limited public profile data only

**Request:**
```http
POST /api/user/get-user-data
Authorization: Bearer <token>
Content-Type: application/json

{
  "slug": "12345"
}
```

**Parameters:**
| Parameter | Type | Location | Required | Description |
|-----------|------|----------|----------|-------------|
| `slug` | String | Body | Yes | Target user's slug |

**Response (Success - 200, Self or Admin view):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "classroll": 12345,
  "email": "john@gmail.com",
  "is_email_verified": true,
  "phone": "01700000000",
  "profileimage": "https://...",
  "name": "John Doe",
  "gender": "Male",
  "tshirt": "L",
  "batch": 2022,
  "dept": "CSE",
  "role": 2,
  "title": "GS",
  "treasurer": false,
  "membership": true,
  "membershipExpiresAt": "2025-03-28T00:00:00.000Z",
  "cfhandle": "john_cf",
  "atchandle": "john_at",
  "cchandle": "john_cc",
  "badges": ["badge1"],
  "certificates": ["cert1"],
  "myParticipations": { "solo": [], "team": [] },
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

**Response (Success - 200, Other users view - Limited data):**
```json
{
  "name": "John Doe",
  "role": 2,
  "title": "GS",
  "cfhandle": "john_cf",
  "atchandle": "john_at",
  "cchandle": "john_cc",
  "batch": 2022,
  "dept": "CSE",
  "badges": ["badge1"],
  "certificates": ["cert1"]
}
```

---

### 5. Get User List (Updated)

**Endpoint:** `POST /api/user/get-user-list`

**Authentication:** Admin only

**Description:** Retrieve list of all users with full details. Returns all user fields except sensitive data (password, forgotPasswordCode, verificationCode).

**Request:**
```http
POST /api/user/get-user-list
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "slug": "admin-slug"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "classroll": 12345,
      "email": "john@gmail.com",
      "is_email_verified": true,
      "phone": "01700000000",
      "profileimage": "https://...",
      "name": "John Doe",
      "gender": "Male",
      "tshirt": "L",
      "batch": 2022,
      "dept": "CSE",
      "role": 2,
      "title": "GS",
      "treasurer": false,
      "membership": true,
      "membershipExpiresAt": "2025-03-28T00:00:00.000Z",
      "cfhandle": "john_cf",
      "atchandle": "john_at",
      "cchandle": "john_cc",
      "badges": [],
      "certificates": [],
      "slug": "12345",
      "myParticipations": { "solo": [], "team": [] },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

---

## Authentication & Authorization

### Middleware Overview

| Middleware | Description | Usage |
|------------|-------------|-------|
| `auth` | Basic authentication - verifies token and user | Profile updates, verification |
| `adminAuth` | Requires admin role (role === 2) | User management, PAD statements |
| `treasurerAuth` | Requires admin OR treasurer status | Invoice operations |

### Invoice Routes Authorization

Invoice-related routes now use `treasurerAuth` middleware, allowing both:
- **Admins** (role === 2)
- **Treasurers** (treasurer === true)

Affected routes:
- `POST /api/user/invoice/send`
- `POST /api/user/invoice/download`
- `GET /api/user/invoice/download/:id`
- `GET /api/user/invoice/history`

---

## Frontend Integration Guide

### 1. Fetching User Data with New Fields

When displaying user profiles or user lists, ensure you handle the new fields:

```javascript
// Example: Fetch user list
const fetchUsers = async () => {
  const response = await fetch('/api/user/get-user-list', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ slug: adminSlug })
  });
  
  const data = await response.json();
  
  // data.data now includes 'title' and 'treasurer' fields
  data.data.forEach(user => {
    console.log(`${user.name}: ${user.title}, Treasurer: ${user.treasurer}`);
  });
};
```

### 2. Updating User Title

```javascript
const updateUserTitle = async (userId, newTitle) => {
  const response = await fetch(`/api/user/update-title/${userId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      slug: adminSlug,
      title: newTitle // 'GS', 'JS', 'OS', or 'Member'
    })
  });
  
  const result = await response.json();
  
  if (result.success) {
    // Title updated successfully
    // If newTitle was 'GS', refresh user list as previous GS was demoted
  }
};
```

### 3. Toggle Admin Status

```javascript
const toggleAdmin = async (userId, makeAdmin) => {
  const response = await fetch(`/api/user/toggle-admin/${userId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      slug: adminSlug,
      isAdmin: makeAdmin
    })
  });
  
  const result = await response.json();
  
  if (!result.success && response.status === 403) {
    // Admin tried to demote themselves
    alert(result.message);
  }
};
```

### 4. Toggle Treasurer Status

```javascript
const toggleTreasurer = async (userId, makeTreasurer) => {
  const response = await fetch(`/api/user/toggle-treasurer/${userId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      slug: adminSlug,
      isTreasurer: makeTreasurer
    })
  });
  
  const result = await response.json();
  return result;
};
```

### 5. Checking User Permissions (Frontend)

```javascript
// After login, decode token or use user data to check permissions
const checkPermissions = (user) => {
  const isAdmin = user.role === 2;
  const isTreasurer = user.treasurer === true;
  const canManageInvoices = isAdmin || isTreasurer;
  const canManageUsers = isAdmin;
  
  return {
    isAdmin,
    isTreasurer,
    canManageInvoices,
    canManageUsers,
    title: user.title
  };
};

// Example UI rendering
const renderMenu = (permissions) => {
  return (
    <nav>
      <Link to="/dashboard">Dashboard</Link>
      {permissions.canManageInvoices && (
        <Link to="/invoices">Invoice Management</Link>
      )}
      {permissions.canManageUsers && (
        <>
          <Link to="/users">User Management</Link>
          <Link to="/pad-statements">PAD Statements</Link>
        </>
      )}
    </nav>
  );
};
```

### 6. Title Display Component

```jsx
// React component example
const TitleBadge = ({ title }) => {
  const titleConfig = {
    'GS': { label: 'General Secretary', color: 'gold' },
    'JS': { label: 'Joint Secretary', color: 'silver' },
    'OS': { label: 'Organizing Secretary', color: 'bronze' },
    'Member': { label: 'Member', color: 'gray' }
  };
  
  const config = titleConfig[title] || titleConfig['Member'];
  
  return (
    <span className={`badge badge-${config.color}`}>
      {config.label}
    </span>
  );
};

// Usage
<TitleBadge title={user.title} />
```

### 7. User Management Table Component

```jsx
const UserManagementTable = ({ users, currentUserId, onUpdate }) => {
  return (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Title</th>
          <th>Admin</th>
          <th>Treasurer</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {users.map(user => (
          <tr key={user._id}>
            <td>{user.name}</td>
            <td>{user.email}</td>
            <td>
              <select 
                value={user.title}
                onChange={(e) => onUpdate('title', user._id, e.target.value)}
              >
                <option value="GS">General Secretary</option>
                <option value="JS">Joint Secretary</option>
                <option value="OS">Organizing Secretary</option>
                <option value="Member">Member</option>
              </select>
            </td>
            <td>
              <input 
                type="checkbox" 
                checked={user.role === 2}
                disabled={user._id === currentUserId}
                onChange={(e) => onUpdate('admin', user._id, e.target.checked)}
              />
            </td>
            <td>
              <input 
                type="checkbox" 
                checked={user.treasurer}
                onChange={(e) => onUpdate('treasurer', user._id, e.target.checked)}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
```

---

## Error Handling

### Common Error Responses

| Status Code | Scenario | Response |
|-------------|----------|----------|
| 400 | Invalid title value | `{ "success": false, "message": "Invalid title. Must be one of: GS, JS, OS, Member" }` |
| 400 | Missing slug | `{ "success": false, "message": "Missing slug." }` |
| 401 | Missing/invalid token | `{ "success": false, "message": "Not Authorized. Login again." }` |
| 403 | Not admin (for admin routes) | `{ "message": "Not authorized as admin." }` |
| 403 | Not admin/treasurer (for invoice routes) | `{ "success": false, "message": "Not authorized. Only admins or treasurers can access this resource." }` |
| 403 | Self-demotion attempt | `{ "success": false, "message": "You cannot demote yourself from admin." }` |
| 404 | User not found | `{ "success": false, "message": "User not found." }` |
| 500 | Server error | `{ "success": false, "message": "Server error while updating..." }` |

---

## Migration Notes

### For Existing Users

Existing users in the database will automatically have:
- `title`: `undefined` (will default to `'Member'` in queries)
- `treasurer`: `undefined` (will default to `false` in queries)

### Recommended Migration Script

If you want to explicitly set default values for existing users:

```javascript
// Migration script (run once)
const migrateUsers = async () => {
  await userModel.updateMany(
    { title: { $exists: false } },
    { $set: { title: 'Member' } }
  );
  
  await userModel.updateMany(
    { treasurer: { $exists: false } },
    { $set: { treasurer: false } }
  );
  
  console.log('Migration complete');
};
```

### Breaking Changes

1. **Invoice Routes**: Now use `treasurerAuth` instead of `adminAuth`. Both admins and treasurers can access these routes.

2. **User List Response**: Now includes `title` and `treasurer` fields. Update frontend code to handle these new fields.

---

## API Quick Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| PUT | `/api/user/update-title/:id` | Admin | Update user's title |
| PUT | `/api/user/toggle-admin/:id` | Admin | Toggle admin status |
| PUT | `/api/user/toggle-treasurer/:id` | Admin | Toggle treasurer status |
| POST | `/api/user/get-user-data` | Any User | Get user data (returns limited data for non-self/non-admin) |
| POST | `/api/user/get-user-list` | Admin | Get all users (full details) |
| POST | `/api/user/invoice/send` | Admin/Treasurer | Send invoice email |
| POST | `/api/user/invoice/download` | Admin/Treasurer | Download invoice PDF |
| GET | `/api/user/invoice/download/:id` | Admin/Treasurer | Download invoice by ID |
| GET | `/api/user/invoice/history` | Admin/Treasurer | List invoice history |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-28 | Initial implementation of title and treasurer RBAC |
