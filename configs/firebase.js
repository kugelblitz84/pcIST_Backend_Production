import admin from "firebase-admin";
import { readFileSync } from "fs";

//this file has been hidden through the .ignore . It needs to be downloaded from the firebase console and kept in the root directory. make sure to update the names in the .env file after downloading the new json from firebase service accounts
//var path = process.env.FIREBASE_JSON_KEY_FILE;
//const serviceAccount = JSON.parse(readFileSync(path, "utf8"));


if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.PROJECT_ID,
      clientEmail: process.env.CLIENT_EMAIL,
      privateKey: process.env.PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export default admin;
