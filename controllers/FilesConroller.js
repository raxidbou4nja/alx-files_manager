import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { promisify } from 'util';
import mime from 'mime-types';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);
const existsAsync = promisify(fs.exists);

const FilesController = {
  async postUpload(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const tokenKey = `auth_${token}`;
    const userId = await redisClient.getAsync(tokenKey);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, type, parentId = 0, isPublic = false, data } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }

    if (!['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }

    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    const filesCollection = dbClient.client.db(dbClient.dbName).collection('files');

    if (parentId !== 0) {
      const parentFile = await filesCollection.findOne({ _id: new dbClient.ObjectId(parentId) });
      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    const newFile = {
      userId: new dbClient.ObjectId(userId),
      name,
      type,
      isPublic,
      parentId: parentId === 0 ? 0 : new dbClient.ObjectId(parentId),
    };

    if (type === 'folder') {
      const result = await filesCollection.insertOne(newFile);
      return res.status(201).json({
        id: result.insertedId,
        userId,
        name,
        type,
        isPublic,
        parentId,
      });
    } else {
      const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
      if (!(await existsAsync(folderPath))) {
        await mkdirAsync(folderPath, { recursive: true });
      }

      const localPath = `${folderPath}/${uuidv4()}`;
      await writeFileAsync(localPath, Buffer.from(data, 'base64'));

      newFile.localPath = localPath;

      const result = await filesCollection.insertOne(newFile);
      return res.status(201).json({
        id: result.insertedId,
        userId,
        name,
        type,
        isPublic,
        parentId,
      });
    }
  },
};

export default FilesController;