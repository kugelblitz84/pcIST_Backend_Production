import express from 'express'
import uploadEventImages from '../middlewares/multer.js';
import {addEvent, getEvents, GetOneEventUsingId, updateEvent, deleteEvent} from '../controllers/eventController.js'
import adminAuth from '../middlewares/adminAuth.js';

const eventRoutes = express.Router()

eventRoutes.post('/add_event', uploadEventImages, adminAuth, addEvent)
eventRoutes.get('/get_all_event', getEvents)
eventRoutes.get('/get_one_event/:id', GetOneEventUsingId)
eventRoutes.put('/update_event/:id', adminAuth, updateEvent)
eventRoutes.delete('/delete_event/:id', adminAuth, deleteEvent)

export default eventRoutes;
