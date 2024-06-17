import express from 'express';
import AppController from '../controllers/AppController';
import AuthController  from '../controllers/AuthController';
import UserController from '../controllers/UsersController';
import FilesController from '../controllers/FilesController';


const router = express.Router();

router.get('/status', AppController.getStatus);
router.get('/stats', AppController.getStats);
router.post('/users', UserController.postNew);
router.get('/connect', AuthController.getConnect);
router.get('/disconnect', AuthController.getDisconnect);
router.get('/users/me', UserController.getMe);

api.post('/files', xTokenAuthenticate, FilesController.postUpload);
api.get('/files/:id', xTokenAuthenticate, FilesController.getShow);
api.get('/files', xTokenAuthenticate, FilesController.getIndex);
api.put('/files/:id/publish', xTokenAuthenticate, FilesController.putPublish);
api.put('/files/:id/unpublish', xTokenAuthenticate, FilesController.putUnpublish);
api.get('/files/:id/data', FilesController.getFile);

export default router;
