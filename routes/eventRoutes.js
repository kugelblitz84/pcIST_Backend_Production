import express from 'express'
import uploadEventImages from '../middlewares/multer.js';
import {addEvent, getEvents, GetOneEventUsingId, updateEvent, deleteEvent,registerForSoloEvent, registerForTeamEvent, getRegisteredTeamList, getRegisteredMembersList, uploadImagesToGallery, } from '../controllers/eventController.js'
import adminAuth from '../middlewares/adminAuth.js';
import auth from '../middlewares/auth.js';

const eventRoutes = express.Router()

eventRoutes.post('/add_event', uploadEventImages, adminAuth, addEvent)
eventRoutes.get('/get_all_event', getEvents)
eventRoutes.get('/get_one_event/:id', GetOneEventUsingId)
eventRoutes.put('/update_event/:id', adminAuth, updateEvent)
eventRoutes.post('/delete_event/:id', adminAuth, deleteEvent)
eventRoutes.post('/upload_images_to_gallery', uploadEventImages, uploadImagesToGallery)
eventRoutes.post('/register_for_solo_event/:id',auth , registerForSoloEvent) //event id in params
eventRoutes.post('/register_for_team_event/:id', auth, registerForTeamEvent)
eventRoutes.get('/get_registered_teams', getRegisteredTeamList)
eventRoutes.get('/get_registered_members', getRegisteredMembersList)
export default eventRoutes;

//done