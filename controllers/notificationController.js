
import admin from '../configs/firebase.js';


const notifyOneUser = async (req, res) => {
  try {
    const fcmToken = req.params.token
    const {title, message} = req.body
   const messageJson = {
        token: fcmToken,
        notification: {
          title: title,
          body: message,
        },
        data: {
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
          status: 'done',
        },
      }
    const response = await admin.messaging().send(messageJson);


    console.log('Notification sent:', response.data);
  } catch (error) {
    console.error('Error sending FCM notification:', error.response?.data || error.message);
  }
};

const notifyAllUsers = async (req, res) => {
  try {
    const { title, message } = req.body;

    const messageJson = {
      topic: 'all_users',
      notification: {
        title,
        body: message,
      },
      data: {
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        status: 'done',
      },
    };

    const response = await admin.messaging().send(messageJson);

    console.log('Notification sent:', response);
    res.status(200).json({ success: true, message: 'Notification sent', response });
  } catch (error) {
    console.error('Error sending FCM notification:', error.message);
    res.status(500).json({ success: false, message: 'Failed to send notification', error: error.message });
  }
};

export {notifyAllUsers, notifyOneUser};
