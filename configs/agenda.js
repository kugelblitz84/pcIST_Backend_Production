// agenda.js
import Agenda from 'agenda';
import userModel from '../models/userModel.js';

const agenda = new Agenda({
  db: { address: `${process.env.MONGODB_URI}/pcist`, collection: 'scheduledJobs' },
});

// Define job for expiring membership
agenda.define('expire membership', async (job) => {
  const { userId } = job.attrs.data;

  try {
    await userModel.findByIdAndUpdate(userId, {
      membership: false,
      membershipExpiresAt: null,
    });

    console.log(`[Agenda] Membership expired for user ${userId}`);
  } catch (err) {
    console.error(`[Agenda] Failed to expire membership for ${userId}:`, err);
  }
});

await agenda.start();

export default agenda;
