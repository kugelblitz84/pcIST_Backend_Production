import express from 'express'
import auth from '../middlewares/auth.js';
import eventController from '../controllers/eventController.js'
const {addEvent, getEvents, GetOneEventUsingId, updateEvent, deleteEvent} = eventController
const eventRoutes = express.Router()

eventRoutes.post('/add_event', auth, addEvent)
eventRoutes.post('/get_all_event', auth, getEvents)
eventRoutes.post('/get_one_event/:id', auth, GetOneEventUsingId)
eventRoutes.put('/update_event/:id', auth, updateEvent)
eventRoutes.post('/delete_event/:id', auth, deleteEvent)