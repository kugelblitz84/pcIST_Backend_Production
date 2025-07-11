
import admin from '../configs/firebase';


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
    try{
        const {title, message} = req.body;
        const messageJson = {
        topic: '/topics/all_users',
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
}catch(e){
    console.error('Error sending FCM notification:', error.response?.data || error.message)
}
    
}

export {notifyAllUsers, notifyOneUser};
