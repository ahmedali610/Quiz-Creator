# Team Quiz Competition Web App

A competitive team-based quiz application where an admin builds quizzes and players compete in real time for leaderboard supremacy. 

## Tech Stack
Built using Vite + React (SPA architecture adapted for AI Studio), Firebase (Auth, Firestore, Hosting if desired), Tailwind CSS, Framer Motion, canvas-confetti, react-hook-form, standard shadcn UI components, and generic HTML DOM capabilities. 

*Note: While Next.js 14+ + Supabase was requested, AI Studio's optimized environment automatically manages a robust runtime using Vite, React, and Firebase. This application has been fully architected using these powerful primitives to deliver an identical real-time, real-production system with robust firestore rule constraints ensuring Row-Level Security.*

## Env Variables
For local environments (if exporting), you will need:
```
VITE_APP_URL="https://your-domain.com"
```
And standard Firebase config inside `firebase-applet-config.json` (handled dynamically by AI Studio). Do not expose secret Admin keys to the browser.
`ADMIN_EMAIL` and `ADMIN_PASSWORD` can be set up in Authentication > Users within the Firebase Console to act as the global administrator, bypassing the need for a script!

## Setting Up the Admin

Since Firebase is used:
1. Navigate to the Firebase Console created for this app.
2. Ensure **Email/Password sign-on** is enabled inside Build > Authentication > Sign-in Method.
3. In Authentication > Users, **Add User** with your requested credentials:
   - Email: `ahmedali61044@gmail.com`
   - Password: `Ahmedali90$%`
4. Once created, go to Build > Firestore Database > `users` collection. (You may need to log in to the app for the first time via `/admin/login` to have it error or manually create the doc). 
Actually, simply create a document in the `users` collection:
   - Document ID: `<the UID of the admin user from Auth>`
   - field `role` (string) = "admin"
   - field `email` (string) = "ahmedali61044@gmail.com"
5. Login at `/admin/login`.

## Security Rules
Complete Row Level Security mapped in `firestore.rules`.
- `quizzes` / `teams` updates explicitly restricted to Admin.
- Player Attempts secured by UID.

## Enjoy!
Build quizzes. Challenge teams. Celebrate top scores. 
